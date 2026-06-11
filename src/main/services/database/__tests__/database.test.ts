import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
import { createDatabaseService, type DatabaseService } from '..'

const sourceId = 'source-1' as ReviewSourceId
const itemId = 'item-1' as ReviewItemId
const now = '2026-06-11T00:00:00.000Z' as DateTimeString

function source(): ReviewSource {
  return {
    id: sourceId,
    name: 'Study',
    notionTargetId: 'target-1' as NotionTargetId,
    notionTargetUrl: null,
    notionTargetType: 'data_source',
    enabled: true,
    collectionMode: 'all',
    titlePropertyName: 'Name',
    urlPropertyName: null,
    categoryPropertyName: 'Category',
    tagPropertyName: 'Tags',
    sourcePropertyName: null,
    reviewCheckboxPropertyName: null,
    lastEditedPropertyName: null,
    filterPropertyName: null,
    filterOperator: null,
    filterValue: null,
    lastSyncedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  }
}

function item(): ReviewItem {
  return {
    id: itemId,
    notionPageId: 'ABC-DEF' as NotionPageId,
    notionUrl: 'https://www.notion.so/abcdef',
    title: 'SQLite',
    primarySourceId: sourceId,
    sourceIds: [sourceId],
    dueAt: now,
    fsrsState: { version: '1', payload: { stability: 1 } },
    status: 'active',
    category: null,
    tags: ['database'],
    originLabel: null,
    lastReviewedAt: null,
    notionLastEditedAt: null,
    lastSyncedAt: now,
    missingDetectedAt: null,
    deletedDetectedAt: null,
    createdAt: now,
    updatedAt: now
  }
}

function log(): ReviewLog {
  return {
    id: 'log-1' as ReviewLogId,
    reviewItemId: itemId,
    rating: 'good',
    reviewedAt: now,
    previousDueAt: now,
    nextDueAt: '2026-06-18T00:00:00.000Z' as DateTimeString,
    previousFsrsState: { version: '1', payload: { stability: 1 } },
    nextFsrsState: { version: '1', payload: { stability: 2 } },
    sourceId,
    category: null,
    createdAt: now
  }
}

describe('database service', () => {
  let database: DatabaseService

  beforeEach(() => {
    database = createDatabaseService(':memory:')
    database.reviewSources.save(source())
  })

  afterEach(() => database?.close())

  it('runs migrations once and persists domain values', () => {
    database.reviewItems.save(item())

    expect(database.reviewSources.findById(sourceId)).toEqual(source())
    expect(database.reviewItems.findByNotionPageId('abc-def')).toEqual({
      ...item(),
      notionPageId: 'abcdef'
    })
    expect(
      database.connection.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()
    ).toEqual({ count: 4 })
  })

  it('returns only active due items in schedule order', () => {
    database.reviewItems.save(item())
    database.reviewItems.save({
      ...item(),
      id: 'item-2' as ReviewItemId,
      notionPageId: 'page-2' as NotionPageId,
      status: 'changed',
      dueAt: '2026-06-10T00:00:00.000Z' as DateTimeString
    })

    expect(database.reviewItems.findDue(now).map(({ id }) => id)).toEqual([itemId])
  })

  it('stores a review log and scheduling update atomically', () => {
    database.reviewItems.save(item())
    const nextItem = {
      ...item(),
      dueAt: log().nextDueAt,
      lastReviewedAt: now,
      fsrsState: log().nextFsrsState
    }

    database.recordReview(nextItem, log())

    expect(database.reviewLogs.findByItemId(itemId)).toEqual([log()])
    expect(database.reviewItems.findById(itemId)).toMatchObject({
      dueAt: log().nextDueAt,
      lastReviewedAt: now,
      fsrsState: log().nextFsrsState
    })
  })

  it('rolls back both writes when the item update fails', () => {
    database.reviewItems.save(item())
    const invalidItem = { ...item(), primarySourceId: 'missing-source' as ReviewSourceId }

    expect(() => database.recordReview(invalidItem, log())).toThrow()
    expect(database.reviewLogs.findByItemId(itemId)).toEqual([])
    expect(database.reviewItems.findById(itemId)?.primarySourceId).toBe(sourceId)
  })
})
