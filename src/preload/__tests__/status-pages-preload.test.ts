import { beforeEach, describe, expect, it, vi } from 'vitest'

const exposeInMainWorld = vi.fn()
const invoke = vi.fn()
const on = vi.fn()
const removeListener = vi.fn()

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke, on, removeListener }
}))

describe('Status Pages preload API', () => {
  beforeEach(async () => {
    vi.resetModules()
    exposeInMainWorld.mockClear()
    invoke.mockReset()
    on.mockReset()
    removeListener.mockReset()
    await import('../index')
  })

  it('exposes only the intent-specific status page list method', () => {
    expect(exposeInMainWorld).toHaveBeenCalledWith(
      'statusPages',
      expect.objectContaining({
        list: expect.any(Function)
      })
    )

    const api = exposeInMainWorld.mock.calls.find(([name]) => name === 'statusPages')?.[1]
    expect(Object.keys(api)).toEqual(['list', 'handleChanged'])
    expect(api).not.toHaveProperty('invoke')
    expect(api).not.toHaveProperty('database')
    expect(api).not.toHaveProperty('token')
  })

  it('routes list requests only to the fixed status pages channel', async () => {
    invoke.mockResolvedValue({ kind: 'changed', items: [], isEmpty: true })
    const api = exposeInMainWorld.mock.calls.find(([name]) => name === 'statusPages')?.[1]

    await api.list({ kind: 'changed' })
    await api.list({ kind: 'missing-deleted' })
    await api.handleChanged({ reviewItemId: 'item-1', action: 'keep-schedule' })

    expect(invoke.mock.calls).toEqual([
      ['status-pages:list', { kind: 'changed' }],
      ['status-pages:list', { kind: 'missing-deleted' }],
      ['status-pages:handle-changed', { reviewItemId: 'item-1', action: 'keep-schedule' }]
    ])
  })
})
