import { describe, expect, it, vi } from 'vitest'
import {
  createElectronDocumentViewerController,
  isAllowedNotionDocumentUrl,
  normalizeDocumentViewerBounds,
  normalizeNotionDocumentUrl
} from '..'

describe('Document Viewer URL policy', () => {
  it.each([
    'https://app.notion.com/p/Page-abc123',
    'https://www.notion.com/workspace/Page-abc123',
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
    'https://notion.com.evil.test/page',
    'https://notion.so.evil.test/page',
    'file:///C:/secret.txt',
    'not a url'
  ])('rejects unsafe document URL %s', (url) => {
    expect(isAllowedNotionDocumentUrl(url)).toBe(false)
    expect(() => normalizeNotionDocumentUrl(url)).toThrow('UNSAFE_DOCUMENT_URL')
  })

  it('opens the internal viewer as an embedded WebContentsView without preload or Node integration', async () => {
    const loadURL = vi.fn().mockResolvedValue(undefined)
    const setBounds = vi.fn()
    const view = {
      setBounds,
      webContents: {
        isDestroyed: vi.fn().mockReturnValue(false),
        loadURL,
        close: vi.fn(),
        on: vi.fn(),
        setWindowOpenHandler: vi.fn()
      }
    }
    const parentWindow = {
      isDestroyed: vi.fn().mockReturnValue(false),
      focus: vi.fn(),
      contentView: {
        addChildView: vi.fn(),
        removeChildView: vi.fn()
      }
    }
    let createdOptions: unknown = null
    class FakeWebContentsView {
      constructor(options: unknown) {
        createdOptions = options
        return view
      }
    }
    const controller = createElectronDocumentViewerController({
      getParentWindow: () => parentWindow as never,
      shell: { openExternal: vi.fn() },
      WebContentsViewClass: FakeWebContentsView as never
    })

    await expect(
      controller.open({
        url: 'https://www.notion.so/workspace/Page-abc123',
        bounds: { x: 250.2, y: 150.6, width: 640.1, height: 420.9 }
      })
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
    expect(parentWindow.contentView.addChildView).toHaveBeenCalledWith(view)
    expect(setBounds).toHaveBeenCalledWith({ x: 250, y: 151, width: 640, height: 421 })
    expect(loadURL).toHaveBeenCalledWith('https://www.notion.so/workspace/Page-abc123')
    expect(parentWindow.focus).toHaveBeenCalled()
  })

  it('treats Electron redirect aborts as an opened internal viewer', async () => {
    const loadURL = vi.fn().mockRejectedValue(new Error('ERR_ABORTED (-3) loading URL'))
    const view = {
      setBounds: vi.fn(),
      webContents: {
        isDestroyed: vi.fn().mockReturnValue(false),
        loadURL,
        close: vi.fn(),
        on: vi.fn(),
        setWindowOpenHandler: vi.fn()
      }
    }
    const parentWindow = {
      isDestroyed: vi.fn().mockReturnValue(false),
      focus: vi.fn(),
      contentView: {
        addChildView: vi.fn(),
        removeChildView: vi.fn()
      }
    }
    class FakeWebContentsView {
      constructor() {
        return view
      }
    }
    const controller = createElectronDocumentViewerController({
      getParentWindow: () => parentWindow as never,
      shell: { openExternal: vi.fn() },
      WebContentsViewClass: FakeWebContentsView as never
    })

    await expect(
      controller.open({
        url: 'https://www.notion.so/workspace/Page-abc123',
        bounds: { x: 250, y: 150, width: 640, height: 420 }
      })
    ).resolves.toEqual({
      opened: true,
      url: 'https://www.notion.so/workspace/Page-abc123'
    })

    expect(parentWindow.focus).toHaveBeenCalled()
  })

  it('still rejects non-redirect internal viewer load failures', async () => {
    const view = {
      setBounds: vi.fn(),
      webContents: {
        isDestroyed: vi.fn().mockReturnValue(false),
        loadURL: vi.fn().mockRejectedValue(new Error('ERR_NAME_NOT_RESOLVED')),
        close: vi.fn(),
        on: vi.fn(),
        setWindowOpenHandler: vi.fn()
      }
    }
    const parentWindow = {
      isDestroyed: vi.fn().mockReturnValue(false),
      focus: vi.fn(),
      contentView: {
        addChildView: vi.fn(),
        removeChildView: vi.fn()
      }
    }
    class FakeWebContentsView {
      constructor() {
        return view
      }
    }
    const controller = createElectronDocumentViewerController({
      getParentWindow: () => parentWindow as never,
      shell: { openExternal: vi.fn() },
      WebContentsViewClass: FakeWebContentsView as never
    })

    await expect(
      controller.open({
        url: 'https://www.notion.so/workspace/Page-abc123',
        bounds: { x: 250, y: 150, width: 640, height: 420 }
      })
    ).rejects.toThrow('ERR_NAME_NOT_RESOLVED')
  })

  it('rejects invalid embedded viewer bounds', () => {
    expect(() => normalizeDocumentViewerBounds({ x: 0, y: 0, width: 119, height: 420 })).toThrow(
      'INVALID_PAYLOAD'
    )
    expect(() =>
      normalizeDocumentViewerBounds({ x: 0, y: 0, width: 640, height: 420 })
    ).not.toThrow()
  })
})
