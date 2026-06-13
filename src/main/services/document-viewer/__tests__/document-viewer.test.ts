import { describe, expect, it, vi } from 'vitest'
import {
  createElectronDocumentViewerController,
  isAllowedNotionDocumentUrl,
  normalizeNotionDocumentUrl
} from '..'

describe('Document Viewer URL policy', () => {
  it.each([
    'https://www.notion.so/workspace/Page-abc123',
    'https://notion.so/workspace/Page-abc123',
    'https://workspace.notion.site/Page-abc123'
  ])('allows Notion HTTPS URL %s', (url) => {
    expect(isAllowedNotionDocumentUrl(url)).toBe(true)
    expect(normalizeNotionDocumentUrl(` ${url} `)).toBe(url)
  })

  it.each([
    'http://www.notion.so/workspace/Page-abc123',
    'https://example.com/page',
    'https://notion.so.evil.test/page',
    'file:///C:/secret.txt',
    'not a url'
  ])('rejects unsafe document URL %s', (url) => {
    expect(isAllowedNotionDocumentUrl(url)).toBe(false)
    expect(() => normalizeNotionDocumentUrl(url)).toThrow('UNSAFE_DOCUMENT_URL')
  })

  it('opens the internal viewer without a preload or Node integration', async () => {
    const loadURL = vi.fn().mockResolvedValue(undefined)
    const show = vi.fn()
    const focus = vi.fn()
    const handlers: Record<string, (...args: unknown[]) => void> = {}
    const window = {
      isDestroyed: vi.fn().mockReturnValue(false),
      isVisible: vi.fn().mockReturnValue(false),
      loadURL,
      show,
      focus,
      close: vi.fn(),
      on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        handlers[event] = listener
      }),
      once: vi.fn(),
      webContents: {
        on: vi.fn(),
        setWindowOpenHandler: vi.fn()
      }
    }
    let createdOptions: unknown = null
    class FakeBrowserWindow {
      constructor(options: unknown) {
        createdOptions = options
        return window
      }
    }
    const controller = createElectronDocumentViewerController({
      getParentWindow: () => null,
      shell: { openExternal: vi.fn() },
      BrowserWindowClass: FakeBrowserWindow as never
    })

    await expect(
      controller.open({ url: 'https://www.notion.so/workspace/Page-abc123' })
    ).resolves.toEqual({
      opened: true,
      url: 'https://www.notion.so/workspace/Page-abc123'
    })

    expect(createdOptions).toEqual(
      expect.objectContaining({
        webPreferences: expect.objectContaining({
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
          allowRunningInsecureContent: false
        })
      })
    )
    expect(
      (createdOptions as { webPreferences: Record<string, unknown> }).webPreferences
    ).not.toHaveProperty('preload')
    expect(loadURL).toHaveBeenCalledWith('https://www.notion.so/workspace/Page-abc123')
    expect(show).toHaveBeenCalled()
    expect(focus).toHaveBeenCalled()
  })

  it('treats Electron redirect aborts as an opened internal viewer', async () => {
    const loadURL = vi.fn().mockRejectedValue(new Error('ERR_ABORTED (-3) loading URL'))
    const window = {
      isDestroyed: vi.fn().mockReturnValue(false),
      isVisible: vi.fn().mockReturnValue(false),
      loadURL,
      show: vi.fn(),
      focus: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      webContents: {
        on: vi.fn(),
        setWindowOpenHandler: vi.fn()
      }
    }
    class FakeBrowserWindow {
      constructor() {
        return window
      }
    }
    const controller = createElectronDocumentViewerController({
      getParentWindow: () => null,
      shell: { openExternal: vi.fn() },
      BrowserWindowClass: FakeBrowserWindow as never
    })

    await expect(
      controller.open({ url: 'https://www.notion.so/workspace/Page-abc123' })
    ).resolves.toEqual({
      opened: true,
      url: 'https://www.notion.so/workspace/Page-abc123'
    })

    expect(window.show).toHaveBeenCalled()
    expect(window.focus).toHaveBeenCalled()
  })

  it('still rejects non-redirect internal viewer load failures', async () => {
    const window = {
      isDestroyed: vi.fn().mockReturnValue(false),
      isVisible: vi.fn().mockReturnValue(false),
      loadURL: vi.fn().mockRejectedValue(new Error('ERR_NAME_NOT_RESOLVED')),
      show: vi.fn(),
      focus: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      webContents: {
        on: vi.fn(),
        setWindowOpenHandler: vi.fn()
      }
    }
    class FakeBrowserWindow {
      constructor() {
        return window
      }
    }
    const controller = createElectronDocumentViewerController({
      getParentWindow: () => null,
      shell: { openExternal: vi.fn() },
      BrowserWindowClass: FakeBrowserWindow as never
    })

    await expect(
      controller.open({ url: 'https://www.notion.so/workspace/Page-abc123' })
    ).rejects.toThrow('ERR_NAME_NOT_RESOLVED')
  })
})
