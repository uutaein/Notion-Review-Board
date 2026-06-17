import { describe, expect, it, vi } from 'vitest'
import { useReviewExclusion, type ReviewExclusionRendererApi } from '../useReviewExclusion'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('Review exclusion renderer model', () => {
  it('submits the selected item through the preload API', async () => {
    const api: ReviewExclusionRendererApi = {
      exclude: vi.fn().mockResolvedValue({
        itemId: 'item-1',
        status: 'archived',
        excludedAt: '2026-06-13T07:00:00.000Z'
      })
    }
    const model = useReviewExclusion(api)

    await expect(model.exclude('item-1')).resolves.toBe(true)

    expect(api.exclude).toHaveBeenCalledWith({ reviewItemId: 'item-1' })
    expect(model.state.value).toBe('idle')
    expect(model.message.value).toBe('문서를 복습 목록에서 제외했습니다.')
  })

  it('prevents rapid duplicate exclusion while one request is pending', async () => {
    const pending = deferred<{
      itemId: string
      status: 'archived'
      excludedAt: string
    }>()
    const api: ReviewExclusionRendererApi = {
      exclude: vi.fn().mockReturnValue(pending.promise)
    }
    const model = useReviewExclusion(api)

    const first = model.exclude('item-1')
    const second = await model.exclude('item-1')

    expect(second).toBe(false)
    expect(api.exclude).toHaveBeenCalledOnce()
    expect(model.isPending.value).toBe(true)

    pending.resolve({
      itemId: 'item-1',
      status: 'archived',
      excludedAt: '2026-06-13T07:00:00.000Z'
    })
    await expect(first).resolves.toBe(true)
  })

  it('keeps the item available to retry and masks raw backend details on failure', async () => {
    const api: ReviewExclusionRendererApi = {
      exclude: vi.fn().mockRejectedValue(new Error('SQLITE raw local path'))
    }
    const model = useReviewExclusion(api)

    await expect(model.exclude('item-1')).resolves.toBe(false)

    expect(model.state.value).toBe('error')
    expect(model.pendingItemId.value).toBeNull()
    expect(model.message.value).toBe('문서 제외에 실패했습니다.')
    expect(model.message.value).not.toContain('SQLITE')
  })
})
