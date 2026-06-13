import { describe, expect, it, vi } from 'vitest'
import { useReviewRating, type ReviewRatingRendererApi } from '../useReviewRating'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('Review rating renderer model', () => {
  it('submits the selected rating through the preload API', async () => {
    const api: ReviewRatingRendererApi = {
      rate: vi.fn().mockResolvedValue({
        itemId: 'item-1',
        nextDueAt: '2026-06-20T00:00:00.000Z',
        reviewedAt: '2026-06-13T07:00:00.000Z'
      })
    }
    const model = useReviewRating(api)

    await expect(model.rate('item-1', 'good')).resolves.toBe(true)

    expect(api.rate).toHaveBeenCalledWith({ reviewItemId: 'item-1', rating: 'good' })
    expect(model.state.value).toBe('idle')
    expect(model.message.value).toBe('')
  })

  it('prevents rapid duplicate submissions while one rating is pending', async () => {
    const pending = deferred<{
      itemId: string
      nextDueAt: string
      reviewedAt: string
    }>()
    const api: ReviewRatingRendererApi = {
      rate: vi.fn().mockReturnValue(pending.promise)
    }
    const model = useReviewRating(api)

    const first = model.rate('item-1', 'again')
    const second = await model.rate('item-1', 'again')

    expect(second).toBe(false)
    expect(api.rate).toHaveBeenCalledOnce()
    expect(model.isPending.value).toBe(true)

    pending.resolve({
      itemId: 'item-1',
      nextDueAt: '2026-06-20T00:00:00.000Z',
      reviewedAt: '2026-06-13T07:00:00.000Z'
    })
    await expect(first).resolves.toBe(true)
  })

  it('keeps the item available to retry and masks raw backend details on failure', async () => {
    const api: ReviewRatingRendererApi = {
      rate: vi.fn().mockRejectedValue(new Error('SQLITE raw token path'))
    }
    const model = useReviewRating(api)

    await expect(model.rate('item-1', 'hard')).resolves.toBe(false)

    expect(model.state.value).toBe('error')
    expect(model.pendingItemId.value).toBeNull()
    expect(model.message.value).toBe('평가 저장에 실패했습니다.')
    expect(model.message.value).not.toContain('SQLITE')
  })
})
