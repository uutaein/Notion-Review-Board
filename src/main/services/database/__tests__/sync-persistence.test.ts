import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReviewItem } from '../../../../shared/domain/item'
import type { ReviewLog } from '../../../../shared/domain/log'
import type { ReviewSource } from '../../../../shared/domain/source'
import type {
  DateTimeString,
  NotionPageId,
  NotionTargetId,
  ReviewItemId,
  ReviewLogId,
  ReviewSourceId
} from '../../../../shared/domain/types'
import type { InitialReviewScheduler, SyncPage } from '../../synchronization'
import { createDatabaseService, type DatabaseService } from '..'
import { createDatabaseSyncPersistence } from '../sync-persistence'

const syncedAt = '2026-06-13T00:00:00.000Z' as DateTimeString
const previousSync = '2026-06-12T00:00:00.000Z' as DateTimeString
const sourceAId = 'source-a' as ReviewSourceId
const sourceBId = 'source-b' as ReviewSourceId

function source(id: ReviewSourceId): ReviewSource {
  return {
    id,
    name: id,
    notionTargetId: `${id}-target` as NotionTargetId,
    notionTargetUrl: null,
    notionTargetType: 'data_source',
    enabled: true,
    collectionMode: 'all',
    titlePropertyName: 'Name',
    urlPropertyName: null,
    categoryPropertyName: 'Category',
    tagPropertyName: 'Tags',
    sourcePropertyName: 'Origin',
    reviewCheckboxPropertyName: null,
    lastEditedPropertyName: null,
    filterPropertyName: null,
    filterOperator: null,
    filterValue: null,
    lastSyncedAt: null,
    createdAt: previousSync,
    updatedAt: previousSync,
    deletedAt: null
  }
}

function page(id: string, overrides: Partial<SyncPage> = {}): SyncPage {
  return {
    notionPageId: id as NotionPageId,
    notionUrl: `https://www.notion.so/${id}`,
    title: `Title ${id}`,
    category: 'Database',
    tags: ['sqlite'],
    originLabel: 'Notion',
    notionLastEditedAt: previousSync,
    properties: {},
    ...overrides
  }
}

function item(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'item-existing' as ReviewItemId,
    notionPageId: 'abcdef' as NotionPageId,
    notionUrl: 'https://www.notion.so/old',
    title: 'Old title',
    primarySourceId: sourceAId,
    sourceIds: [sourceAId],
    dueAt: '2026-06-20T00:00:00.000Z' as DateTimeString,
    fsrsState: { version: 'ts-fsrs@test', payload: { stability: 3 } },
    status: 'active',
    category: 'Old',
    tags: ['old'],
    originLabel: 'Old origin',
    lastReviewedAt: '2026-06-10T00:00:00.000Z' as DateTimeString,
    notionLastEditedAt: previousSync,
    lastSyncedAt: previousSync,
    missingDetectedAt: null,
    deletedDetectedAt: null,
    createdAt: '2026-06-01T00:00:00.000Z' as DateTimeString,
    updatedAt: previousSync,
    ...overrides
  }
}

function reviewLog(reviewItemId: ReviewItemId): ReviewLog {
  return {
    id: 'log-1' as ReviewLogId,
    reviewItemId,
    rating: 'good',
    reviewedAt: '2026-06-10T00:00:00.000Z' as DateTimeString,
    previousDueAt: '2026-06-10T00:00:00.000Z' as DateTimeString,
    nextDueAt: '2026-06-20T00:00:00.000Z' as DateTimeString,
    previousFsrsState: { version: 'ts-fsrs@test', payload: { stability: 2 } },
    nextFsrsState: { version: 'ts-fsrs@test', payload: { stability: 3 } },
    sourceId: sourceAId,
    category: 'Old',
    createdAt: '2026-06-10T00:00:00.000Z' as DateTimeString
  }
}

