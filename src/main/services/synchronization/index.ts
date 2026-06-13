import type { FsrsState } from '../../../shared/domain/item'
import { normalizeNotionPageId } from '../../../shared/domain/item'
import type { ReviewSource } from '../../../shared/domain/source'
import type { DateTimeString, ReviewItemId, ReviewSourceId } from '../../../shared/domain/types'
import type {
  ManualSyncResult,
  SourceSyncCounts,
  SourceSyncResult,
  SyncFailureCode,
  SyncProgress
} from '../../../shared/manual-sync'
import type { CollectionEngine, CollectionPage } from '../collection'

export type {
  ManualSyncResult,
  SourceSyncCounts,
  SourceSyncResult,
  SyncFailureCode,
  SyncProgress
} from '../../../shared/manual-sync'

export interface SyncPage extends CollectionPage {
  notionUrl: string
  title: string
  category: string | null
  tags: string[]
  originLabel: string | null
  notionLastEditedAt: DateTimeString | null
}

export interface NotionPageQueryResult {
  pages: SyncPage[]
  nextCursor: string | null
}

export interface NotionPageQueryClient {
  query(input: {
    source: ReviewSource
    cursor: string | null
    signal?: AbortSignal
  }): Promise<NotionPageQueryResult>
}

export class RateLimitError extends Error {
  readonly status = 429

  constructor(readonly retryAfterMs: number | null) {
    super('RATE_LIMITED')
    this.name = 'RateLimitError'
  }
}

export interface SyncRetryPolicy {
  maxRetries: number
  maxTotalWaitMs: number
  fallbackDelayMs: number
  sleep(delayMs: number, signal?: AbortSignal): Promise<void>
}

export interface SyncSourceReader {
  listEnabledSources(): ReviewSource[]
  findSourceById(sourceId: ReviewSourceId): ReviewSource | null
}

export interface InitialReviewScheduler {
  createInitialState(now: DateTimeString): {
    dueAt: DateTimeString
    state: FsrsState
  }
}

export interface SourceSyncCommitInput {
  source: ReviewSource
  pages: readonly SyncPage[]
  syncedAt: DateTimeString
  createReviewItemId: () => ReviewItemId
  scheduler: InitialReviewScheduler
}

export interface SyncPersistence {
  applySourceResult(input: SourceSyncCommitInput): SourceSyncCounts
  recordSourceFailure(input: {
    sourceId: ReviewSourceId
    code: SyncFailureCode
    occurredAt: DateTimeString
  }): void
}

export interface ManualSyncService {
  syncAll(input?: {
    signal?: AbortSignal
    onProgress?: (progress: SyncProgress) => void
  }): Promise<ManualSyncResult>
  syncSource(input: {
    sourceId: ReviewSourceId
    signal?: AbortSignal
    onProgress?: (progress: SyncProgress) => void
  }): Promise<ManualSyncResult>
}

export interface ManualSyncServiceDependencies {
  sources: SyncSourceReader
  notion: NotionPageQueryClient
  collection: CollectionEngine
  persistence: SyncPersistence
  scheduler: InitialReviewScheduler
  retry: SyncRetryPolicy
  now: () => DateTimeString
  createReviewItemId: () => ReviewItemId
  onProgress?: (progress: SyncProgress) => void
}

