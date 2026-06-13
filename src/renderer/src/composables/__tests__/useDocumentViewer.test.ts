import { describe, expect, it, vi } from 'vitest'
import { useDocumentViewer, type DocumentViewerRendererApi } from '../useDocumentViewer'

describe('Document viewer renderer model', () => {
  it('opens a selected Notion URL through the internal viewer API', async () => {
    const api: DocumentViewerRendererApi = {
      open: vi.fn().mockResolvedValue({
        opened: true,
        url: 'https://www.notion.so/workspace/Page-abc123'
      }),
      openExternal: vi.fn(),
      close: vi.fn(),
      resize: vi.fn()
    }
    const model = useDocumentViewer(api)

    await expect(
      model.open('https://www.notion.so/workspace/Page-abc123', {
        x: 240,
        y: 150,
        width: 640,
        height: 420
      })
    ).resolves.toBe(true)

    expect(api.open).toHaveBeenCalledWith({
      url: 'https://www.notion.so/workspace/Page-abc123',
      bounds: { x: 240, y: 150, width: 640, height: 420 }
    })
    expect(model.message.value).toBe('내부 뷰어에서 문서를 열었습니다.')
  })

  it('opens a selected Notion URL through the stricter external viewer API', async () => {
    const api: DocumentViewerRendererApi = {
      open: vi.fn(),
      openExternal: vi.fn().mockResolvedValue({
        opened: true,
        url: 'https://www.notion.so/workspace/Page-abc123'
      }),
      close: vi.fn(),
      resize: vi.fn()
    }
    const model = useDocumentViewer(api)

    await expect(model.openExternal('https://www.notion.so/workspace/Page-abc123')).resolves.toBe(
      true
    )

    expect(api.openExternal).toHaveBeenCalledWith({
      url: 'https://www.notion.so/workspace/Page-abc123'
    })
    expect(model.message.value).toBe('외부 브라우저에서 문서를 열었습니다.')
  })

  it('shows a sanitized unsafe URL message', async () => {
    const api: DocumentViewerRendererApi = {
      open: vi.fn().mockRejectedValue(new Error('UNSAFE_DOCUMENT_URL')),
      openExternal: vi.fn(),
      close: vi.fn(),
      resize: vi.fn()
    }
    const model = useDocumentViewer(api)

    await expect(
      model.open('https://example.com/page', { x: 240, y: 150, width: 640, height: 420 })
    ).resolves.toBe(false)

    expect(model.state.value).toBe('error')
    expect(model.message.value).toBe('허용된 Notion HTTPS 문서만 열 수 있습니다.')
  })

  it('closes the embedded viewer through the preload API', async () => {
    const api: DocumentViewerRendererApi = {
      open: vi.fn(),
      openExternal: vi.fn(),
      close: vi.fn().mockResolvedValue({ closed: true }),
      resize: vi.fn()
    }
    const model = useDocumentViewer(api)

    await model.close()

    expect(api.close).toHaveBeenCalled()
  })

  it('resizes only after the embedded viewer is open', async () => {
    const api: DocumentViewerRendererApi = {
      open: vi.fn().mockResolvedValue({
        opened: true,
        url: 'https://www.notion.so/workspace/Page-abc123'
      }),
      openExternal: vi.fn(),
      close: vi.fn(),
      resize: vi.fn().mockResolvedValue({ resized: true })
    }
    const model = useDocumentViewer(api)

    await model.resize({ x: 250, y: 160, width: 720, height: 460 })
    expect(api.resize).not.toHaveBeenCalled()

    await model.open('https://www.notion.so/workspace/Page-abc123', {
      x: 240,
      y: 150,
      width: 640,
      height: 420
    })
    await model.resize({ x: 250, y: 160, width: 720, height: 460 })

    expect(api.resize).toHaveBeenCalledWith({
      bounds: { x: 250, y: 160, width: 720, height: 460 }
    })
  })
})
