import type { ReviewSourceId } from '../../shared/domain/types'
import type { ManualSyncService, SyncProgress } from '../services/synchronization'

export interface ManualSyncIpcDependencies {
  service: ManualSyncService
  ipcMain: {
    handle(
      channel: string,
      listener: (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown
    ): void
  }
  isValidSender: (event: unknown) => boolean
}

const PUBLIC_ERROR_CODES = new Set([
  'UNAUTHORIZED_SENDER',
  'INVALID_PAYLOAD',
  'SOURCE_NOT_SYNCABLE',
  'SYNC_IN_PROGRESS',
  'NO_SYNC_IN_PROGRESS'
])

function sanitizeIpcError(error: unknown): Error {
  const message = error instanceof Error ? error.message : ''
  const sanitized = new Error(PUBLIC_ERROR_CODES.has(message) ? message : 'INTERNAL_ERROR')
  sanitized.stack = ''
  return sanitized
}

function validateSourcePayload(args: unknown[]): ReviewSourceId {
  if (args.length !== 1) throw new Error('INVALID_PAYLOAD')

  const payload = args[0]
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('INVALID_PAYLOAD')
  }
  const keys = Object.keys(payload)
  if (keys.length !== 1 || keys[0] !== 'sourceId') {
    throw new Error('INVALID_PAYLOAD')
  }

  const sourceId = (payload as { sourceId?: unknown }).sourceId
  if (typeof sourceId !== 'string' || sourceId.trim() === '' || sourceId.length > 64) {
    throw new Error('INVALID_PAYLOAD')
  }
  return sourceId as ReviewSourceId
}

export function registerManualSyncIpc(dependencies: ManualSyncIpcDependencies): void {
  const { service, ipcMain, isValidSender } = dependencies
  let activeController: AbortController | null = null

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

  const runExclusive = async (
    event: unknown,
    run: (
      signal: AbortSignal,
      onProgress: (progress: SyncProgress) => void
    ) => ReturnType<ManualSyncService['syncAll']>
  ): ReturnType<ManualSyncService['syncAll']> => {
    if (activeController) throw new Error('SYNC_IN_PROGRESS')

    const controller = new AbortController()
    activeController = controller
    const onProgress = (progress: SyncProgress): void => {
      const sender = (event as { sender?: { send?: (channel: string, payload: unknown) => void } })
        .sender
      sender?.send?.('sync:progress', progress)
    }
    try {
      return await run(controller.signal, onProgress)
    } finally {
      if (activeController === controller) {
        activeController = null
      }
    }
  }

  ipcMain.handle(
    'sync:all',
    secureHandle((event, ...args) => {
      if (args.length !== 0) throw new Error('INVALID_PAYLOAD')
      return runExclusive(event, (signal, onProgress) => service.syncAll({ signal, onProgress }))
    })
  )

  ipcMain.handle(
    'sync:source',
    secureHandle((event, ...args) => {
      const sourceId = validateSourcePayload(args)
      return runExclusive(event, (signal, onProgress) =>
        service.syncSource({ sourceId, signal, onProgress })
      )
    })
  )

  ipcMain.handle(
    'sync:cancel',
    secureHandle((_event, ...args) => {
      if (args.length !== 0) throw new Error('INVALID_PAYLOAD')
      if (!activeController) throw new Error('NO_SYNC_IN_PROGRESS')

      activeController.abort()
      return { cancelled: true }
    })
  )
}
