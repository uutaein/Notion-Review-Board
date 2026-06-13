import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ManualSyncService } from '../../services/synchronization'
import { registerManualSyncIpc } from '../manual-sync'

describe('Manual Sync IPC boundary', () => {
  let handlers: Record<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>
  let service: {
    syncAll: ReturnType<typeof vi.fn>
    syncSource: ReturnType<typeof vi.fn>
  }
  let isValidSender: ReturnType<typeof vi.fn<(event: unknown) => boolean>>

  beforeEach(() => {
    handlers = {}
    service = {
      syncAll: vi.fn().mockResolvedValue({ sources: [], totals: emptyCounts() }),
      syncSource: vi.fn().mockResolvedValue({ sources: [], totals: emptyCounts() })
    }
    isValidSender = vi.fn<(event: unknown) => boolean>().mockReturnValue(true)

    registerManualSyncIpc({
      service: service as unknown as ManualSyncService,
      ipcMain: {
        handle: vi.fn((channel, listener) => {
          handlers[channel] = listener
        })
      },
      isValidSender
    })
  })

  it('TC-SYNC-IPC-001: rejects an untrusted sender before service access', async () => {
    isValidSender.mockReturnValue(false)

    await expect(
      handlers['sync:all']({ senderFrame: { url: 'https://attacker.invalid' } })
    ).rejects.toMatchObject({
      message: 'UNAUTHORIZED_SENDER',
      stack: ''
    })
    expect(service.syncAll).not.toHaveBeenCalled()
    expect(service.syncSource).not.toHaveBeenCalled()
  })

  it('TC-SYNC-IPC-002: sync-all rejects every unexpected argument', async () => {
    await expect(handlers['sync:all']({}, {})).rejects.toThrow('INVALID_PAYLOAD')
    expect(service.syncAll).not.toHaveBeenCalled()
  })

  it.each([
    { args: [] },
    { args: [null] },
    { args: ['source-1'] },
    { args: [[]] },
    { args: [{ sourceId: '' }] },
    { args: [{ sourceId: ' ' }] },
    { args: [{ sourceId: 'a'.repeat(65) }] },
    { args: [{ sourceId: 'source-1', extra: true }] }
  ])('TC-SYNC-IPC-002: single-Source sync rejects invalid exact payload %#', async ({ args }) => {
    await expect(handlers['sync:source']({}, ...args)).rejects.toThrow('INVALID_PAYLOAD')
    expect(service.syncSource).not.toHaveBeenCalled()
  })

  it('starts sync-all and single-Source sync with Main Process AbortSignals', async () => {
    await handlers['sync:all']({})
    await handlers['sync:source']({}, { sourceId: 'source-1' })

    expect(service.syncAll).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
      onProgress: expect.any(Function)
    })
    expect(service.syncSource).toHaveBeenCalledWith({
      sourceId: 'source-1',
      signal: expect.any(AbortSignal),
      onProgress: expect.any(Function)
    })
  })

  it('TC-SYNC-IPC-004: emits only structured progress on the fixed channel', async () => {
    const send = vi.fn()
    service.syncAll.mockImplementation(async ({ onProgress }) => {
      onProgress({ state: 'running', sourceId: 'source-1' })
      return { sources: [], totals: emptyCounts() }
    })

    await handlers['sync:all']({ sender: { send } })

    expect(send).toHaveBeenCalledWith('sync:progress', {
      state: 'running',
      sourceId: 'source-1'
    })
    expect(JSON.stringify(send.mock.calls)).not.toContain('secret')
  })

  it('TC-SYNC-IPC-003: cancellation accepts no payload and aborts the active run', async () => {
    let resolveSync: ((value: unknown) => void) | undefined
    service.syncAll.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSync = resolve
        })
    )

    const running = handlers['sync:all']({})
    const signal = service.syncAll.mock.calls[0][0].signal as AbortSignal

    await expect(handlers['sync:cancel']({})).resolves.toEqual({ cancelled: true })
    expect(signal.aborted).toBe(true)

    resolveSync?.({ sources: [], totals: emptyCounts() })
    await running
  })

  it('TC-SYNC-IPC-003: cancellation rejects arguments and an absent active run', async () => {
    await expect(handlers['sync:cancel']({}, { requestId: 'unexpected' })).rejects.toThrow(
      'INVALID_PAYLOAD'
    )
    await expect(handlers['sync:cancel']({})).rejects.toThrow('NO_SYNC_IN_PROGRESS')
  })

  it('prevents overlapping synchronization runs', async () => {
    let resolveSync: ((value: unknown) => void) | undefined
    service.syncAll.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSync = resolve
        })
    )

    const running = handlers['sync:all']({})
    await expect(handlers['sync:source']({}, { sourceId: 'source-1' })).rejects.toThrow(
      'SYNC_IN_PROGRESS'
    )
    expect(service.syncSource).not.toHaveBeenCalled()

    resolveSync?.({ sources: [], totals: emptyCounts() })
    await running
  })

  it('TC-SYNC-IPC-004/005: masks raw backend details and stack traces', async () => {
    service.syncAll.mockRejectedValue(
      new Error('SQLITE_BUSY secret_sync_token raw Notion response')
    )

    await expect(handlers['sync:all']({})).rejects.toMatchObject({
      message: 'INTERNAL_ERROR',
      stack: ''
    })
  })

  it('TC-SYNC-IPC-005: preserves approved renderer-facing error codes', async () => {
    service.syncSource.mockRejectedValue(new Error('SOURCE_NOT_SYNCABLE'))

    await expect(handlers['sync:source']({}, { sourceId: 'source-1' })).rejects.toMatchObject({
      message: 'SOURCE_NOT_SYNCABLE',
      stack: ''
    })
  })
})

function emptyCounts() {
  return {
    created: 0,
    updated: 0,
    changed: 0,
    missing: 0,
    errors: 0
  }
}
