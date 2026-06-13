import type { ReviewSource } from '../../../shared/domain/source'
import type { DateTimeString, NotionPageId } from '../../../shared/domain/types'
import type { CollectionPropertyValue } from '../collection'
import {
  RateLimitError,
  type NotionPageQueryClient,
  type NotionPageQueryResult,
  type SyncPage
} from '../synchronization'
import type { TokenVault } from './connection'

const NOTION_VERSION = '2026-03-11'
const PAGE_SIZE = 100

interface NotionRichText {
  plain_text?: unknown
}

interface NotionProperty {
  type?: unknown
  title?: NotionRichText[]
  rich_text?: NotionRichText[]
  url?: unknown
  select?: { name?: unknown } | null
  status?: { name?: unknown } | null
  multi_select?: { name?: unknown }[]
  checkbox?: unknown
  date?: { start?: unknown } | null
  last_edited_time?: unknown
}

interface NotionPageResponse {
  id?: unknown
  url?: unknown
  last_edited_time?: unknown
  properties?: unknown
}

interface NotionQueryResponse {
  results?: unknown
  next_cursor?: unknown
  has_more?: unknown
}

export type NotionSyncFetch = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Pick<Response, 'ok' | 'status' | 'headers' | 'json'>>

export interface ProductionNotionPageQueryClientDependencies {
  vault: TokenVault
  fetch?: NotionSyncFetch
}

function schemaMismatch(): never {
  throw new Error('SCHEMA_MISMATCH')
}

function asProperties(value: unknown): Record<string, NotionProperty> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return schemaMismatch()
  }
  return value as Record<string, NotionProperty>
}

function text(parts: NotionRichText[] | undefined): string {
  if (!Array.isArray(parts)) return ''
  return parts.map((part) => (typeof part?.plain_text === 'string' ? part.plain_text : '')).join('')
}

function parseCollectionProperty(
  property: NotionProperty | undefined
): CollectionPropertyValue | undefined {
  if (!property || typeof property.type !== 'string') return undefined

  switch (property.type) {
    case 'select':
      return {
        type: 'select',
        value: typeof property.select?.name === 'string' ? property.select.name : null
      }
    case 'status':
      return {
        type: 'status',
        value: typeof property.status?.name === 'string' ? property.status.name : null
      }
    case 'multi_select':
      return {
        type: 'multi_select',
        value: Array.isArray(property.multi_select)
          ? property.multi_select
              .map(({ name }) => (typeof name === 'string' ? name : null))
              .filter((name): name is string => name !== null)
          : []
      }
    case 'rich_text':
      return { type: 'rich_text', value: text(property.rich_text) }
    case 'checkbox':
      return {
        type: 'checkbox',
        value: typeof property.checkbox === 'boolean' ? property.checkbox : null
      }
    default:
      return undefined
  }
}

function scalar(property: NotionProperty | undefined): string | null {
  if (!property || typeof property.type !== 'string') return null
  switch (property.type) {
    case 'title': {
      const value = text(property.title)
      return value || null
    }
    case 'rich_text': {
      const value = text(property.rich_text)
      return value || null
    }
    case 'url':
      return typeof property.url === 'string' && property.url ? property.url : null
    case 'select':
      return typeof property.select?.name === 'string' ? property.select.name : null
    case 'status':
      return typeof property.status?.name === 'string' ? property.status.name : null
    case 'date':
      return typeof property.date?.start === 'string' ? property.date.start : null
    case 'last_edited_time':
      return typeof property.last_edited_time === 'string' ? property.last_edited_time : null
    default:
      return null
  }
}

function tags(property: NotionProperty | undefined): string[] {
  if (!property || property.type !== 'multi_select' || !Array.isArray(property.multi_select)) {
    return []
  }
  return property.multi_select
    .map(({ name }) => (typeof name === 'string' ? name : null))
    .filter((name): name is string => name !== null)
}

