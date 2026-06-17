import { beforeEach, describe, expect, it, vi } from 'vitest'

const exposeInMainWorld = vi.fn()
const invoke = vi.fn()
const on = vi.fn()
const removeListener = vi.fn()

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke, on, removeListener }
}))

describe('Review Queue preload API', () => {
  beforeEach(async () => {
    vi.resetModules()
    exposeInMainWorld.mockClear()
    invoke.mockReset()
    on.mockReset()
    removeListener.mockReset()
    await import('../index')
  })

  it('exposes only the intent-specific Review Queue list method', () => {
    expect(exposeInMainWorld).toHaveBeenCalledWith(
      'reviewQueue',
      expect.objectContaining({
        list: expect.any(Function)
      })
    )

    const api = exposeInMainWorld.mock.calls.find(([name]) => name === 'reviewQueue')?.[1]
    expect(Object.keys(api)).toEqual(['list'])
    expect(api).not.toHaveProperty('invoke')
    expect(api).not.toHaveProperty('database')
    expect(api).not.toHaveProperty('token')
  })

  it('routes list requests only to the fixed Review Queue channel', async () => {
    invoke.mockResolvedValue({
      items: [],
      isEmpty: true,
      emptyReason: 'no-active-items',
      totalCount: 0,
      sort: 'due'
    })
    const api = exposeInMainWorld.mock.calls.find(([name]) => name === 'reviewQueue')?.[1]

    await api.list()

    expect(invoke.mock.calls).toEqual([['review-queue:list']])
  })
})
