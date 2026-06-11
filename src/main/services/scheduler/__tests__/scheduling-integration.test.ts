import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDatabaseService, type DatabaseService } from '../../database'
import { createSchedulingService } from '..'
import type { ReviewLogId } from '../../../../shared/domain/types'
import { createReviewItem, createReviewSource, itemId, reviewedAt } from './fixtures'

describe('review scheduling persistence integration', () => {
  let database: DatabaseService

  beforeEach(() => {
    database = createDatabaseService(':memory:')
    database.reviewSources.save(createReviewSource())
    database.reviewItems.save(createReviewItem())
  })

  afterEach(() => database?.close())

  it('creates exactly one log and removes a successfully reviewed item from the due query', () => {
    const service = createSchedulingService({
      engine: {
        createInitialState: () => {
          throw new Error('not used')
        },
        schedule: ({ state }) => ({
          dueAt: '2026-06-18T12:00:00.000Z',
          state: {
            version: state.version,
            payload: { ...state.payload, stability: 2.5, reps: 1 }
          }
        })
      },
      persistence: {
        findReviewItemById: (id) => database.reviewItems.findById(id),
        recordReview: (item, log) => database.recordReview(item, log)
      },
      createReviewLogId: () => 'log-1' as ReviewLogId
    })

    service.rateReview({ reviewItemId: itemId, rating: 'good', reviewedAt })

    expect(database.reviewLogs.findByItemId(itemId)).toHaveLength(1)
    expect(database.reviewItems.findDue(reviewedAt)).toEqual([])
    expect(database.reviewItems.findById(itemId)).toMatchObject({
      dueAt: '2026-06-18T12:00:00.000Z',
      lastReviewedAt: reviewedAt,
      updatedAt: reviewedAt
    })
  })
})
