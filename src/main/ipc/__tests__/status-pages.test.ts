import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StatusPageService } from '../../services/status-pages'
import { registerStatusPagesIpc } from '../status-pages'

describe('Status Pages IPC boundary', () => {
  let handlers: Record<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>
  let service: { list: ReturnType<typeof vi.fn>; handleChanged: ReturnType<typeof vi.fn> }
  let isValidSender: ReturnType<typeof vi.fn<(event: unknown) => boolean>>

  beforeEach(() => {
    handlers = {}
    service = {
      list: vi.fn().mockReturnValue({ kind: 'changed', items: [], isEmpty: true }),
      handleChanged: vi.fn().mockReturnValue({
        itemId: 'item-1',
        status: 'active',
        dueAt: '2026-06-13T07:00:00.000Z',
        handledAt: '2026-06-13T07:00:00.000Z'
      })
    }
    isValidSender = vi.fn<(event: unknown) => boolean>().mockReturnValue(true)

    registerStatusPagesIpc({
      service: service as unknown as StatusPageService,
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

    await expect(handlers['status-pages:list']({}, { kind: 'changed' })).rejects.toMatchObject({
      message: 'UNAUTHORIZED_SENDER',
      stack: ''
    })
    expect(service.list).not.toHaveBeenCalled()
  })

  it.each([
    [],
    [null],
    [[]],
    ['changed'],
    [{ kind: 'active' }],
    [{ kind: 'changed', token: 'secret' }]
  ])('rejects invalid payload %#', async (...args) => {
    await expect(handlers['status-pages:list']({}, ...args)).rejects.toThrow('INVALID_PAYLOAD')
    expect(service.list).not.toHaveBeenCalled()
  })

  it('accepts the exact changed list payload', async () => {
    await handlers['status-pages:list']({}, { kind: 'changed' })

    expect(service.list).toHaveBeenCalledWith({ kind: 'changed' })
  })

  it('accepts the exact missing/deleted list payload', async () => {
    await handlers['status-pages:list']({}, { kind: 'missing-deleted' })

    expect(service.list).toHaveBeenCalledWith({ kind: 'missing-deleted' })
  })

  it('masks raw backend details and stack traces', async () => {
    service.list.mockImplementation(() => {
      throw new Error('SQLITE_BUSY raw local path')
    })

    await expect(handlers['status-pages:list']({}, { kind: 'changed' })).rejects.toMatchObject({
      message: 'INTERNAL_ERROR',
      stack: ''
    })
  })

  it.each([
    [null],
    [[]],
    ['item-1'],
    [{ reviewItemId: 'item-1' }],
    [{ action: 'pull-today' }],
    [{ reviewItemId: '', action: 'pull-today' }],
    [{ reviewItemId: 'item-1', action: 'delete' }],
    [{ reviewItemId: 'item-1', action: 'pull-today', token: 'secret' }]
  ])('rejects invalid changed action payload %#', async (payload) => {
    await expect(handlers['status-pages:handle-changed']({}, payload)).rejects.toThrow(
      'INVALID_PAYLOAD'
    )
    expect(service.handleChanged).not.toHaveBeenCalled()
  })

  it('accepts exact changed action payloads with the fixed handled time', async () => {
    await expect(
      handlers['status-pages:handle-changed']({}, { reviewItemId: 'item-1', action: 'pull-today' })
    ).resolves.toEqual({
      itemId: 'item-1',
      status: 'active',
      dueAt: '2026-06-13T07:00:00.000Z',
      handledAt: '2026-06-13T07:00:00.000Z'
    })

    expect(service.handleChanged).toHaveBeenCalledWith({
      reviewItemId: 'item-1',
      action: 'pull-today',
      handledAt: '2026-06-13T07:00:00.000Z'
    })
  })

  it('preserves public changed action errors', async () => {
    service.handleChanged.mockImplementationOnce(() => {
      throw new Error('STATUS_ITEM_NOT_CHANGED')
    })

    await expect(
      handlers['status-pages:handle-changed'](
        {},
        { reviewItemId: 'item-1', action: 'keep-schedule' }
      )
    ).rejects.toMatchObject({ message: 'STATUS_ITEM_NOT_CHANGED', stack: '' })
  })
})
