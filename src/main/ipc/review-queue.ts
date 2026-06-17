import type { ReviewQueueService } from '../services/review'

export interface ReviewQueueIpcDependencies {
  service: ReviewQueueService
  ipcMain: {
    handle(
      channel: string,
      listener: (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown
    ): void
  }
  isValidSender: (event: unknown) => boolean
}

const PUBLIC_ERROR_CODES = new Set(['UNAUTHORIZED_SENDER', 'INVALID_PAYLOAD'])

function sanitizeIpcError(error: unknown): Error {
  const message = error instanceof Error ? error.message : ''
  const sanitized = new Error(PUBLIC_ERROR_CODES.has(message) ? message : 'INTERNAL_ERROR')
  sanitized.stack = ''
  return sanitized
}

function validateNoPayload(args: unknown[]): void {
  if (args.length !== 0) throw new Error('INVALID_PAYLOAD')
}

export function registerReviewQueueIpc(dependencies: ReviewQueueIpcDependencies): void {
  const { service, ipcMain, isValidSender } = dependencies

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
    'review-queue:list',
    secureHandle((_event, ...args) => {
      validateNoPayload(args)
      return service.list()
    })
  )
}
