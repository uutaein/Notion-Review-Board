import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DateTimeString, ReviewItemId } from '../../../shared/domain/types'
import type { ExcludeReviewItemResultDto } from '../../../shared/review-exclusion'
import { registerReviewExclusionIpc } from '../review-exclusion'

describe('Review exclusion IPC boundary', () => {
  let handlers: Record<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>
  let service: {
    exclude: ReturnType<typeof vi.fn<(input: unknown) => ExcludeReviewItemResultDto>>
  }
  let isValidSender: ReturnType<typeof vi.fn<(event: unknown) => boolean>>

  beforeEach(() => {
    handlers = {}
    service = {
      exclude: vi.fn(() => ({
        itemId: 'item-1',
        status: 'archived',
        excludedAt: '2026-06-13T07:00:00.000Z'
      }))
    }
    isValidSender = vi.fn<(event: unknown) => boolean>().mockReturnValue(true)

    registerReviewExclusionIpc({
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

    await expect(handlers['review:exclude']({}, { reviewItemId: 'item-1' })).rejects.toMatchObject({
      message: 'UNAUTHORIZED_SENDER',
      stack: ''
    })
    expect(service.exclude).not.toHaveBeenCalled()
  })

  it('excludes one review item with the fixed action time', async () => {
    await expect(handlers['review:exclude']({}, { reviewItemId: 'item-1' })).resolves.toEqual({
      itemId: 'item-1',
      status: 'archived',
      excludedAt: '2026-06-13T07:00:00.000Z'
    })

    expect(service.exclude).toHaveBeenCalledWith({
      reviewItemId: 'item-1' as ReviewItemId,
      excludedAt: '2026-06-13T07:00:00.000Z' as DateTimeString
    })
  })

  it.each([
    [null],
    [[]],
    ['item-1'],
    [{}],
    [{ reviewItemId: '' }],
    [{ reviewItemId: 'item-1', token: 'secret' }]
  ])('rejects invalid payload %#', async (payload) => {
    await expect(handlers['review:exclude']({}, payload)).rejects.toThrow('INVALID_PAYLOAD')
    expect(service.exclude).not.toHaveBeenCalled()
  })

  it('masks raw persistence details', async () => {
    service.exclude.mockImplementation(() => {
      throw new Error('SQLITE_BUSY raw local path')
    })

    await expect(handlers['review:exclude']({}, { reviewItemId: 'item-1' })).rejects.toMatchObject({
      message: 'INTERNAL_ERROR',
      stack: ''
    })
  })
})
