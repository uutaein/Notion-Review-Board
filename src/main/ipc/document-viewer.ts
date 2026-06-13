import type {
  DocumentViewerBoundsDto,
  DocumentViewerCloseResultDto,
  DocumentViewerOpenInputDto,
  DocumentViewerOpenResultDto,
  DocumentViewerResizeInputDto,
  DocumentViewerResizeResultDto
} from '../../shared/document-viewer'
import type { DocumentViewerController } from '../services/document-viewer'

export interface DocumentViewerIpcDependencies {
  controller: DocumentViewerController
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
  'UNSAFE_DOCUMENT_URL'
])

function sanitizeIpcError(error: unknown): Error {
  const message = error instanceof Error ? error.message : ''
  const sanitized = new Error(PUBLIC_ERROR_CODES.has(message) ? message : 'INTERNAL_ERROR')
  sanitized.stack = ''
  return sanitized
}

function validateBoundsPayload(bounds: unknown): DocumentViewerBoundsDto {
  if (!bounds || typeof bounds !== 'object' || Array.isArray(bounds)) {
    throw new Error('INVALID_PAYLOAD')
  }

  const keys = Object.keys(bounds)
  if (
    keys.length !== 4 ||
    !keys.includes('x') ||
    !keys.includes('y') ||
    !keys.includes('width') ||
    !keys.includes('height')
  ) {
    throw new Error('INVALID_PAYLOAD')
  }

  const input = bounds as Record<string, unknown>
  if (
    typeof input.x !== 'number' ||
    typeof input.y !== 'number' ||
    typeof input.width !== 'number' ||
    typeof input.height !== 'number' ||
    !Number.isFinite(input.x) ||
    !Number.isFinite(input.y) ||
    !Number.isFinite(input.width) ||
    !Number.isFinite(input.height)
  ) {
    throw new Error('INVALID_PAYLOAD')
  }

  return {
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height
  }
}

function validateOpenPayload(args: unknown[]): DocumentViewerOpenInputDto {
  if (args.length !== 1) throw new Error('INVALID_PAYLOAD')

  const payload = args[0]
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('INVALID_PAYLOAD')
  }

  const keys = Object.keys(payload)
  if (keys.length !== 2 || !keys.includes('url') || !keys.includes('bounds')) {
    throw new Error('INVALID_PAYLOAD')
  }

  const url = (payload as { url?: unknown }).url
  if (typeof url !== 'string' || url.trim() === '' || url.length > 4096) {
    throw new Error('INVALID_PAYLOAD')
  }

  return { url, bounds: validateBoundsPayload((payload as { bounds?: unknown }).bounds) }
}

function validateExternalPayload(args: unknown[]): { url: string } {
  if (args.length !== 1) throw new Error('INVALID_PAYLOAD')

  const payload = args[0]
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('INVALID_PAYLOAD')
  }

  const keys = Object.keys(payload)
  if (keys.length !== 1 || keys[0] !== 'url') {
    throw new Error('INVALID_PAYLOAD')
  }

  const url = (payload as { url?: unknown }).url
  if (typeof url !== 'string' || url.trim() === '' || url.length > 4096) {
    throw new Error('INVALID_PAYLOAD')
  }

  return { url }
}

function validateResizePayload(args: unknown[]): DocumentViewerResizeInputDto {
  if (args.length !== 1) throw new Error('INVALID_PAYLOAD')

  const payload = args[0]
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('INVALID_PAYLOAD')
  }

  const keys = Object.keys(payload)
  if (keys.length !== 1 || keys[0] !== 'bounds') {
    throw new Error('INVALID_PAYLOAD')
  }

  return { bounds: validateBoundsPayload((payload as { bounds?: unknown }).bounds) }
}

export function registerDocumentViewerIpc(dependencies: DocumentViewerIpcDependencies): void {
  const { controller, ipcMain, isValidSender } = dependencies

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
    'document-viewer:open',
    secureHandle((_event, ...args): Promise<DocumentViewerOpenResultDto> => {
      const payload = validateOpenPayload(args)
      return controller.open(payload)
    })
  )

  ipcMain.handle(
    'document-viewer:open-external',
    secureHandle((_event, ...args): Promise<DocumentViewerOpenResultDto> => {
      const payload = validateExternalPayload(args)
      return controller.openExternal(payload)
    })
  )

  ipcMain.handle(
    'document-viewer:close',
    secureHandle((_event, ...args): DocumentViewerCloseResultDto => {
      if (args.length !== 0) throw new Error('INVALID_PAYLOAD')
      controller.close()
      return { closed: true }
    })
  )

  ipcMain.handle(
    'document-viewer:resize',
    secureHandle((_event, ...args): DocumentViewerResizeResultDto => {
      const payload = validateResizePayload(args)
      return controller.resize(payload)
    })
  )
}
