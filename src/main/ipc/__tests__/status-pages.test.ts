import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StatusPageService } from '../../services/status-pages'
import { registerStatusPagesIpc } from '../status-pages'

describe('Status Pages IPC boundary', () => {
  let handlers: Record<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>
  let service: { list: ReturnType<typeof vi.fn> }
  let isValidSender: ReturnType<typeof vi.fn<(event: unknown) => boolean>>

  beforeEach(() => {
    handlers = {}
    service = {
      list: vi.fn().mockReturnValue({ kind: 'changed', items: [], isEmpty: true })
    }
    isValidSender = vi.fn<(event: unknown) => boolean>().mockReturnValue(true)

    registerStatusPagesIpc({
      service: service as unknown as StatusPageService,
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
})
