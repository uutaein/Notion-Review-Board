import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TodayReviewService } from '../../services/review'
import { registerTodayReviewIpc } from '../today-review'

describe('Today Review IPC boundary', () => {
  let handlers: Record<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>
  let service: { list: ReturnType<typeof vi.fn> }
  let isValidSender: ReturnType<typeof vi.fn<(event: unknown) => boolean>>

  beforeEach(() => {
    handlers = {}
    service = {
      list: vi
        .fn()
        .mockReturnValue({ items: [], isEmpty: true, emptyReason: 'no-due-items', sort: 'due' })
    }
    isValidSender = vi.fn<(event: unknown) => boolean>().mockReturnValue(true)

    registerTodayReviewIpc({
      service: service as unknown as TodayReviewService,
      ipcMain: {
        handle: vi.fn((channel, listener) => {
          handlers[channel] = listener
        })
      },
      isValidSender,
      now: () => '2026-06-13T07:00:00.000Z',
      timeZone: 'Asia/Seoul'
    })
  })

  it('rejects an untrusted sender before service access', async () => {
    isValidSender.mockReturnValue(false)

    await expect(handlers['review:list-today']({})).rejects.toMatchObject({
      message: 'UNAUTHORIZED_SENDER',
      stack: ''
    })
    expect(service.list).not.toHaveBeenCalled()
  })

  it('lists Today Review items with the fixed time zone and current time', async () => {
    await expect(handlers['review:list-today']({})).resolves.toEqual({
      items: [],
      isEmpty: true,
      emptyReason: 'no-due-items',
      sort: 'due'
    })

    expect(service.list).toHaveBeenCalledWith({
      now: '2026-06-13T07:00:00.000Z',
      timeZone: 'Asia/Seoul',
      sort: undefined
    })
  })

  it.each([[null], [[]], ['due'], [{ sort: 'created' }], [{ filter: 'secret' }]])(
    'rejects invalid payload %#',
    async (payload) => {
      await expect(handlers['review:list-today']({}, payload)).rejects.toThrow('INVALID_PAYLOAD')
      expect(service.list).not.toHaveBeenCalled()
    }
  )

  it('accepts the explicit random sort option only through the exact payload', async () => {
    await handlers['review:list-today']({}, { sort: 'random' })

    expect(service.list).toHaveBeenCalledWith({
      now: '2026-06-13T07:00:00.000Z',
      timeZone: 'Asia/Seoul',
      sort: 'random'
    })
  })

  it('masks raw backend details and stack traces', async () => {
    service.list.mockImplementation(() => {
      throw new Error('SQLITE_BUSY secret Notion payload')
    })

    await expect(handlers['review:list-today']({})).rejects.toMatchObject({
      message: 'INTERNAL_ERROR',
      stack: ''
    })
  })
})
