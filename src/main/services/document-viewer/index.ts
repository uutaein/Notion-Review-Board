import type { BrowserWindow, Rectangle, Shell, WebContentsView } from 'electron'
import { WebContentsView as ElectronWebContentsView } from 'electron'
import type {
  DocumentViewerBoundsDto,
  DocumentViewerOpenInputDto,
  DocumentViewerOpenResultDto,
  DocumentViewerResizeInputDto,
  DocumentViewerResizeResultDto
} from '../../../shared/document-viewer'

type WebContentsViewConstructor = typeof ElectronWebContentsView

export interface DocumentViewerController {
  open(input: DocumentViewerOpenInputDto): Promise<DocumentViewerOpenResultDto>
  openExternal(input: { url: string }): Promise<DocumentViewerOpenResultDto>
  resize(input: DocumentViewerResizeInputDto): DocumentViewerResizeResultDto
  close(): void
}

export interface ElectronDocumentViewerDependencies {
  getParentWindow: () => BrowserWindow | null
  shell: Pick<Shell, 'openExternal'>
  WebContentsViewClass?: WebContentsViewConstructor
}

const ALLOWED_NOTION_HOSTS = new Set([
  'notion.com',
  'www.notion.com',
  'app.notion.com',
  'notion.so',
  'www.notion.so',
  'notion.site'
])

export function isAllowedNotionDocumentUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return false

    const host = parsed.hostname.toLowerCase()
    return (
      ALLOWED_NOTION_HOSTS.has(host) ||
      host.endsWith('.notion.com') ||
      host.endsWith('.notion.so') ||
      host.endsWith('.notion.site')
    )
  } catch {
    return false
  }
}

export function normalizeNotionDocumentUrl(value: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('INVALID_PAYLOAD')
  }

  const trimmed = value.trim()
  if (!isAllowedNotionDocumentUrl(trimmed)) {
    throw new Error('UNSAFE_DOCUMENT_URL')
  }

  return trimmed
}

export function normalizeDocumentViewerBounds(bounds: DocumentViewerBoundsDto): Rectangle {
  const normalized = {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height)
  }

  if (
    !Number.isSafeInteger(normalized.x) ||
    !Number.isSafeInteger(normalized.y) ||
    !Number.isSafeInteger(normalized.width) ||
    !Number.isSafeInteger(normalized.height) ||
    normalized.x < 0 ||
    normalized.y < 0 ||
    normalized.width < 120 ||
    normalized.height < 120 ||
    normalized.width > 8000 ||
    normalized.height > 8000
  ) {
    throw new Error('INVALID_PAYLOAD')
  }

  return normalized
}

function isIgnorableLoadUrlError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ''
  return message.includes('ERR_ABORTED')
}

export function createElectronDocumentViewerController(
  dependencies: ElectronDocumentViewerDependencies
): DocumentViewerController {
  const WebContentsViewClass = dependencies.WebContentsViewClass ?? ElectronWebContentsView
  let viewerView: WebContentsView | null = null
  let attachedWindow: BrowserWindow | null = null

  const ensureViewerView = (): WebContentsView => {
    if (viewerView && !viewerView.webContents.isDestroyed()) {
      return viewerView
    }

    viewerView = new WebContentsViewClass({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false
      }
    })

    viewerView.webContents.on('will-navigate', (event, targetUrl) => {
      if (!isAllowedNotionDocumentUrl(targetUrl)) {
        event.preventDefault()
      }
    })

    viewerView.webContents.setWindowOpenHandler(({ url }) => {
      if (isAllowedNotionDocumentUrl(url)) {
        void viewerView?.webContents.loadURL(url).catch(() => undefined)
      }
      return { action: 'deny' }
    })

    return viewerView
  }

  const attachView = (view: WebContentsView, window: BrowserWindow): void => {
    if (attachedWindow === window) return

    if (attachedWindow && !attachedWindow.isDestroyed()) {
      attachedWindow.contentView.removeChildView(view)
    }

    window.contentView.addChildView(view)
    attachedWindow = window
  }

  return {
    async open(input) {
      const url = normalizeNotionDocumentUrl(input.url)
      const bounds = normalizeDocumentViewerBounds(input.bounds)
      const window = dependencies.getParentWindow()
      if (!window || window.isDestroyed()) {
        throw new Error('INTERNAL_ERROR')
      }
      const view = ensureViewerView()
      attachView(view, window)
      view.setBounds(bounds)
      try {
        await view.webContents.loadURL(url)
      } catch (error) {
        if (!isIgnorableLoadUrlError(error)) {
          throw error
        }
      }
      window.focus()
      return { opened: true, url }
    },
    async openExternal(input) {
      const url = normalizeNotionDocumentUrl(input.url)
      await dependencies.shell.openExternal(url)
      return { opened: true, url }
    },
    resize(input) {
      const bounds = normalizeDocumentViewerBounds(input.bounds)
      if (viewerView && !viewerView.webContents.isDestroyed()) {
        viewerView.setBounds(bounds)
      }
      return { resized: true }
    },
    close() {
      if (viewerView && attachedWindow && !attachedWindow.isDestroyed()) {
        attachedWindow.contentView.removeChildView(viewerView)
      }
      if (viewerView && !viewerView.webContents.isDestroyed()) {
        viewerView.webContents.close()
      }
      viewerView = null
      attachedWindow = null
    }
  }
}
