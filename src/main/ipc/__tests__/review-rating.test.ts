import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RateReviewResult } from '../../services/scheduler'
import type { ReviewItem } from '../../../shared/domain/item'
import type { ReviewLog } from '../../../shared/domain/log'
import type { DateTimeString, ReviewItemId, ReviewLogId } from '../../../shared/domain/types'
import { registerReviewRatingIpc } from '../review-rating'

describe('Review rating IPC boundary', () => {
  let handlers: Record<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>
  let service: { rateReview: ReturnType<typeof vi.fn<(input: unknown) => RateReviewResult>> }
  let isValidSender: ReturnType<typeof vi.fn<(event: unknown) => boolean>>

  const item = {
    id: 'item-1',
    dueAt: '2026-06-20T00:00:00.000Z'
  } as ReviewItem
  const log = {
    id: 'log-1' as ReviewLogId,
    reviewedAt: '2026-06-13T07:00:00.000Z' as DateTimeString
  } as ReviewLog

  beforeEach(() => {
    handlers = {}
    service = {
      rateReview: vi.fn(() => ({ item, log }))
    }
    isValidSender = vi.fn<(event: unknown) => boolean>().mockReturnValue(true)

    registerReviewRatingIpc({
      service,
      ipcMain: {
        handle: vi.fn((channel, listener) => {
          handlers[channel] = listener
        })
      },
      isValidSender,
      now: () => '2026-06-13T07:00:00.000Z'
    })
  })

  it('rejects an untrusted sender before service access', async () => {
    isValidSender.mockReturnValue(false)

    await expect(
      handlers['review:rate']({}, { reviewItemId: 'item-1', rating: 'good' })
    ).rejects.toMatchObject({
      message: 'UNAUTHORIZED_SENDER',
      stack: ''
    })
    expect(service.rateReview).not.toHaveBeenCalled()
  })

  it('rates one review item with the fixed review time', async () => {
    await expect(
      handlers['review:rate']({}, { reviewItemId: 'item-1', rating: 'good' })
    ).resolves.toEqual({
      itemId: 'item-1',
      nextDueAt: '2026-06-20T00:00:00.000Z',
      reviewedAt: '2026-06-13T07:00:00.000Z'
    })

    expect(service.rateReview).toHaveBeenCalledWith({
      reviewItemId: 'item-1' as ReviewItemId,
      rating: 'good',
      reviewedAt: '2026-06-13T07:00:00.000Z'
    })
  })

  it.each([
    [null],
    [[]],
    ['item-1'],
    [{ reviewItemId: 'item-1' }],
    [{ rating: 'good' }],
    [{ reviewItemId: '', rating: 'good' }],
    [{ reviewItemId: 'item-1', rating: 'best' }],
    [{ reviewItemId: 'item-1', rating: 'good', token: 'secret' }]
  ])('rejects invalid payload %#', async (payload) => {
    await expect(handlers['review:rate']({}, payload)).rejects.toThrow('INVALID_PAYLOAD')
    expect(service.rateReview).not.toHaveBeenCalled()
  })

  it('maps missing and inactive review errors to public codes', async () => {
    service.rateReview.mockImplementationOnce(() => {
      throw new Error('Review item not found: item-1')
    })
    await expect(
      handlers['review:rate']({}, { reviewItemId: 'item-1', rating: 'good' })
    ).rejects.toMatchObject({ message: 'REVIEW_ITEM_NOT_FOUND', stack: '' })

    service.rateReview.mockImplementationOnce(() => {
      throw new Error('Review item is not active (status: missing)')
    })
    await expect(
      handlers['review:rate']({}, { reviewItemId: 'item-1', rating: 'good' })
    ).rejects.toMatchObject({ message: 'REVIEW_ITEM_NOT_ACTIVE', stack: '' })
  })

  it('masks raw scheduler and database details', async () => {
    service.rateReview.mockImplementation(() => {
      throw new Error('SQLITE_BUSY raw local path')
    })

    await expect(
      handlers['review:rate']({}, { reviewItemId: 'item-1', rating: 'good' })
    ).rejects.toMatchObject({
      message: 'INTERNAL_ERROR',
      stack: ''
    })
  })
})
