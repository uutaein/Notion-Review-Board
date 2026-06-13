import type { AppRating } from './domain/log'

export type ReviewRating = AppRating

export interface RateReviewInputDto {
  reviewItemId: string
  rating: ReviewRating
}

export interface RateReviewResultDto {
  itemId: string
  nextDueAt: string
  reviewedAt: string
}
