import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDatabaseService, type DatabaseService } from '../../database'
import { createTodayReviewService } from '../index'
import type { DateTimeString, NotionPageId, ReviewItemId } from '../../../../shared/domain/types'
import { createReviewItem, createReviewSource, now } from './fixtures'

describe('Today Review SQLite integration', () => {
  let database: DatabaseService

  beforeEach(() => {
    database = createDatabaseService(':memory:')
    database.reviewSources.save(createReviewSource())
  })

  afterEach(() => database?.close())

  it('includes the whole local day and excludes future and non-active rows', () => {
    database.reviewItems.save(
      createReviewItem({
        id: 'due-late-today' as ReviewItemId,
        notionPageId: 'page-due' as NotionPageId,
        dueAt: '2026-06-11T14:59:59.999Z' as DateTimeString
      })
    )
    database.reviewItems.save(
      createReviewItem({
        id: 'future-local-day' as ReviewItemId,
        notionPageId: 'page-future' as NotionPageId,
        dueAt: '2026-06-11T15:00:00.000Z' as DateTimeString
      })
    )
    database.reviewItems.save(
      createReviewItem({
        id: 'changed' as ReviewItemId,
        notionPageId: 'page-changed' as NotionPageId,
        status: 'changed'
      })
    )
    const service = createTodayReviewService({
      reader: {
        findDue: (through) => database.reviewItems.findDue(through),
        findSourceById: (id) => database.reviewSources.findById(id)
      }
    })

    const result = service.list({ now, timeZone: 'Asia/Seoul' })

    expect(result.items.map(({ id }) => id)).toEqual(['due-late-today'])
  })

  it('removes an item after its due date moves to a future local day', () => {
    const item = createReviewItem()
    database.reviewItems.save(item)
    const service = createTodayReviewService({
      reader: {
        findDue: (through) => database.reviewItems.findDue(through),
        findSourceById: (id) => database.reviewSources.findById(id)
      }
    })

    expect(service.list({ now, timeZone: 'Asia/Seoul' }).items).toHaveLength(1)

    database.reviewItems.save({
      ...item,
      dueAt: '2026-06-12T15:00:00.000Z' as DateTimeString,
      lastReviewedAt: now,
      updatedAt: now
    })

    expect(service.list({ now, timeZone: 'Asia/Seoul' }).items).toEqual([])
  })
})
