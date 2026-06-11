import type { FsrsState, ReviewItem } from '../../../shared/domain/item'
import { AppRating, mapAppRatingToFsrs, ReviewLog } from '../../../shared/domain/log'
import type { DateTimeString, ReviewItemId, ReviewLogId } from '../../../shared/domain/types'

export interface SchedulingEngine {
  createInitialState(reviewedAt: DateTimeString): FsrsState
  schedule(input: {
    state: FsrsState
    rating: number
    reviewedAt: DateTimeString
  }): { dueAt: DateTimeString; state: FsrsState }
}

export interface ReviewPersistence {
  findReviewItemById(id: ReviewItemId): ReviewItem | null
  recordReview(item: ReviewItem, log: ReviewLog): void
}

export interface SchedulingServiceDependencies {
  engine: SchedulingEngine
  persistence: ReviewPersistence
  createReviewLogId: () => ReviewLogId
}

export interface RateReviewInput {
  reviewItemId: ReviewItemId
  rating: AppRating
  reviewedAt: DateTimeString
}

export interface RateReviewResult {
  item: ReviewItem
  log: ReviewLog
}

export interface SchedulingService {
  rateReview(input: RateReviewInput): RateReviewResult
}

export function createSchedulingService(
  dependencies: SchedulingServiceDependencies
): SchedulingService {
  const { engine, persistence, createReviewLogId } = dependencies

  return {
    rateReview({ reviewItemId, rating, reviewedAt }: RateReviewInput): RateReviewResult {
      // 1. Validate reviewedAt timestamp (must be valid ISO 8601 UTC format YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DDTHH:mm:ssZ)
      const isoUtcRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/
      if (!isoUtcRegex.test(reviewedAt) || isNaN(Date.parse(reviewedAt))) {
        throw new Error('Invalid review date format. Expected ISO 8601 UTC format (e.g. YYYY-MM-DDTHH:mm:ss.sssZ)')
      }

      // 2. Retrieve the item
      const item = persistence.findReviewItemById(reviewItemId)
      if (!item) {
        throw new Error(`Review item not found: ${reviewItemId}`)
      }

      // 3. Validate item eligibility (must be 'active')
      if (item.status !== 'active') {
        throw new Error(`Review item is not active (status: ${item.status})`)
      }

      const previousFsrsState = structuredClone(item.fsrsState)
      const previousDueAt = item.dueAt

      // 4. Map the app rating to FSRS rating value
      const fsrsRating = mapAppRatingToFsrs(rating)

      // 5. Calculate the next FSRS state (clone state to protect the snapshot from mutation)
      const { dueAt: nextDueAt, state: nextFsrsState } = engine.schedule({
        state: structuredClone(previousFsrsState),
        rating: fsrsRating,
        reviewedAt
      })

      // 6. Construct the updated item
      const updatedItem: ReviewItem = {
        ...item,
        dueAt: nextDueAt,
        fsrsState: nextFsrsState,
        lastReviewedAt: reviewedAt,
        updatedAt: reviewedAt
      }

      // 7. Construct the review log
      const log: ReviewLog = {
        id: createReviewLogId(),
        reviewItemId,
        rating,
        reviewedAt,
        previousDueAt,
        nextDueAt,
        previousFsrsState,
        nextFsrsState,
        sourceId: item.primarySourceId,
        category: item.category,
        createdAt: reviewedAt
      }

      // 8. Persist the changes
      persistence.recordReview(updatedItem, log)

      return {
        item: updatedItem,
        log
      }
    }
  }
}
