import { describe, expect, it, vi } from 'vitest'
import { useDocumentViewer, type DocumentViewerRendererApi } from '../useDocumentViewer'

describe('Document viewer renderer model', () => {
  it('opens a selected Notion URL through the internal viewer API', async () => {
    const api: DocumentViewerRendererApi = {
      open: vi.fn().mockResolvedValue({
        opened: true,
        url: 'https://www.notion.so/workspace/Page-abc123'
      }),
      openExternal: vi.fn()
    }
    const model = useDocumentViewer(api)

    await expect(model.open('https://www.notion.so/workspace/Page-abc123')).resolves.toBe(true)

    expect(api.open).toHaveBeenCalledWith({ url: 'https://www.notion.so/workspace/Page-abc123' })
    expect(model.message.value).toBe('내부 Notion 문서 창을 열었습니다.')
  })

  it('opens a selected Notion URL through the stricter external viewer API', async () => {
    const api: DocumentViewerRendererApi = {
      open: vi.fn(),
      openExternal: vi.fn().mockResolvedValue({
        opened: true,
        url: 'https://www.notion.so/workspace/Page-abc123'
      })
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
      openExternal: vi.fn()
    }
    const model = useDocumentViewer(api)

    await expect(model.open('https://example.com/page')).resolves.toBe(false)

    expect(model.state.value).toBe('error')
    expect(model.message.value).toBe('허용된 Notion HTTPS 문서만 열 수 있습니다.')
  })
})
