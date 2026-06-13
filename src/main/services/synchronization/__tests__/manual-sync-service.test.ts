import { describe, expect, it, vi } from 'vitest'
import type { ReviewSource } from '../../../../shared/domain/source'
import type {
  DateTimeString,
  NotionPageId,
  NotionTargetId,
  ReviewItemId,
  ReviewSourceId
} from '../../../../shared/domain/types'
import type { CollectionEngine, CollectionPage, CollectionResult } from '../../collection'
import {
  createManualSyncService,
  RateLimitError,
  type ManualSyncServiceDependencies,
  type SourceSyncCommitInput,
  type SyncPage
} from '../index'

const now = '2026-06-13T00:00:00.000Z' as DateTimeString

function source(id: string, enabled = true): ReviewSource {
  return {
    id: id as ReviewSourceId,
    name: id,
    notionTargetId: `${id}-target` as NotionTargetId,
    notionTargetUrl: null,
    notionTargetType: 'data_source',
    enabled,
    collectionMode: 'all',
    titlePropertyName: 'Name',
    urlPropertyName: null,
    categoryPropertyName: null,
    tagPropertyName: null,
    sourcePropertyName: null,
    reviewCheckboxPropertyName: null,
    lastEditedPropertyName: null,
    filterPropertyName: null,
    filterOperator: null,
    filterValue: null,
    lastSyncedAt: null,
    createdAt: now,
    updatedAt: now
  }
}

function syncPage(id: string): SyncPage {
  return {
    notionPageId: id as NotionPageId,
    notionUrl: `https://www.notion.so/${id}`,
    title: id,
    category: null,
    tags: [],
    originLabel: null,
    notionLastEditedAt: null,
    properties: {}
  }
}

function dependencies(sources: ReviewSource[]): ManualSyncServiceDependencies {
  const collection: CollectionEngine = {
    collect<TPage extends CollectionPage>({
      pages
    }: {
      pages: readonly TPage[]
    }): CollectionResult<TPage> {
      return { candidates: [...pages] }
    }
  }

  return {
    sources: {
      listEnabledSources: vi.fn(() => sources.filter(({ enabled }) => enabled)),
      findSourceById: vi.fn((sourceId) => sources.find(({ id }) => id === sourceId) ?? null)
    },
    notion: {
      query: vi.fn().mockResolvedValue({ pages: [], nextCursor: null })
    },
    collection,
    persistence: {
      applySourceResult: vi.fn(() => ({
        created: 0,
        updated: 0,
        changed: 0,
        missing: 0,
        errors: 0
      })),
      recordSourceFailure: vi.fn()
    },
    scheduler: {
      createInitialState: vi.fn(() => ({
        dueAt: now,
        state: { version: 'ts-fsrs@test', payload: {} }
      }))
    },
    retry: {
      maxRetries: 2,
      maxTotalWaitMs: 10_000,
      fallbackDelayMs: 500,
      sleep: vi.fn().mockResolvedValue(undefined)
    },
    now: () => now,
    createReviewItemId: () => 'item-1' as ReviewItemId,
    onProgress: vi.fn()
  }
}

