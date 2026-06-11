import { describe, expect, it, vi } from 'vitest'
import type { FsrsState, ReviewItem } from '../../../../shared/domain/item'
import { FSRS_RATING, type ReviewLog } from '../../../../shared/domain/log'
import type { DateTimeString, ReviewItemId, ReviewLogId } from '../../../../shared/domain/types'
import { createSchedulingService, type ReviewPersistence, type SchedulingEngine } from '..'
import { createReviewItem, itemId, reviewedAt } from './fixtures'

const nextDueAt = '2026-06-18T12:00:00.000Z' as DateTimeString
const nextState: FsrsState = {
  version: 'ts-fsrs@test',
  payload: {
    due: nextDueAt,
    stability: 2.5,
    difficulty: 4.8,
    elapsed_days: 0,
    scheduled_days: 7,
    reps: 1,
    lapses: 0,
    state: 1,
    last_review: reviewedAt
  }
}

function createDependencies(item: ReviewItem | null = createReviewItem()): {
  engine: SchedulingEngine
  persistence: ReviewPersistence
  recordReview: ReturnType<typeof vi.fn<(item: ReviewItem, log: ReviewLog) => void>>
} {
  const recordReview = vi.fn<(item: ReviewItem, log: ReviewLog) => void>()
  return {
    engine: {
      createInitialState: vi.fn(),
      schedule: vi.fn(() => ({
        dueAt: nextDueAt,
        state: structuredClone(nextState)
      }))
    },
    persistence: {
      findReviewItemById: vi.fn(() => item),
      recordReview
    },
    recordReview
  }
}

describe('SchedulingService', () => {
  it.each([
    ['again', FSRS_RATING.Again],
    ['hard', FSRS_RATING.Hard],
    ['good', FSRS_RATING.Good],
    ['easy', FSRS_RATING.Easy]
  ] as const)('maps %s to the expected FSRS rating', (rating, expectedFsrsRating) => {
    const dependencies = createDependencies()
    const service = createSchedulingService({
      ...dependencies,
      createReviewLogId: () => 'log-1' as ReviewLogId
    })

    service.rateReview({ reviewItemId: itemId, rating, reviewedAt })

    expect(dependencies.engine.schedule).toHaveBeenCalledWith({
      state: createReviewItem().fsrsState,
      rating: expectedFsrsRating,
      reviewedAt
    })
  })

  it('updates only scheduling fields and records complete before/after snapshots', () => {
    const originalItem = createReviewItem()
    const dependencies = createDependencies(originalItem)
    const service = createSchedulingService({
      ...dependencies,
      createReviewLogId: () => 'log-1' as ReviewLogId
    })

    const result = service.rateReview({
      reviewItemId: itemId,
      rating: 'good',
      reviewedAt
    })

    expect(result.item).toEqual({
      ...originalItem,
      dueAt: nextDueAt,
      fsrsState: nextState,
      lastReviewedAt: reviewedAt,
      updatedAt: reviewedAt
    })
    expect(result.log).toEqual({
      id: 'log-1',
      reviewItemId: itemId,
      rating: 'good',
      reviewedAt,
      previousDueAt: originalItem.dueAt,
      nextDueAt,
      previousFsrsState: originalItem.fsrsState,
      nextFsrsState: nextState,
      sourceId: originalItem.primarySourceId,
      category: originalItem.category,
      createdAt: reviewedAt
    })
    expect(dependencies.recordReview).toHaveBeenCalledOnce()
    expect(dependencies.recordReview).toHaveBeenCalledWith(result.item, result.log)
  })

  it('preserves the previous FSRS snapshot even if an adapter mutates its input', () => {
    const originalItem = createReviewItem()
    const previousState = structuredClone(originalItem.fsrsState)
    const dependencies = createDependencies(originalItem)
    dependencies.engine.schedule = vi.fn(({ state }) => {
      state.payload.stability = 999
      return { dueAt: nextDueAt, state: structuredClone(nextState) }
    })
    const service = createSchedulingService({
      ...dependencies,
      createReviewLogId: () => 'log-1' as ReviewLogId
    })

    const result = service.rateReview({
      reviewItemId: itemId,
      rating: 'good',
      reviewedAt
    })

    expect(result.log.previousFsrsState).toEqual(previousState)
    expect(originalItem.fsrsState).toEqual(previousState)
  })

  it('rejects a missing review item before scheduling or persistence', () => {
    const dependencies = createDependencies(null)
    const service = createSchedulingService({
      ...dependencies,
      createReviewLogId: () => 'log-1' as ReviewLogId
    })

    expect(() =>
      service.rateReview({
        reviewItemId: 'missing-item' as ReviewItemId,
        rating: 'good',
        reviewedAt
      })
    ).toThrow(/not found/i)
    expect(dependencies.engine.schedule).not.toHaveBeenCalled()
    expect(dependencies.recordReview).not.toHaveBeenCalled()
  })

  it.each(['changed', 'missing', 'deleted', 'sync_error', 'archived'] as const)(
    'rejects a %s item because it is not eligible for Today Review',
    (status) => {
      const dependencies = createDependencies(createReviewItem({ status }))
      const service = createSchedulingService({
        ...dependencies,
        createReviewLogId: () => 'log-1' as ReviewLogId
      })

      expect(() =>
        service.rateReview({
          reviewItemId: itemId,
          rating: 'good',
          reviewedAt
        })
      ).toThrow(/active/i)
      expect(dependencies.engine.schedule).not.toHaveBeenCalled()
      expect(dependencies.recordReview).not.toHaveBeenCalled()
    }
  )

  it('does not persist anything when FSRS calculation fails', () => {
    const dependencies = createDependencies()
    dependencies.engine.schedule = vi.fn(() => {
      throw new Error('FSRS calculation failed')
    })
    const service = createSchedulingService({
      ...dependencies,
      createReviewLogId: () => 'log-1' as ReviewLogId
    })

    expect(() =>
      service.rateReview({
        reviewItemId: itemId,
        rating: 'good',
        reviewedAt
      })
    ).toThrow('FSRS calculation failed')
    expect(dependencies.recordReview).not.toHaveBeenCalled()
  })

  it('surfaces persistence failure without reporting a successful outcome', () => {
    const dependencies = createDependencies()
    dependencies.recordReview.mockImplementation(() => {
      throw new Error('database unavailable')
    })
    const service = createSchedulingService({
      ...dependencies,
      createReviewLogId: () => 'log-1' as ReviewLogId
    })

    expect(() =>
      service.rateReview({
        reviewItemId: itemId,
        rating: 'good',
        reviewedAt
      })
    ).toThrow('database unavailable')
    expect(dependencies.recordReview).toHaveBeenCalledOnce()
  })

  it('rejects an invalid review time before calling the engine', () => {
    const dependencies = createDependencies()
    const service = createSchedulingService({
      ...dependencies,
      createReviewLogId: () => 'log-1' as ReviewLogId
    })

    expect(() =>
      service.rateReview({
        reviewItemId: itemId,
        rating: 'good',
        reviewedAt: 'not-a-date' as DateTimeString
      })
    ).toThrow(/date/i)
    expect(dependencies.engine.schedule).not.toHaveBeenCalled()
    expect(dependencies.recordReview).not.toHaveBeenCalled()
  })
})
