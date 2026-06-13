import type { AppRating } from '../../shared/domain/log'
import type { DateTimeString, ReviewItemId } from '../../shared/domain/types'
import type { RateReviewResultDto } from '../../shared/review-rating'
import type { SchedulingService } from '../services/scheduler'

export interface ReviewRatingIpcDependencies {
  service: SchedulingService
  ipcMain: {
    handle(
      channel: string,
      listener: (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown
    ): void
  }
  isValidSender: (event: unknown) => boolean
  now?: () => string
}

const PUBLIC_ERROR_CODES = new Set([
  'UNAUTHORIZED_SENDER',
  'INVALID_PAYLOAD',
  'REVIEW_ITEM_NOT_FOUND',
  'REVIEW_ITEM_NOT_ACTIVE'
])

function publicErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (PUBLIC_ERROR_CODES.has(message)) return message
  if (message.startsWith('Review item not found:')) return 'REVIEW_ITEM_NOT_FOUND'
  if (message.startsWith('Review item is not active')) return 'REVIEW_ITEM_NOT_ACTIVE'
  if (message.startsWith('Invalid review date format')) return 'INVALID_PAYLOAD'
  return 'INTERNAL_ERROR'
}

function sanitizeIpcError(error: unknown): Error {
  const sanitized = new Error(publicErrorCode(error))
  sanitized.stack = ''
  return sanitized
}

function validateRatePayload(args: unknown[]): { reviewItemId: ReviewItemId; rating: AppRating } {
  if (args.length !== 1) throw new Error('INVALID_PAYLOAD')

  const payload = args[0]
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('INVALID_PAYLOAD')
  }

  const keys = Object.keys(payload)
  if (keys.length !== 2 || !keys.includes('reviewItemId') || !keys.includes('rating')) {
    throw new Error('INVALID_PAYLOAD')
  }

  const reviewItemId = (payload as { reviewItemId?: unknown }).reviewItemId
  if (typeof reviewItemId !== 'string' || reviewItemId.trim() === '' || reviewItemId.length > 128) {
    throw new Error('INVALID_PAYLOAD')
  }

  const rating = (payload as { rating?: unknown }).rating
  if (rating !== 'again' && rating !== 'hard' && rating !== 'good' && rating !== 'easy') {
    throw new Error('INVALID_PAYLOAD')
  }

  return { reviewItemId: reviewItemId as ReviewItemId, rating }
}

export function registerReviewRatingIpc(dependencies: ReviewRatingIpcDependencies): void {
  const { service, ipcMain, isValidSender, now } = dependencies

  const secureHandle =
    (handler: (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown) =>
    async (event: unknown, ...args: unknown[]): Promise<unknown> => {
      try {
        if (!isValidSender(event)) throw new Error('UNAUTHORIZED_SENDER')
        return await handler(event, ...args)
      } catch (error) {
        throw sanitizeIpcError(error)
      }
    }

  ipcMain.handle(
    'review:rate',
    secureHandle((_event, ...args): RateReviewResultDto => {
      const payload = validateRatePayload(args)
      const result = service.rateReview({
        reviewItemId: payload.reviewItemId,
        rating: payload.rating,
        reviewedAt: (now ? now() : new Date().toISOString()) as DateTimeString
      })

      return {
        itemId: result.item.id,
        nextDueAt: result.item.dueAt,
        reviewedAt: result.log.reviewedAt
      }
    })
  )
}
