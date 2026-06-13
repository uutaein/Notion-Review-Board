import { describe, expect, it, vi } from 'vitest'
import type { ReviewSource } from '../../../../shared/domain/source'
import type {
  DateTimeString,
  NotionTargetId,
  ReviewSourceId
} from '../../../../shared/domain/types'
import { RateLimitError } from '../../synchronization'
import type { TokenVault } from '../connection'
import { ProductionNotionPageQueryClient, type NotionSyncFetch } from '../sync-query'

const token = 'secret_sync_token'

function source(overrides: Partial<ReviewSource> = {}): ReviewSource {
  return {
    id: 'source-1' as ReviewSourceId,
    name: 'Study',
    notionTargetId: 'target-1' as NotionTargetId,
    notionTargetUrl: null,
    notionTargetType: 'data_source',
    enabled: true,
    collectionMode: 'tag',
    titlePropertyName: 'Name',
    urlPropertyName: 'Link',
    categoryPropertyName: 'Category',
    tagPropertyName: 'Tags',
    sourcePropertyName: 'Origin',
    reviewCheckboxPropertyName: null,
    lastEditedPropertyName: 'Edited',
    filterPropertyName: 'Category',
    filterOperator: 'equals',
    filterValue: 'AI',
    lastSyncedAt: null,
    createdAt: '2026-06-13T00:00:00.000Z' as DateTimeString,
    updatedAt: '2026-06-13T00:00:00.000Z' as DateTimeString,
    ...overrides
  }
}

function response(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: vi.fn().mockResolvedValue(body)
  }
}

function page() {
  return {
    id: 'ABC-DEF',
    url: 'https://www.notion.so/canonical',
    last_edited_time: '2026-06-12T00:00:00.000Z',
    properties: {
      Name: { type: 'title', title: [{ plain_text: 'Mapped title' }] },
      Link: { type: 'url', url: 'https://www.notion.so/mapped' },
      Category: { type: 'select', select: { name: 'AI' } },
      Tags: {
        type: 'multi_select',
        multi_select: [{ name: 'review' }, { name: 'notion' }]
      },
      Origin: { type: 'rich_text', rich_text: [{ plain_text: 'Docs' }] },
      Edited: { type: 'date', date: { start: '2026-06-13T01:00:00.000Z' } },
      Review: { type: 'checkbox', checkbox: true }
    }
  }
}

function client(fetchMock: NotionSyncFetch, storedToken: string | null = token) {
  return new ProductionNotionPageQueryClient({
    vault: { getToken: vi.fn(() => storedToken) } as unknown as TokenVault,
    fetch: fetchMock
  })
}

describe('ProductionNotionPageQueryClient', () => {
  it('queries the configured Data Source with token, version, page size, and cursor', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, { results: [], has_more: false }))

    await client(fetchMock).query({ source: source(), cursor: 'cursor-2' })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.notion.com/v1/data_sources/target-1/query',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': '2026-03-11',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ page_size: 100, start_cursor: 'cursor-2' })
      })
    )
  })

  it('maps page metadata and Collection Engine properties without returning raw payloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response(200, {
        results: [page()],
        has_more: true,
        next_cursor: 'cursor-2'
      })
    )

    const result = await client(fetchMock).query({ source: source(), cursor: null })

    expect(result).toEqual({
      pages: [
        {
          notionPageId: 'ABC-DEF',
          notionUrl: 'https://www.notion.so/mapped',
          title: 'Mapped title',
          category: 'AI',
          tags: ['review', 'notion'],
          originLabel: 'Docs',
          notionLastEditedAt: '2026-06-13T01:00:00.000Z',
          properties: {
            Category: { type: 'select', value: 'AI' }
          }
        }
      ],
      nextCursor: 'cursor-2'
    })
    expect(JSON.stringify(result)).not.toContain(token)
  })

  it('maps checkbox collection values and falls back to canonical URL and edited time', async () => {
    const checkboxSource = source({
      collectionMode: 'checkbox',
      urlPropertyName: null,
      lastEditedPropertyName: null,
      filterPropertyName: null,
      filterOperator: 'checked',
      filterValue: null,
      reviewCheckboxPropertyName: 'Review'
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response(200, { results: [page()], has_more: false, next_cursor: null }))

    const result = await client(fetchMock).query({ source: checkboxSource, cursor: null })

    expect(result.pages[0]).toMatchObject({
      notionUrl: 'https://www.notion.so/canonical',
      notionLastEditedAt: '2026-06-12T00:00:00.000Z',
      properties: {
        Review: { type: 'checkbox', value: true }
      }
    })
    expect(result.nextCursor).toBeNull()
  })

  it('rejects a missing token before network access', async () => {
    const fetchMock = vi.fn()

    await expect(client(fetchMock, null).query({ source: source(), cursor: null })).rejects.toThrow(
      'UNAUTHORIZED'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND']
  ])('maps HTTP %i to %s without reading the raw response body', async (status, code) => {
    const raw = { secret: token, stack: 'internal' }
    const httpResponse = response(status, raw)
    const fetchMock = vi.fn().mockResolvedValue(httpResponse)

    await expect(client(fetchMock).query({ source: source(), cursor: null })).rejects.toThrow(code)
    expect(httpResponse.json).not.toHaveBeenCalled()
  })

  it('maps HTTP 429 and Retry-After seconds to structured rate-limit data', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response(429, { secret: token }, { 'Retry-After': '3' }))

    const promise = client(fetchMock).query({ source: source(), cursor: null })

    await expect(promise).rejects.toBeInstanceOf(RateLimitError)
    await expect(promise).rejects.toMatchObject({ retryAfterMs: 3000 })
  })

  it('maps transport failures to NETWORK_ERROR without exposing the original error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error(`socket failed ${token}`))

    await expect(client(fetchMock).query({ source: source(), cursor: null })).rejects.toThrow(
      'NETWORK_ERROR'
    )
  })

  it('preserves AbortError so Manual Sync cancellation remains distinguishable', async () => {
    const controller = new AbortController()
    controller.abort()
    const abortError = new Error('aborted')
    abortError.name = 'AbortError'
    const fetchMock = vi.fn().mockRejectedValue(abortError)

    await expect(
      client(fetchMock).query({
        source: source(),
        cursor: null,
        signal: controller.signal
      })
    ).rejects.toBe(abortError)
  })

  it.each([
    { results: null },
    { results: [{}] },
    { results: [page()], has_more: 'yes' },
    { results: [page()], has_more: true, next_cursor: 123 }
  ])('rejects malformed success payloads as SCHEMA_MISMATCH', async (body) => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, body))

    await expect(client(fetchMock).query({ source: source(), cursor: null })).rejects.toThrow(
      'SCHEMA_MISMATCH'
    )
  })
})
