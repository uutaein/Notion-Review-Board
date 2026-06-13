import type { BrowserWindow, Shell } from 'electron'
import { BrowserWindow as ElectronBrowserWindow } from 'electron'
import type {
  DocumentViewerOpenInputDto,
  DocumentViewerOpenResultDto
} from '../../../shared/document-viewer'

type BrowserWindowConstructor = typeof ElectronBrowserWindow

export interface DocumentViewerController {
  open(input: DocumentViewerOpenInputDto): Promise<DocumentViewerOpenResultDto>
  openExternal(input: DocumentViewerOpenInputDto): Promise<DocumentViewerOpenResultDto>
  close(): void
}

export interface ElectronDocumentViewerDependencies {
  getParentWindow: () => BrowserWindow | null
  shell: Pick<Shell, 'openExternal'>
  BrowserWindowClass?: BrowserWindowConstructor
}

const ALLOWED_NOTION_HOSTS = new Set(['notion.so', 'www.notion.so', 'notion.site'])

export function isAllowedNotionDocumentUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return false

    const host = parsed.hostname.toLowerCase()
    return (
      ALLOWED_NOTION_HOSTS.has(host) || host.endsWith('.notion.so') || host.endsWith('.notion.site')
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

function isIgnorableLoadUrlError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ''
  return message.includes('ERR_ABORTED')
}

export function createElectronDocumentViewerController(
  dependencies: ElectronDocumentViewerDependencies
): DocumentViewerController {
  const BrowserWindowClass = dependencies.BrowserWindowClass ?? ElectronBrowserWindow
  let viewerWindow: BrowserWindow | null = null

  const ensureViewerWindow = (): BrowserWindow => {
    if (viewerWindow && !viewerWindow.isDestroyed()) {
      return viewerWindow
    }

    const parent = dependencies.getParentWindow()
    viewerWindow = new BrowserWindowClass({
      parent: parent ?? undefined,
      width: 1120,
      height: 820,
      minWidth: 720,
      minHeight: 520,
      show: false,
      autoHideMenuBar: true,
      title: 'Notion 문서',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false
      }
    })

    viewerWindow.on('closed', () => {
      viewerWindow = null
    })

    viewerWindow.webContents.on('will-navigate', (event, targetUrl) => {
      if (!isAllowedNotionDocumentUrl(targetUrl)) {
        event.preventDefault()
      }
    })

    viewerWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (isAllowedNotionDocumentUrl(url)) {
        void viewerWindow?.loadURL(url).catch(() => undefined)
      }
      return { action: 'deny' }
    })

    viewerWindow.once('ready-to-show', () => {
      viewerWindow?.show()
    })

    return viewerWindow
  }

  return {
    async open(input) {
      const url = normalizeNotionDocumentUrl(input.url)
      const window = ensureViewerWindow()
      try {
        await window.loadURL(url)
      } catch (error) {
        if (!isIgnorableLoadUrlError(error)) {
          throw error
        }
      }
      if (!window.isVisible()) window.show()
      window.focus()
      return { opened: true, url }
    },
    async openExternal(input) {
      const url = normalizeNotionDocumentUrl(input.url)
      await dependencies.shell.openExternal(url)
      return { opened: true, url }
    },
    close() {
      if (viewerWindow && !viewerWindow.isDestroyed()) {
        viewerWindow.close()
      }
      viewerWindow = null
    }
  }
}
