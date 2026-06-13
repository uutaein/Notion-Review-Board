import { beforeEach, describe, expect, it, vi } from 'vitest'

const exposeInMainWorld = vi.fn()
const invoke = vi.fn()
const on = vi.fn()
const removeListener = vi.fn()

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke, on, removeListener }
}))

describe('Manual Sync preload API', () => {
  beforeEach(async () => {
    vi.resetModules()
    exposeInMainWorld.mockClear()
    invoke.mockReset()
    on.mockReset()
    removeListener.mockReset()
    await import('../index')
  })

  it('TC-SYNC-IPC-006: exposes only intent-specific synchronization methods', () => {
    expect(exposeInMainWorld).toHaveBeenCalledWith(
      'manualSync',
      expect.objectContaining({
        syncAll: expect.any(Function),
        syncSource: expect.any(Function),
        cancel: expect.any(Function),
        onProgress: expect.any(Function)
      })
    )

    const api = exposeInMainWorld.mock.calls.find(([name]) => name === 'manualSync')?.[1]
    expect(Object.keys(api)).toEqual(['syncAll', 'syncSource', 'cancel', 'onProgress'])
    expect(api).not.toHaveProperty('invoke')
    expect(api).not.toHaveProperty('token')
    expect(api).not.toHaveProperty('database')
    expect(api).not.toHaveProperty('notion')
  })

  it('routes methods only to the fixed Manual Sync channels', async () => {
    invoke.mockResolvedValue({ sources: [], totals: {} })
    const api = exposeInMainWorld.mock.calls.find(([name]) => name === 'manualSync')?.[1]

    await api.syncAll()
    await api.syncSource({ sourceId: 'source-1' })
    await api.cancel()

    expect(invoke.mock.calls).toEqual([
      ['sync:all'],
      ['sync:source', { sourceId: 'source-1' }],
      ['sync:cancel']
    ])
  })

  it('subscribes and unsubscribes through the fixed progress channel', () => {
    const api = exposeInMainWorld.mock.calls.find(([name]) => name === 'manualSync')?.[1]
    const listener = vi.fn()

    const unsubscribe = api.onProgress(listener)
    const handler = on.mock.calls[0][1]
    handler({}, { state: 'running', sourceId: 'source-1' })

    expect(on).toHaveBeenCalledWith('sync:progress', handler)
    expect(listener).toHaveBeenCalledWith({ state: 'running', sourceId: 'source-1' })

    unsubscribe()
    expect(removeListener).toHaveBeenCalledWith('sync:progress', handler)
  })
})
