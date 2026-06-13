import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentViewerController } from '../../services/document-viewer'
import { registerDocumentViewerIpc } from '../document-viewer'

describe('Document Viewer IPC boundary', () => {
  let handlers: Record<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>
  let controller: {
    open: ReturnType<typeof vi.fn>
    openExternal: ReturnType<typeof vi.fn>
    resize: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
  }
  let isValidSender: ReturnType<typeof vi.fn<(event: unknown) => boolean>>

  beforeEach(() => {
    handlers = {}
    controller = {
      open: vi.fn().mockResolvedValue({
        opened: true,
        url: 'https://www.notion.so/workspace/Page-abc123'
      }),
      openExternal: vi.fn().mockResolvedValue({
        opened: true,
        url: 'https://www.notion.so/workspace/Page-abc123'
      }),
      resize: vi.fn().mockReturnValue({ resized: true }),
      close: vi.fn()
    }
    isValidSender = vi.fn<(event: unknown) => boolean>().mockReturnValue(true)

    registerDocumentViewerIpc({
      controller: controller as unknown as DocumentViewerController,
      ipcMain: {
        handle: vi.fn((channel, listener) => {
          handlers[channel] = listener
        })
      },
      isValidSender
    })
  })

  it('rejects an untrusted sender before opening a document', async () => {
    isValidSender.mockReturnValue(false)

    await expect(
      handlers['document-viewer:open'](
        {},
        {
          url: 'https://www.notion.so/workspace/Page-abc123',
          bounds: { x: 240, y: 150, width: 640, height: 420 }
        }
      )
    ).rejects.toMatchObject({ message: 'UNAUTHORIZED_SENDER', stack: '' })
    expect(controller.open).not.toHaveBeenCalled()
  })

  it.each([
    [],
    [null],
    [[]],
    ['https://www.notion.so/workspace/Page-abc123'],
    [{ url: '' }],
    [{ url: 'https://www.notion.so/workspace/Page-abc123' }],
    [{ url: 'https://www.notion.so/workspace/Page-abc123', bounds: null }],
    [
      {
        url: 'https://www.notion.so/workspace/Page-abc123',
        bounds: { x: 240, y: 150, width: 640 }
      }
    ],
    [
      {
        url: 'https://www.notion.so/workspace/Page-abc123',
        bounds: { x: 240, y: 150, width: 640, height: Number.NaN }
      }
    ],
    [
      {
        url: 'https://www.notion.so/workspace/Page-abc123',
        bounds: { x: 240, y: 150, width: 640, height: 420 },
        token: 'secret'
      }
    ]
  ])('rejects invalid payload %#', async (...args) => {
    await expect(handlers['document-viewer:open']({}, ...args)).rejects.toThrow('INVALID_PAYLOAD')
    expect(controller.open).not.toHaveBeenCalled()
  })

  it('routes internal open requests to the viewer controller', async () => {
    await handlers['document-viewer:open'](
      {},
      {
        url: 'https://www.notion.so/workspace/Page-abc123',
        bounds: { x: 240, y: 150, width: 640, height: 420 }
      }
    )

    expect(controller.open).toHaveBeenCalledWith({
      url: 'https://www.notion.so/workspace/Page-abc123',
      bounds: { x: 240, y: 150, width: 640, height: 420 }
    })
  })

  it('routes external open requests through the document viewer policy', async () => {
    await handlers['document-viewer:open-external'](
      {},
      { url: 'https://www.notion.so/workspace/Page-abc123' }
    )

    expect(controller.openExternal).toHaveBeenCalledWith({
      url: 'https://www.notion.so/workspace/Page-abc123'
    })
  })

  it('preserves unsafe URL errors without exposing raw stacks', async () => {
    controller.open.mockRejectedValue(new Error('UNSAFE_DOCUMENT_URL'))

    await expect(
      handlers['document-viewer:open'](
        {},
        { url: 'https://example.com/page', bounds: { x: 240, y: 150, width: 640, height: 420 } }
      )
    ).rejects.toMatchObject({ message: 'UNSAFE_DOCUMENT_URL', stack: '' })
  })

  it('masks raw viewer failures', async () => {
    controller.open.mockRejectedValue(new Error('Electron load failure C:/local/path'))

    await expect(
      handlers['document-viewer:open'](
        {},
        {
          url: 'https://www.notion.so/workspace/Page-abc123',
          bounds: { x: 240, y: 150, width: 640, height: 420 }
        }
      )
    ).rejects.toMatchObject({ message: 'INTERNAL_ERROR', stack: '' })
  })

  it('closes the embedded viewer without extra payload', async () => {
    await expect(handlers['document-viewer:close']({})).resolves.toEqual({ closed: true })

    expect(controller.close).toHaveBeenCalled()
  })

  it('resizes the embedded viewer with exact bounds payload', async () => {
    await expect(
      handlers['document-viewer:resize'](
        {},
        { bounds: { x: 250, y: 160, width: 720, height: 460 } }
      )
    ).resolves.toEqual({ resized: true })

    expect(controller.resize).toHaveBeenCalledWith({
      bounds: { x: 250, y: 160, width: 720, height: 460 }
    })
  })

  it.each([
    [],
    [null],
    [{ bounds: null }],
    [{ bounds: { x: 250, y: 160, width: 720 } }],
    [{ bounds: { x: 250, y: 160, width: 720, height: Number.POSITIVE_INFINITY } }],
    [{ bounds: { x: 250, y: 160, width: 720, height: 460 }, token: 'secret' }]
  ])('rejects invalid resize payload %#', async (...args) => {
    await expect(handlers['document-viewer:resize']({}, ...args)).rejects.toThrow('INVALID_PAYLOAD')
    expect(controller.resize).not.toHaveBeenCalled()
  })

  it('rejects close requests with unexpected payload', async () => {
    await expect(handlers['document-viewer:close']({}, {})).rejects.toThrow('INVALID_PAYLOAD')

    expect(controller.close).not.toHaveBeenCalled()
  })
})