describe('database sync persistence', () => {
  let database: DatabaseService
  let scheduler: InitialReviewScheduler
  let nextItemId: number

  beforeEach(() => {
    database = createDatabaseService(':memory:')
    database.reviewSources.save(source(sourceAId))
    database.reviewSources.save(source(sourceBId))
    scheduler = {
      createInitialState: vi.fn(() => ({
        dueAt: syncedAt,
        state: { version: 'ts-fsrs@test', payload: { stability: 0 } }
      }))
    }
    nextItemId = 1
  })

  afterEach(() => database.close())

  function apply(pages: SyncPage[], selectedSource = source(sourceAId)) {
    return createDatabaseSyncPersistence(database).applySourceResult({
      source: selectedSource,
      pages,
      syncedAt,
      createReviewItemId: () => `created-${nextItemId++}` as ReviewItemId,
      scheduler
    })
  }

  it('TC-SYNC-022~026/032: creates a projected active item with initial scheduling state', () => {
    const counts = apply([
      page('ABC-DEF', {
        title: 'New title',
        notionUrl: 'https://www.notion.so/new',
        notionLastEditedAt: syncedAt
      })
    ])

    expect(counts).toEqual({ created: 1, updated: 0, changed: 0, missing: 0, errors: 0 })
    expect(database.reviewItems.findByNotionPageId('abcdef')).toEqual({
      id: 'created-1',
      notionPageId: 'abcdef',
      notionUrl: 'https://www.notion.so/new',
      title: 'New title',
      primarySourceId: sourceAId,
      sourceIds: [sourceAId],
      dueAt: syncedAt,
      fsrsState: { version: 'ts-fsrs@test', payload: { stability: 0 } },
      status: 'active',
      category: 'Database',
      tags: ['sqlite'],
      originLabel: 'Notion',
      lastReviewedAt: null,
      notionLastEditedAt: syncedAt,
      lastSyncedAt: syncedAt,
      missingDetectedAt: null,
      deletedDetectedAt: null,
      createdAt: syncedAt,
      updatedAt: syncedAt
    })
    expect(scheduler.createInitialState).toHaveBeenCalledWith(syncedAt)
  })

  it('TC-SYNC-027~030: updates metadata and Source references while preserving schedule and logs', () => {
    const existing = item()
    database.reviewItems.save(existing)
    database.reviewLogs.save(reviewLog(existing.id))

    const counts = apply([
      page('ABC-DEF', {
        title: 'Updated title',
        notionUrl: 'https://www.notion.so/updated',
        category: 'Updated category',
        tags: ['updated'],
        originLabel: 'Updated origin'
      })
    ])
    const updated = database.reviewItems.findById(existing.id)

    expect(counts.updated).toBe(1)
    expect(updated).toMatchObject({
      title: 'Updated title',
      notionUrl: 'https://www.notion.so/updated',
      category: 'Updated category',
      tags: ['updated'],
      originLabel: 'Updated origin',
      dueAt: existing.dueAt,
      lastReviewedAt: existing.lastReviewedAt,
      fsrsState: existing.fsrsState,
      sourceIds: [sourceAId],
      lastSyncedAt: syncedAt,
      updatedAt: syncedAt
    })
    expect(database.reviewLogs.findByItemId(existing.id)).toEqual([reviewLog(existing.id)])
    expect(scheduler.createInitialState).not.toHaveBeenCalled()
  })

  it('TC-SYNC-031: marks a newer existing page changed without altering its schedule', () => {
    const existing = item()
    database.reviewItems.save(existing)

    const counts = apply([
      page('abcdef', {
        notionLastEditedAt: '2026-06-13T01:00:00.000Z' as DateTimeString
      })
    ])

    expect(counts).toMatchObject({ updated: 1, changed: 1 })
    expect(database.reviewItems.findById(existing.id)).toMatchObject({
      status: 'changed',
      dueAt: existing.dueAt,
      fsrsState: existing.fsrsState
    })
  })

  it('TC-SYNC-033: marks a sole-reference unseen item missing after a complete result', () => {
    const existing = item()
    database.reviewItems.save(existing)

    const counts = apply([])

    expect(counts.missing).toBe(1)
    expect(database.reviewItems.findById(existing.id)).toMatchObject({
      status: 'missing',
      missingDetectedAt: syncedAt,
      dueAt: existing.dueAt,
      fsrsState: existing.fsrsState
    })
  })

  it('TC-SYNC-035~037: merges the same Page ID and preserves the first primary Source', () => {
    database.reviewItems.save(item())

    const counts = apply([page('ABC-DEF')], source(sourceBId))

    expect(counts).toMatchObject({ created: 0, updated: 1 })
    expect(database.reviewItems.findByNotionPageId('abcdef')).toMatchObject({
      primarySourceId: sourceAId,
      sourceIds: [sourceAId, sourceBId]
    })
    expect(database.connection.prepare('SELECT COUNT(*) AS count FROM review_items').get()).toEqual(
      { count: 1 }
    )
  })

  it('preserves a shared item when it disappears from only one Source', () => {
    database.reviewItems.save(
      item({
        primarySourceId: sourceAId,
        sourceIds: [sourceAId, sourceBId]
      })
    )

    const counts = apply([])

    expect(counts.missing).toBe(0)
    expect(database.reviewItems.findByNotionPageId('abcdef')).toMatchObject({
      primarySourceId: sourceBId,
      sourceIds: [sourceBId],
      status: 'active'
    })
  })

  it('TC-SYNC-038/039: keeps different Page IDs separate even when URL and title match', () => {
    const sharedMetadata = {
      notionUrl: 'https://www.notion.so/shared',
      title: 'Shared title'
    }

    apply([page('page-one', sharedMetadata), page('page-two', sharedMetadata)])

    expect(database.connection.prepare('SELECT COUNT(*) AS count FROM review_items').get()).toEqual(
      { count: 2 }
    )
  })

  it('TC-SYNC-040/042: re-running is idempotent and advances Source lastSyncedAt after commit', () => {
    apply([page('abcdef')])
    const firstItem = database.reviewItems.findByNotionPageId('abcdef')

    const counts = apply([page('abcdef')])

    expect(counts).toMatchObject({ created: 0, updated: 1 })
    expect(database.reviewItems.findByNotionPageId('abcdef')?.id).toBe(firstItem?.id)
    expect(database.reviewSources.findById(sourceAId)?.lastSyncedAt).toBe(syncedAt)
  })

  it('TC-SYNC-041: rolls back items, Source timestamp, and events when reconciliation fails', () => {
    const existing = item()
    database.reviewItems.save(existing)
    const failingScheduler: InitialReviewScheduler = {
      createInitialState: vi.fn(() => {
        throw new Error('FSRS_INIT_FAILED')
      })
    }
    const persistence = createDatabaseSyncPersistence(database)

    expect(() =>
      persistence.applySourceResult({
        source: source(sourceAId),
        pages: [page('abcdef', { title: 'Must roll back' }), page('new-page')],
        syncedAt,
        createReviewItemId: () => 'new-item' as ReviewItemId,
        scheduler: failingScheduler
      })
    ).toThrow('FSRS_INIT_FAILED')

    expect(database.reviewItems.findByNotionPageId('new-page')).toBeNull()
    expect(database.reviewItems.findById(existing.id)).toEqual(existing)
    expect(database.reviewSources.findById(sourceAId)?.lastSyncedAt).toBeNull()
    expect(database.syncEvents.findRecent()).toEqual([])
  })
})