function mapPage(source: ReviewSource, raw: NotionPageResponse): SyncPage {
  if (typeof raw.id !== 'string' || typeof raw.url !== 'string') {
    return schemaMismatch()
  }
  const properties = asProperties(raw.properties)
  const title = scalar(properties[source.titlePropertyName])
  if (!title) return schemaMismatch()

  const collectionProperties: Record<string, CollectionPropertyValue | undefined> = {}
  for (const propertyName of [source.filterPropertyName, source.reviewCheckboxPropertyName]) {
    if (!propertyName || propertyName in collectionProperties) continue
    collectionProperties[propertyName] = parseCollectionProperty(properties[propertyName])
  }

  const mappedEditedAt = source.lastEditedPropertyName
    ? scalar(properties[source.lastEditedPropertyName])
    : null
  const fallbackEditedAt = typeof raw.last_edited_time === 'string' ? raw.last_edited_time : null

  return {
    notionPageId: raw.id as NotionPageId,
    notionUrl: source.urlPropertyName
      ? (scalar(properties[source.urlPropertyName]) ?? raw.url)
      : raw.url,
    title,
    category: source.categoryPropertyName ? scalar(properties[source.categoryPropertyName]) : null,
    tags: source.tagPropertyName ? tags(properties[source.tagPropertyName]) : [],
    originLabel: source.sourcePropertyName ? scalar(properties[source.sourcePropertyName]) : null,
    notionLastEditedAt: (mappedEditedAt ?? fallbackEditedAt) as DateTimeString | null,
    properties: collectionProperties
  }
}

function parseRetryAfter(headers: Headers): number | null {
  const value = headers.get('retry-after')
  if (!value) return null

  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000
  }

  const date = Date.parse(value)
  if (Number.isNaN(date)) return null
  return Math.max(0, date - Date.now())
}

function throwHttpError(status: number, headers: Headers): never {
  if (status === 401) throw new Error('UNAUTHORIZED')
  if (status === 403) throw new Error('FORBIDDEN')
  if (status === 404) throw new Error('NOT_FOUND')
  if (status === 429) throw new RateLimitError(parseRetryAfter(headers))
  throw new Error('NETWORK_ERROR')
}

export class ProductionNotionPageQueryClient implements NotionPageQueryClient {
  private readonly fetch: NotionSyncFetch

  constructor(private readonly dependencies: ProductionNotionPageQueryClientDependencies) {
    this.fetch = dependencies.fetch ?? globalThis.fetch
  }

  async query({
    source,
    cursor,
    signal
  }: {
    source: ReviewSource
    cursor: string | null
    signal?: AbortSignal
  }): Promise<NotionPageQueryResult> {
    const token = this.dependencies.vault.getToken()
    if (!token) throw new Error('UNAUTHORIZED')

    let response: Awaited<ReturnType<NotionSyncFetch>>
    try {
      response = await this.fetch(
        `https://api.notion.com/v1/data_sources/${source.notionTargetId}/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            page_size: PAGE_SIZE,
            ...(cursor ? { start_cursor: cursor } : {})
          }),
          signal
        }
      )
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw error
      }
      throw new Error('NETWORK_ERROR')
    }

    if (!response.ok) {
      throwHttpError(response.status, response.headers)
    }

    let payload: NotionQueryResponse
    try {
      payload = (await response.json()) as NotionQueryResponse
    } catch {
      return schemaMismatch()
    }
    if (!Array.isArray(payload.results)) return schemaMismatch()
    if (payload.has_more !== undefined && typeof payload.has_more !== 'boolean') {
      return schemaMismatch()
    }
    if (
      payload.next_cursor !== null &&
      payload.next_cursor !== undefined &&
      typeof payload.next_cursor !== 'string'
    ) {
      return schemaMismatch()
    }

    const nextCursor =
      payload.has_more === false
        ? null
        : typeof payload.next_cursor === 'string'
          ? payload.next_cursor
          : null

    return {
      pages: payload.results.map((page) => mapPage(source, page as NotionPageResponse)),
      nextCursor
    }
  }
}
