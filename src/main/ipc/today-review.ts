import type { TodayReviewService, TodayReviewSort } from '../services/review'
import type { DateTimeString } from '../../shared/domain/types'

export interface TodayReviewIpcDependencies {
  service: TodayReviewService
  ipcMain: {
    handle(
      channel: string,
      listener: (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown
    ): void
  }
  isValidSender: (event: unknown) => boolean
  now?: () => string
  timeZone?: string
}

const PUBLIC_ERROR_CODES = new Set(['UNAUTHORIZED_SENDER', 'INVALID_PAYLOAD'])

function sanitizeIpcError(error: unknown): Error {
  const message = error instanceof Error ? error.message : ''
  const sanitized = new Error(PUBLIC_ERROR_CODES.has(message) ? message : 'INTERNAL_ERROR')
  sanitized.stack = ''
  return sanitized
}

function validateListPayload(args: unknown[]): { sort?: TodayReviewSort } {
  if (args.length === 0) return {}
  if (args.length !== 1) throw new Error('INVALID_PAYLOAD')

  const payload = args[0]
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('INVALID_PAYLOAD')
  }

  const keys = Object.keys(payload)
  if (keys.some((key) => key !== 'sort')) {
    throw new Error('INVALID_PAYLOAD')
  }

  const sort = (payload as { sort?: unknown }).sort
  if (sort === undefined) return {}
  if (sort !== 'due' && sort !== 'random') {
    throw new Error('INVALID_PAYLOAD')
  }

  return { sort }
}

export function registerTodayReviewIpc(dependencies: TodayReviewIpcDependencies): void {
  const { service, ipcMain, isValidSender, now, timeZone = 'Asia/Seoul' } = dependencies

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
    'review:list-today',
    secureHandle((_event, ...args) => {
      const payload = validateListPayload(args)
      return service.list({
        now: (now ? now() : new Date().toISOString()) as DateTimeString,
        timeZone,
        sort: payload.sort
      })
    })
  )
}
