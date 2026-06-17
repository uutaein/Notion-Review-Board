import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReviewQueueService } from '../../services/review'
import { registerReviewQueueIpc } from '../review-queue'

describe('Review Queue IPC boundary', () => {
  let handlers: Record<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>
  let service: { list: ReturnType<typeof vi.fn> }
  let isValidSender: ReturnType<typeof vi.fn<(event: unknown) => boolean>>

  beforeEach(() => {
    handlers = {}
    service = {
      list: vi.fn().mockReturnValue({
        items: [],
        isEmpty: true,
        emptyReason: 'no-active-items',
        totalCount: 0,
        sort: 'due'
      })
    }
    isValidSender = vi.fn<(event: unknown) => boolean>().mockReturnValue(true)

    registerReviewQueueIpc({
      service: service as unknown as ReviewQueueService,
      ipcMain: {
        handle: vi.fn((channel, listener) => {
          handlers[channel] = listener
        })
      },
      isValidSender
    })
  })

  it('rejects an untrusted sender before service access', async () => {
    isValidSender.mockReturnValue(false)

    await expect(handlers['review-queue:list']({})).rejects.toMatchObject({
      message: 'UNAUTHORIZED_SENDER',
      stack: ''
    })
    expect(service.list).not.toHaveBeenCalled()
  })

  it('lists the full active queue without renderer-supplied filters', async () => {
    await expect(handlers['review-queue:list']({})).resolves.toEqual({
      items: [],
      isEmpty: true,
      emptyReason: 'no-active-items',
      totalCount: 0,
      sort: 'due'
    })

    expect(service.list).toHaveBeenCalledWith()
  })

  it.each([[{}], [{ sort: 'random' }], ['source-1'], [null]])(
    'rejects unexpected payload %#',
    async (payload) => {
      await expect(handlers['review-queue:list']({}, payload)).rejects.toThrow('INVALID_PAYLOAD')
      expect(service.list).not.toHaveBeenCalled()
    }
  )

  it('masks raw backend details and stack traces', async () => {
    service.list.mockImplementation(() => {
      throw new Error('SQLITE_BUSY token raw Notion response')
    })

    await expect(handlers['review-queue:list']({})).rejects.toMatchObject({
      message: 'INTERNAL_ERROR',
      stack: ''
    })
  })
})