describe('ManualSyncService red contract', () => {
  it('TC-SYNC-001: sync-all queries only enabled Sources', async () => {
    const enabled = source('enabled')
    const disabled = source('disabled', false)
    const deps = dependencies([enabled, disabled])
    const service = createManualSyncService(deps)

    await service.syncAll()

    expect(deps.notion.query).toHaveBeenCalledTimes(1)
    expect(deps.notion.query).toHaveBeenCalledWith(
      expect.objectContaining({ source: enabled, cursor: null })
    )
  })

  it('TC-SYNC-002/007: single-Source sync leaves unselected Sources untouched', async () => {
    const selected = source('selected')
    const unselected = source('unselected')
    const deps = dependencies([selected, unselected])
    const service = createManualSyncService(deps)

    await service.syncSource({ sourceId: selected.id })

    expect(deps.notion.query).toHaveBeenCalledTimes(1)
    expect(deps.persistence.applySourceResult).toHaveBeenCalledWith(
      expect.objectContaining({ source: selected })
    )
    expect(deps.persistence.applySourceResult).not.toHaveBeenCalledWith(
      expect.objectContaining({ source: unselected })
    )
  })

  it.each([
    ['missing', 'missing' as ReviewSourceId],
    ['disabled', 'disabled' as ReviewSourceId]
  ])('TC-SYNC-003: rejects a %s Source before Notion access', async (_case, sourceId) => {
    const deps = dependencies([source('disabled', false)])
    const service = createManualSyncService(deps)

    await expect(service.syncSource({ sourceId })).rejects.toThrow('SOURCE_NOT_SYNCABLE')
    expect(deps.notion.query).not.toHaveBeenCalled()
    expect(deps.persistence.applySourceResult).not.toHaveBeenCalled()
  })

  it('TC-SYNC-009/010: follows each pagination cursor before persistence', async () => {
    const active = source('active')
    const deps = dependencies([active])
    vi.mocked(deps.notion.query)
      .mockResolvedValueOnce({ pages: [syncPage('one')], nextCursor: 'cursor-2' })
      .mockResolvedValueOnce({ pages: [syncPage('two')], nextCursor: null })
    const service = createManualSyncService(deps)

    await service.syncSource({ sourceId: active.id })

    expect(deps.notion.query).toHaveBeenNthCalledWith(1, expect.objectContaining({ cursor: null }))
    expect(deps.notion.query).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: 'cursor-2' })
    )
    expect(deps.persistence.applySourceResult).toHaveBeenCalledTimes(1)
  })

  it('TC-SYNC-011: deduplicates normalized Page IDs before the Source commit', async () => {
    const active = source('active')
    const deps = dependencies([active])
    vi.mocked(deps.notion.query)
      .mockResolvedValueOnce({
        pages: [syncPage('A8AE-C8AE')],
        nextCursor: 'cursor-2'
      })
      .mockResolvedValueOnce({
        pages: [syncPage('a8aec8ae')],
        nextCursor: null
      })
    const service = createManualSyncService(deps)

    await service.syncSource({ sourceId: active.id })

    const commit = vi.mocked(deps.persistence.applySourceResult).mock
      .calls[0][0] as SourceSyncCommitInput
    expect(commit.pages).toHaveLength(1)
    expect(commit.pages[0].notionPageId).toBe('a8aec8ae')
  })

  it('TC-SYNC-012/013: a middle-page failure performs no Source commit and records failure', async () => {
    const active = source('active')
    const deps = dependencies([active])
    vi.mocked(deps.notion.query)
      .mockResolvedValueOnce({ pages: [syncPage('one')], nextCursor: 'cursor-2' })
      .mockRejectedValueOnce(new Error('NETWORK_ERROR'))
    const service = createManualSyncService(deps)

    const result = await service.syncSource({ sourceId: active.id })

    expect(deps.persistence.applySourceResult).not.toHaveBeenCalled()
    expect(deps.persistence.recordSourceFailure).toHaveBeenCalledWith({
      sourceId: active.id,
      code: 'network_error',
      occurredAt: now
    })
    expect(result.sources[0]).toMatchObject({
      sourceId: active.id,
      status: 'failed',
      errorCode: 'network_error'
    })
  })

  it('TC-SYNC-006: a later Source failure preserves an earlier Source commit', async () => {
    const first = source('first')
    const second = source('second')
    const deps = dependencies([first, second])
    vi.mocked(deps.notion.query).mockImplementation(async ({ source: current }) => {
      if (current.id === second.id) {
        throw new Error('NETWORK_ERROR')
      }
      return { pages: [syncPage('one')], nextCursor: null }
    })
    const service = createManualSyncService(deps)

    const result = await service.syncAll()

    expect(deps.persistence.applySourceResult).toHaveBeenCalledTimes(1)
    expect(deps.persistence.applySourceResult).toHaveBeenCalledWith(
      expect.objectContaining({ source: first })
    )
    expect(result.sources.map(({ status }) => status)).toEqual(['completed', 'failed'])
  })

  it('TC-SYNC-041/042: persistence receives one complete Source result and commit time', async () => {
    const active = source('active')
    const deps = dependencies([active])
    vi.mocked(deps.notion.query).mockResolvedValue({
      pages: [syncPage('one'), syncPage('two')],
      nextCursor: null
    })
    const service = createManualSyncService(deps)

    await service.syncSource({ sourceId: active.id })

    expect(deps.persistence.applySourceResult).toHaveBeenCalledTimes(1)
    expect(deps.persistence.applySourceResult).toHaveBeenCalledWith({
      source: active,
      pages: expect.arrayContaining([
        expect.objectContaining({ notionPageId: 'one' }),
        expect.objectContaining({ notionPageId: 'two' })
      ]),
      syncedAt: now,
      createReviewItemId: deps.createReviewItemId,
      scheduler: deps.scheduler
    })
  })

  it('TC-SYNC-014/018: exhausted HTTP 429 retries record rate_limit failure', async () => {
    const active = source('active')
    const deps = dependencies([active])
    vi.mocked(deps.notion.query).mockRejectedValue(new RateLimitError(1000))
    const service = createManualSyncService(deps)

    const result = await service.syncSource({ sourceId: active.id })

    expect(deps.notion.query).toHaveBeenCalledTimes(3)
    expect(deps.persistence.applySourceResult).not.toHaveBeenCalled()
    expect(deps.persistence.recordSourceFailure).toHaveBeenCalledWith({
      sourceId: active.id,
      code: 'rate_limit',
      occurredAt: now
    })
    expect(result.sources[0]).toMatchObject({
      status: 'failed',
      errorCode: 'rate_limit'
    })
  })

  it('TC-SYNC-015: honors Retry-After before retrying the same cursor', async () => {
    const active = source('active')
    const deps = dependencies([active])
    vi.mocked(deps.notion.query)
      .mockRejectedValueOnce(new RateLimitError(2500))
      .mockResolvedValueOnce({ pages: [], nextCursor: null })
    const service = createManualSyncService(deps)

    await service.syncSource({ sourceId: active.id })

    expect(deps.retry.sleep).toHaveBeenCalledWith(2500, undefined)
    expect(deps.notion.query).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ source: active, cursor: null })
    )
  })

  it('TC-SYNC-016: finite retry count prevents an unbounded request loop', async () => {
    const active = source('active')
    const deps = dependencies([active])
    deps.retry.maxRetries = 1
    vi.mocked(deps.notion.query).mockRejectedValue(new RateLimitError(1000))
    const service = createManualSyncService(deps)

    await service.syncSource({ sourceId: active.id })

    expect(deps.notion.query).toHaveBeenCalledTimes(2)
    expect(deps.retry.sleep).toHaveBeenCalledTimes(1)
  })

  it.each([
    { maxRetries: Number.POSITIVE_INFINITY },
    { maxRetries: -1 },
    { maxTotalWaitMs: Number.POSITIVE_INFINITY },
    { maxTotalWaitMs: -1 },
    { fallbackDelayMs: Number.NaN },
    { fallbackDelayMs: -1 }
  ])('TC-SYNC-016: rejects a non-finite retry policy before Notion access', (override) => {
    const active = source('active')
    const deps = dependencies([active])
    Object.assign(deps.retry, override)

    expect(() => createManualSyncService(deps)).toThrow('INVALID_RETRY_POLICY')
    expect(deps.notion.query).not.toHaveBeenCalled()
  })

  it('TC-SYNC-016: total wait limit prevents a retry beyond the configured budget', async () => {
    const active = source('active')
    const deps = dependencies([active])
    deps.retry.maxRetries = 5
    deps.retry.maxTotalWaitMs = 1500
    vi.mocked(deps.notion.query).mockRejectedValue(new RateLimitError(1000))
    const service = createManualSyncService(deps)

    await service.syncSource({ sourceId: active.id })

    expect(deps.notion.query).toHaveBeenCalledTimes(2)
    expect(deps.retry.sleep).toHaveBeenCalledTimes(1)
  })

  it('TC-SYNC-017: success within the retry limit continues Source synchronization', async () => {
    const active = source('active')
    const deps = dependencies([active])
    vi.mocked(deps.notion.query)
      .mockRejectedValueOnce(new RateLimitError(null))
      .mockResolvedValueOnce({ pages: [syncPage('one')], nextCursor: null })
    const service = createManualSyncService(deps)

    const result = await service.syncSource({ sourceId: active.id })

    expect(deps.retry.sleep).toHaveBeenCalledWith(500, undefined)
    expect(deps.persistence.applySourceResult).toHaveBeenCalledTimes(1)
    expect(result.sources[0]).toMatchObject({
      status: 'completed',
      errorCode: null
    })
  })

  it('TC-SYNC-019: cancellation during rate-limit waiting prevents another request', async () => {
    const active = source('active')
    const deps = dependencies([active])
    const controller = new AbortController()
    vi.mocked(deps.notion.query).mockRejectedValue(new RateLimitError(1000))
    vi.mocked(deps.retry.sleep).mockImplementationOnce(async () => {
      controller.abort()
    })
    const service = createManualSyncService(deps)

    const result = await service.syncSource({
      sourceId: active.id,
      signal: controller.signal
    })

    expect(deps.notion.query).toHaveBeenCalledTimes(1)
    expect(deps.persistence.applySourceResult).not.toHaveBeenCalled()
    expect(deps.persistence.recordSourceFailure).not.toHaveBeenCalled()
    expect(result.sources[0].status).toBe('cancelled')
  })

  it('TC-SYNC-019: an aborted Notion request is cancellation, not Source failure', async () => {
    const active = source('active')
    const deps = dependencies([active])
    const controller = new AbortController()
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    vi.mocked(deps.notion.query).mockImplementationOnce(async () => {
      controller.abort()
      throw abortError
    })
    const service = createManualSyncService(deps)

    const result = await service.syncSource({
      sourceId: active.id,
      signal: controller.signal
    })

    expect(deps.persistence.applySourceResult).not.toHaveBeenCalled()
    expect(deps.persistence.recordSourceFailure).not.toHaveBeenCalled()
    expect(result.sources[0]).toMatchObject({
      status: 'cancelled',
      errorCode: null,
      counts: { errors: 0 }
    })
  })

  it('TC-SYNC-019/020/021: cancellation stops requests without commit or failure persistence', async () => {
    const active = source('active')
    const deps = dependencies([active])
    const controller = new AbortController()
    vi.mocked(deps.notion.query).mockImplementationOnce(async () => {
      controller.abort()
      return { pages: [syncPage('one')], nextCursor: 'cursor-2' }
    })
    const service = createManualSyncService(deps)

    const result = await service.syncSource({
      sourceId: active.id,
      signal: controller.signal
    })

    expect(deps.notion.query).toHaveBeenCalledTimes(1)
    expect(deps.persistence.applySourceResult).not.toHaveBeenCalled()
    expect(deps.persistence.recordSourceFailure).not.toHaveBeenCalled()
    expect(result.sources[0]).toEqual({
      sourceId: active.id,
      status: 'cancelled',
      counts: {
        created: 0,
        updated: 0,
        changed: 0,
        missing: 0,
        errors: 0
      },
      errorCode: null
    })
  })
})
