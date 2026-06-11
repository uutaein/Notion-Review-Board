import { ReviewLogId, ReviewItemId, ReviewSourceId, DateTimeString } from './types'
import { FsrsState } from './item'

export type AppRating = 'again' | 'hard' | 'good' | 'easy'

/**
 * FSRS Rating enum mapping
 * Again = 1, Hard = 2, Good = 3, Easy = 4
 */
export const FSRS_RATING = {
  Again: 1,
  Hard: 2,
  Good: 3,
  Easy: 4
} as const

export type FsrsRatingValue = (typeof FSRS_RATING)[keyof typeof FSRS_RATING]

export interface ReviewLog {
  id: ReviewLogId
  reviewItemId: ReviewItemId
  rating: AppRating
  reviewedAt: DateTimeString
  previousDueAt: DateTimeString
  nextDueAt: DateTimeString
  previousFsrsState: FsrsState
  nextFsrsState: FsrsState
  sourceId: ReviewSourceId | null
  category: string | null
  createdAt: DateTimeString
}

/**
 * Pure function: 앱 평가값을 FSRS 평가값으로 변환
 */
export function mapAppRatingToFsrs(rating: AppRating): FsrsRatingValue {
  switch (rating) {
    case 'again':
      return FSRS_RATING.Again
    case 'hard':
      return FSRS_RATING.Hard
    case 'good':
      return FSRS_RATING.Good
    case 'easy':
      return FSRS_RATING.Easy
  }
}
