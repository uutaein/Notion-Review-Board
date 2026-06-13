import type { ChangedPageAction, StatusPageKind } from '../../shared/status-pages'
import type { DateTimeString, ReviewItemId } from '../../shared/domain/types'
import type { StatusPageService } from '../services/status-pages'

export interface StatusPagesIpcDependencies {
  service: StatusPageService
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
  'STATUS_ITEM_NOT_FOUND',
  'STATUS_ITEM_NOT_CHANGED'
])

function sanitizeIpcError(error: unknown): Error {
  const message = error instanceof Error ? error.message : ''
  const sanitized = new Error(PUBLIC_ERROR_CODES.has(message) ? message : 'INTERNAL_ERROR')
  sanitized.stack = ''
  return sanitized
}

function validateListPayload(args: unknown[]): { kind: StatusPageKind } {
  if (args.length !== 1) throw new Error('INVALID_PAYLOAD')

  const payload = args[0]
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('INVALID_PAYLOAD')
  }

  const keys = Object.keys(payload)
  if (keys.length !== 1 || keys[0] !== 'kind') {
    throw new Error('INVALID_PAYLOAD')
  }

  const kind = (payload as { kind?: unknown }).kind
  if (kind !== 'changed' && kind !== 'missing-deleted') {
    throw new Error('INVALID_PAYLOAD')
  }

  return { kind }
}

function validateHandleChangedPayload(args: unknown[]): {
  reviewItemId: ReviewItemId
  action: ChangedPageAction
} {
  if (args.length !== 1) throw new Error('INVALID_PAYLOAD')

  const payload = args[0]
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('INVALID_PAYLOAD')
  }

  const keys = Object.keys(payload)
  if (keys.length !== 2 || !keys.includes('reviewItemId') || !keys.includes('action')) {
    throw new Error('INVALID_PAYLOAD')
  }

  const reviewItemId = (payload as { reviewItemId?: unknown }).reviewItemId
  if (typeof reviewItemId !== 'string' || reviewItemId.trim() === '' || reviewItemId.length > 128) {
    throw new Error('INVALID_PAYLOAD')
  }

  const action = (payload as { action?: unknown }).action
  if (action !== 'pull-today' && action !== 'keep-schedule') {
    throw new Error('INVALID_PAYLOAD')
  }

  return { reviewItemId: reviewItemId as ReviewItemId, action }
}

export function registerStatusPagesIpc(dependencies: StatusPagesIpcDependencies): void {
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
    'status-pages:list',
    secureHandle((_event, ...args) => {
      const payload = validateListPayload(args)
      return service.list(payload)
    })
  )

  ipcMain.handle(
    'status-pages:handle-changed',
    secureHandle((_event, ...args) => {
      const payload = validateHandleChangedPayload(args)
      return service.handleChanged({
        ...payload,
        handledAt: (now ? now() : new Date().toISOString()) as DateTimeString
      })
    })
  )
}
