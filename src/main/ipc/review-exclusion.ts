import type { DateTimeString, ReviewItemId } from '../../shared/domain/types'
import type {
  ExcludeReviewItemInputDto,
  ExcludeReviewItemResultDto
} from '../../shared/review-exclusion'
import type { ReviewExclusionService } from '../services/review'

export interface ReviewExclusionIpcDependencies {
  service: ReviewExclusionService
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

function sanitizeIpcError(error: unknown): Error {
  const message = error instanceof Error ? error.message : ''
  const sanitized = new Error(PUBLIC_ERROR_CODES.has(message) ? message : 'INTERNAL_ERROR')
  sanitized.stack = ''
  return sanitized
}

function validateExcludePayload(args: unknown[]): ExcludeReviewItemInputDto {
  if (args.length !== 1) throw new Error('INVALID_PAYLOAD')

  const payload = args[0]
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('INVALID_PAYLOAD')
  }

  const keys = Object.keys(payload)
  if (keys.length !== 1 || keys[0] !== 'reviewItemId') {
    throw new Error('INVALID_PAYLOAD')
  }

  const reviewItemId = (payload as { reviewItemId?: unknown }).reviewItemId
  if (typeof reviewItemId !== 'string' || reviewItemId.trim() === '' || reviewItemId.length > 128) {
    throw new Error('INVALID_PAYLOAD')
  }

  return { reviewItemId }
}

export function registerReviewExclusionIpc(dependencies: ReviewExclusionIpcDependencies): void {
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
    'review:exclude',
    secureHandle((_event, ...args): ExcludeReviewItemResultDto => {
      const payload = validateExcludePayload(args)
      return service.exclude({
        reviewItemId: payload.reviewItemId as ReviewItemId,
        excludedAt: (now ? now() : new Date().toISOString()) as DateTimeString
      })
    })
  )
}
