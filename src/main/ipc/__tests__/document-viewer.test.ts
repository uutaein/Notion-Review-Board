import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentViewerController } from '../../services/document-viewer'
import { registerDocumentViewerIpc } from '../document-viewer'

describe('Document Viewer IPC boundary', () => {
  let handlers: Record<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>
  let controller: {
    open: ReturnType<typeof vi.fn>
    openExternal: ReturnType<typeof vi.fn>
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
      handlers['document-viewer:open']({}, { url: 'https://www.notion.so/workspace/Page-abc123' })
    ).rejects.toMatchObject({ message: 'UNAUTHORIZED_SENDER', stack: '' })
    expect(controller.open).not.toHaveBeenCalled()
  })

  it.each([
    [],
    [null],
    [[]],
    ['https://www.notion.so/workspace/Page-abc123'],
    [{ url: '' }],
    [{ url: 'https://www.notion.so/workspace/Page-abc123', token: 'secret' }]
  ])('rejects invalid payload %#', async (...args) => {
    await expect(handlers['document-viewer:open']({}, ...args)).rejects.toThrow('INVALID_PAYLOAD')
    expect(controller.open).not.toHaveBeenCalled()
  })

  it('routes internal open requests to the viewer controller', async () => {
    await handlers['document-viewer:open'](
      {},
      { url: 'https://www.notion.so/workspace/Page-abc123' }
    )

    expect(controller.open).toHaveBeenCalledWith({
      url: 'https://www.notion.so/workspace/Page-abc123'
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
      handlers['document-viewer:open']({}, { url: 'https://example.com/page' })
    ).rejects.toMatchObject({ message: 'UNSAFE_DOCUMENT_URL', stack: '' })
  })

  it('masks raw viewer failures', async () => {
    controller.open.mockRejectedValue(new Error('Electron load failure C:/local/path'))

    await expect(
      handlers['document-viewer:open']({}, { url: 'https://www.notion.so/workspace/Page-abc123' })
    ).rejects.toMatchObject({ message: 'INTERNAL_ERROR', stack: '' })
  })
})
