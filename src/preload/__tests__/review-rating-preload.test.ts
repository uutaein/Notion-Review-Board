import { beforeEach, describe, expect, it, vi } from 'vitest'

const exposeInMainWorld = vi.fn()
const invoke = vi.fn()
const on = vi.fn()
const removeListener = vi.fn()

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke, on, removeListener }
}))

describe('Review rating preload API', () => {
  beforeEach(async () => {
    vi.resetModules()
    exposeInMainWorld.mockClear()
    invoke.mockReset()
    on.mockReset()
    removeListener.mockReset()
    await import('../index')
  })

  it('exposes only the intent-specific review rating method', () => {
    expect(exposeInMainWorld).toHaveBeenCalledWith(
      'reviewRating',
      expect.objectContaining({
        rate: expect.any(Function)
      })
    )

    const api = exposeInMainWorld.mock.calls.find(([name]) => name === 'reviewRating')?.[1]
    expect(Object.keys(api)).toEqual(['rate'])
    expect(api).not.toHaveProperty('invoke')
    expect(api).not.toHaveProperty('database')
    expect(api).not.toHaveProperty('token')
  })

  it('routes rating requests only to the fixed review rating channel', async () => {
    invoke.mockResolvedValue({
      itemId: 'item-1',
      nextDueAt: '2026-06-20T00:00:00.000Z',
      reviewedAt: '2026-06-13T07:00:00.000Z'
    })
    const api = exposeInMainWorld.mock.calls.find(([name]) => name === 'reviewRating')?.[1]

    await api.rate({ reviewItemId: 'item-1', rating: 'good' })

    expect(invoke.mock.calls).toEqual([['review:rate', { reviewItemId: 'item-1', rating: 'good' }]])
  })
})
