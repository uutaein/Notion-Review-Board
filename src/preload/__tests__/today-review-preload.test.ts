import { beforeEach, describe, expect, it, vi } from 'vitest'

const exposeInMainWorld = vi.fn()
const invoke = vi.fn()
const on = vi.fn()
const removeListener = vi.fn()

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke, on, removeListener }
}))

describe('Today Review preload API', () => {
  beforeEach(async () => {
    vi.resetModules()
    exposeInMainWorld.mockClear()
    invoke.mockReset()
    on.mockReset()
    removeListener.mockReset()
    await import('../index')
  })

  it('exposes only the intent-specific Today Review list method', () => {
    expect(exposeInMainWorld).toHaveBeenCalledWith(
      'todayReview',
      expect.objectContaining({
        list: expect.any(Function)
      })
    )

    const api = exposeInMainWorld.mock.calls.find(([name]) => name === 'todayReview')?.[1]
    expect(Object.keys(api)).toEqual(['list'])
    expect(api).not.toHaveProperty('invoke')
    expect(api).not.toHaveProperty('database')
    expect(api).not.toHaveProperty('token')
  })

  it('routes list requests only to the fixed Today Review channel', async () => {
    invoke.mockResolvedValue({ items: [], isEmpty: true, emptyReason: 'no-due-items', sort: 'due' })
    const api = exposeInMainWorld.mock.calls.find(([name]) => name === 'todayReview')?.[1]

    await api.list()
    await api.list({ sort: 'random' })

    expect(invoke.mock.calls).toEqual([
      ['review:list-today'],
      ['review:list-today', { sort: 'random' }]
    ])
  })
})
