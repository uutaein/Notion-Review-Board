import { beforeEach, describe, expect, it, vi } from 'vitest'

const exposeInMainWorld = vi.fn()
const invoke = vi.fn()
const on = vi.fn()
const removeListener = vi.fn()

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke, on, removeListener }
}))

describe('Review exclusion preload API', () => {
  beforeEach(async () => {
    vi.resetModules()
    exposeInMainWorld.mockClear()
    invoke.mockReset()
    on.mockReset()
    removeListener.mockReset()
    await import('../index')
  })

  it('exposes only the intent-specific review exclusion method', () => {
    expect(exposeInMainWorld).toHaveBeenCalledWith(
      'reviewExclusion',
      expect.objectContaining({
        exclude: expect.any(Function)
      })
    )

    const api = exposeInMainWorld.mock.calls.find(([name]) => name === 'reviewExclusion')?.[1]
    expect(Object.keys(api)).toEqual(['exclude'])
    expect(api).not.toHaveProperty('invoke')
    expect(api).not.toHaveProperty('database')
    expect(api).not.toHaveProperty('token')
  })

  it('routes exclusion requests only to the fixed review exclusion channel', async () => {
    invoke.mockResolvedValue({
      itemId: 'item-1',
      status: 'archived',
      excludedAt: '2026-06-13T07:00:00.000Z'
    })
    const api = exposeInMainWorld.mock.calls.find(([name]) => name === 'reviewExclusion')?.[1]

    await api.exclude({ reviewItemId: 'item-1' })

    expect(invoke.mock.calls).toEqual([['review:exclude', { reviewItemId: 'item-1' }]])
  })
})