export function createManualSyncService(
  dependencies: ManualSyncServiceDependencies
): ManualSyncService {
  const {
    sources,
    notion,
    collection,
    persistence,
    scheduler,
    retry,
    now,
    createReviewItemId,
    onProgress
  } = dependencies

  if (
    !Number.isInteger(retry.maxRetries) ||
    retry.maxRetries < 0 ||
    !Number.isFinite(retry.maxTotalWaitMs) ||
    retry.maxTotalWaitMs < 0 ||
    !Number.isFinite(retry.fallbackDelayMs) ||
    retry.fallbackDelayMs < 0
  ) {
    throw new Error('INVALID_RETRY_POLICY')
  }

  const emptyCounts = (): SourceSyncCounts => ({
    created: 0,
    updated: 0,
    changed: 0,
    missing: 0,
    errors: 0
  })

  const addCounts = (left: SourceSyncCounts, right: SourceSyncCounts): SourceSyncCounts => ({
    created: left.created + right.created,
    updated: left.updated + right.updated,
    changed: left.changed + right.changed,
    missing: left.missing + right.missing,
    errors: left.errors + right.errors
  })

  const mapFailureCode = (error: unknown): SyncFailureCode => {
    const message = error instanceof Error ? error.message.toUpperCase() : ''
    if (message.includes('UNAUTHORIZED') || message.includes('401')) return 'unauthorized'
    if (message.includes('FORBIDDEN') || message.includes('403')) return 'forbidden'
    if (message.includes('NOT_FOUND') || message.includes('404')) return 'not_found'
    if (message.includes('RATE_LIMIT') || message.includes('429')) return 'rate_limit'
    if (message.includes('NETWORK') || message.includes('TIMEOUT')) return 'network_error'
    if (message.includes('SCHEMA') || message.includes('MAPPING')) return 'schema_mismatch'
    return 'internal_error'
  }

  const isCancellation = (error: unknown, signal?: AbortSignal): boolean =>
    signal?.aborted === true ||
    (error instanceof Error && (error.message === 'SYNC_CANCELLED' || error.name === 'AbortError'))

  const isRateLimitError = (error: unknown): error is RateLimitError =>
    error instanceof RateLimitError ||
    (error instanceof Error &&
      (error.message.toUpperCase().includes('RATE_LIMIT') ||
        ('status' in error && error.status === 429)))

  const queryWithRetry = async (
    source: ReviewSource,
    cursor: string | null,
    signal?: AbortSignal
  ): Promise<NotionPageQueryResult> => {
    let retryCount = 0
    let totalWaitMs = 0

    while (true) {
      if (signal?.aborted) throw new Error('SYNC_CANCELLED')

      try {
        return await notion.query({ source, cursor, signal })
      } catch (error) {
        if (!isRateLimitError(error)) throw error

        const retryAfterMs = error instanceof RateLimitError ? error.retryAfterMs : null
        const delayMs =
          retryAfterMs !== null && Number.isFinite(retryAfterMs) && retryAfterMs >= 0
            ? retryAfterMs
            : retry.fallbackDelayMs
        if (
          retryCount >= retry.maxRetries ||
          delayMs < 0 ||
          totalWaitMs + delayMs > retry.maxTotalWaitMs
        ) {
          throw error
        }

        retryCount++
        totalWaitMs += delayMs
        await retry.sleep(delayMs, signal)
        if (signal?.aborted) throw new Error('SYNC_CANCELLED')
      }
    }
  }

  const emitProgress = (
    progress: SyncProgress,
    runProgress?: (progress: SyncProgress) => void
  ): void => {
    onProgress?.(progress)
    runProgress?.(progress)
  }

  const syncOne = async (
    source: ReviewSource,
    signal?: AbortSignal,
    runProgress?: (progress: SyncProgress) => void
  ): Promise<SourceSyncResult> => {
    emitProgress({ state: 'running', sourceId: source.id }, runProgress)

    try {
      const pagesById = new Map<string, SyncPage>()
      let cursor: string | null = null

      do {
        if (signal?.aborted) {
          throw new Error('SYNC_CANCELLED')
        }

        const response = await queryWithRetry(source, cursor, signal)
        for (const page of response.pages) {
          const normalizedPageId = normalizeNotionPageId(page.notionPageId)
          if (!pagesById.has(normalizedPageId)) {
            pagesById.set(normalizedPageId, {
              ...page,
              notionPageId: normalizedPageId as SyncPage['notionPageId']
            })
          }
        }
        cursor = response.nextCursor
      } while (cursor !== null)

      if (signal?.aborted) {
        throw new Error('SYNC_CANCELLED')
      }

      const collected = collection.collect({
        source,
        pages: [...pagesById.values()]
      })
      const syncedAt = now()
      const counts = persistence.applySourceResult({
        source,
        pages: collected.candidates,
        syncedAt,
        createReviewItemId,
        scheduler
      })

      emitProgress({ state: 'source-completed', sourceId: source.id, counts }, runProgress)
      return {
        sourceId: source.id,
        status: 'completed',
        counts,
        errorCode: null
      }
    } catch (error) {
      if (isCancellation(error, signal)) {
        const counts = emptyCounts()
        emitProgress({ state: 'source-cancelled', sourceId: source.id }, runProgress)
        return {
          sourceId: source.id,
          status: 'cancelled',
          counts,
          errorCode: null
        }
      }

      const code = mapFailureCode(error)
      const occurredAt = now()
      persistence.recordSourceFailure({ sourceId: source.id, code, occurredAt })
      const counts = { ...emptyCounts(), errors: 1 }
      emitProgress({ state: 'source-failed', sourceId: source.id, code }, runProgress)
      return {
        sourceId: source.id,
        status: 'failed',
        counts,
        errorCode: code
      }
    }
  }

  const run = async (
    selectedSources: readonly ReviewSource[],
    signal?: AbortSignal,
    runProgress?: (progress: SyncProgress) => void
  ): Promise<ManualSyncResult> => {
    const results: SourceSyncResult[] = []
    for (const source of selectedSources) {
      const result = await syncOne(source, signal, runProgress)
      results.push(result)
      if (result.status === 'cancelled') break
    }
    return {
      sources: results,
      totals: results.reduce((totals, result) => addCounts(totals, result.counts), emptyCounts())
    }
  }

  return {
    async syncAll(input): Promise<ManualSyncResult> {
      return run(sources.listEnabledSources(), input?.signal, input?.onProgress)
    },
    async syncSource({ sourceId, signal, onProgress: runProgress }): Promise<ManualSyncResult> {
      const source = sources.findSourceById(sourceId)
      if (!source?.enabled) {
        throw new Error('SOURCE_NOT_SYNCABLE')
      }
      return run([source], signal, runProgress)
    }
  }
}
