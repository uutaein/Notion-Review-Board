/**
 * @file index.ts (Scheduler Service)
 * @description Provides the application service orchestrating review rating actions,
 * validation, database scheduling calculations via the FSRS engine, and transactional logging.
 *
 * Implements SRS-FR-070 and SRS-FR-071.
 */

import type { FsrsState, ReviewItem } from '../../../shared/domain/item'
import { AppRating, mapAppRatingToFsrs, ReviewLog } from '../../../shared/domain/log'
import type { DateTimeString, ReviewItemId, ReviewLogId } from '../../../shared/domain/types'

/**
 * Representation of the FSRS scheduling math core engine.
 */
export interface SchedulingEngine {
  /**
   * Generates a new FSRS state initialized at the given review time.
   *
   * @param reviewedAt - The initial review date string.
   * @returns The initial FsrsState payload.
   */
  createInitialState(reviewedAt: DateTimeString): FsrsState

  /**
   * Calculates the next review date and stability/difficulty multipliers.
   *
   * @param input - The calculation inputs (previous state, rating, reviewedAt time).
   * @returns The updated dueAt timestamp and FsrsState payload.
   */
  schedule(input: {
    state: FsrsState
    rating: number
    reviewedAt: DateTimeString
  }): { dueAt: DateTimeString; state: FsrsState }
}

/**
 * Interface mapping persistence transactions for reviews.
 */
export interface ReviewPersistence {
  /**
   * Resolves a review item record by its unique ID.
   *
   * @param id - The ID of the review item.
   * @returns The ReviewItem if found, otherwise null.
   */
  findReviewItemById(id: ReviewItemId): ReviewItem | null

  /**
   * Saves both the updated review scheduling properties and a complete history log.
   *
   * @param item - The updated review item.
   * @param log - The historical review log.
   */
  recordReview(item: ReviewItem, log: ReviewLog): void
}

/**
 * External dependencies needed by the scheduling service.
 */
export interface SchedulingServiceDependencies {
  /** The FSRS algorithm adapter engine */
  engine: SchedulingEngine
  /** The persistence/database coordinator */
  persistence: ReviewPersistence
  /** ID factory to generate unique logging records */
  createReviewLogId: () => ReviewLogId
}

/**
 * Input parameters to rate a review session.
 */
export interface RateReviewInput {
  /** The target review item's database ID */
  reviewItemId: ReviewItemId
  /** The user's input rating (again, hard, good, easy) */
  rating: AppRating
  /** The exact timestamp when the rating was submitted in ISO 8601 UTC format */
  reviewedAt: DateTimeString
}

/**
 * The response payload containing transaction outcomes.
 */
export interface RateReviewResult {
  /** The updated ReviewItem instance containing the next due date and FSRS multipliers */
  item: ReviewItem
  /** The completed historical log of this specific review session */
  log: ReviewLog
}

/**
 * The main service interface for review ratings and spaced repetition calculations.
 */
export interface SchedulingService {
  /**
   * Evaluates a review action, runs FSRS calculations, updates item schedules,
   * generates history logs, and writes to database atomically.
   */
  rateReview(input: RateReviewInput): RateReviewResult
}

/**
 * Factory function to instantiate the scheduling application service.
 *
 * Implements business validation rules, ensures snapshot isolation by deep-cloning
 * FSRS state variables before passing them to external calculation libraries,
 * and coordinates database writes.
 *
 * @param dependencies - Infrastructure dependencies.
 * @returns An implementation of the SchedulingService.
 */
export function createSchedulingService(
  dependencies: SchedulingServiceDependencies
): SchedulingService {
  const { engine, persistence, createReviewLogId } = dependencies

  return {
    rateReview({ reviewItemId, rating, reviewedAt }: RateReviewInput): RateReviewResult {
      // 1. Validate the reviewedAt timestamp format (Must be strict ISO 8601 UTC)
      const isoUtcRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/
      if (!isoUtcRegex.test(reviewedAt) || isNaN(Date.parse(reviewedAt))) {
        throw new Error('Invalid review date format. Expected ISO 8601 UTC format (e.g. YYYY-MM-DDTHH:mm:ss.sssZ)')
      }

      // 2. Retrieve the target review item
      const item = persistence.findReviewItemById(reviewItemId)
      if (!item) {
        throw new Error(`Review item not found: ${reviewItemId}`)
      }

      // 3. Confirm target item is active (archived or error status items are ineligible)
      if (item.status !== 'active') {
        throw new Error(`Review item is not active (status: ${item.status})`)
      }

      // Snapshot the initial states before invoking the engine to prevent state contamination
      const previousFsrsState = structuredClone(item.fsrsState)
      const previousDueAt = item.dueAt

      // 4. Translate the user's app rating into numeric FSRS grades (1-4)
      const fsrsRating = mapAppRatingToFsrs(rating)

      // 5. Compute the next review date and schedule properties using the engine.
      //    We structuredClone the input state to defend against calculation modules that mutate parameters.
      const { dueAt: nextDueAt, state: nextFsrsState } = engine.schedule({
        state: structuredClone(previousFsrsState),
        rating: fsrsRating,
        reviewedAt
      })

      // 6. Construct the new ReviewItem domain record
      const updatedItem: ReviewItem = {
        ...item,
        dueAt: nextDueAt,
        fsrsState: nextFsrsState,
        lastReviewedAt: reviewedAt,
        updatedAt: reviewedAt
      }

      // 7. Construct a detailed review log record (SRS-FR-071)
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

      // 8. Commit both the updated item and logging record to storage atomically
      persistence.recordReview(updatedItem, log)

      return {
        item: updatedItem,
        log
      }
    }
  }
}
