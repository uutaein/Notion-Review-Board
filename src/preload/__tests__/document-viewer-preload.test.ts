import { beforeEach, describe, expect, it, vi } from 'vitest'

const exposeInMainWorld = vi.fn()
const invoke = vi.fn()
const on = vi.fn()
const removeListener = vi.fn()

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke, on, removeListener }
}))

describe('Document Viewer preload API', () => {
  beforeEach(async () => {
    vi.resetModules()
    exposeInMainWorld.mockClear()
    invoke.mockReset()
    on.mockReset()
    removeListener.mockReset()
    await import('../index')
  })

  it('exposes only fixed document viewer methods', () => {
    expect(exposeInMainWorld).toHaveBeenCalledWith(
      'documentViewer',
      expect.objectContaining({
        open: expect.any(Function),
        openExternal: expect.any(Function),
        close: expect.any(Function)
      })
    )

    const api = exposeInMainWorld.mock.calls.find(([name]) => name === 'documentViewer')?.[1]
    expect(Object.keys(api)).toEqual(['open', 'openExternal', 'close'])
    expect(api).not.toHaveProperty('invoke')
    expect(api).not.toHaveProperty('token')
    expect(api).not.toHaveProperty('database')
  })

  it('routes requests only to fixed document viewer channels', async () => {
    invoke.mockResolvedValue({ opened: true, url: 'https://www.notion.so/workspace/Page-abc123' })
    const api = exposeInMainWorld.mock.calls.find(([name]) => name === 'documentViewer')?.[1]

    await api.open({
      url: 'https://www.notion.so/workspace/Page-abc123',
      bounds: { x: 240, y: 150, width: 640, height: 420 }
    })
    await api.openExternal({ url: 'https://www.notion.so/workspace/Page-abc123' })
    await api.close()

    expect(invoke.mock.calls).toEqual([
      [
        'document-viewer:open',
        {
          url: 'https://www.notion.so/workspace/Page-abc123',
          bounds: { x: 240, y: 150, width: 640, height: 420 }
        }
      ],
      ['document-viewer:open-external', { url: 'https://www.notion.so/workspace/Page-abc123' }],
      ['document-viewer:close']
    ])
  })
})
