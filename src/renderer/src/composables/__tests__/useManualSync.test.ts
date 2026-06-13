import { describe, expect, it, vi } from 'vitest'
import type { ManualSyncResult, SyncProgress } from '../../../../shared/manual-sync'
import {
  useManualSync,
  type ManualSyncRendererApi,
  type SyncSourceOption,
  type SyncSourceReaderApi
} from '../useManualSync'

function source(id: string, enabled = true): SyncSourceOption {
  return {
    id,
    name: `Source ${id}`,
    enabled
  }
}

function setup(sourceList = [source('enabled'), source('disabled', false)]) {
  let progressListener: ((progress: SyncProgress) => void) | null = null
  const unsubscribe = vi.fn()
  const manualSync = {
    syncAll: vi.fn(),
    syncSource: vi.fn(),
    cancel: vi.fn(),
    onProgress: vi.fn((listener) => {
      progressListener = listener
      return unsubscribe
    })
  } as ManualSyncRendererApi
  const reviewSource = {
    listSources: vi.fn().mockResolvedValue(sourceList)
  } as SyncSourceReaderApi
  const model = useManualSync({ manualSync, reviewSource })
  return {
    model,
    manualSync,
    reviewSource,
    unsubscribe,
    emitProgress: (progress: SyncProgress) => progressListener?.(progress)
  }
}

function result(status: 'completed' | 'failed' | 'cancelled' = 'completed'): ManualSyncResult {
  const errors = status === 'failed' ? 1 : 0
  return {
    sources: [
      {
        sourceId: 'enabled',
        status,
        counts: { created: 2, updated: 1, changed: 1, missing: 0, errors },
        errorCode: status === 'failed' ? ('network_error' as const) : null
      }
    ],
    totals: { created: 2, updated: 1, changed: 1, missing: 0, errors }
  }
}

describe('Manual Sync renderer model', () => {
  it('TC-SYNC-UI-001: starts sync-all from the review screen model', async () => {
    const { model, manualSync } = setup()
    vi.mocked(manualSync.syncAll).mockResolvedValue(result())

    await model.syncAll()

    expect(manualSync.syncAll).toHaveBeenCalledOnce()
    expect(model.state.value).toBe('completed')
  })

  it('TC-SYNC-UI-002/003: selects only enabled Sources for single sync', async () => {
    const { model, manualSync } = setup()
    vi.mocked(manualSync.syncSource).mockResolvedValue(result())

    await model.loadSources()
    expect(model.enabledSources.value.map(({ id }) => id)).toEqual(['enabled'])
    expect(model.selectedSourceId.value).toBe('enabled')

    await model.syncSelected()
    expect(manualSync.syncSource).toHaveBeenCalledWith({ sourceId: 'enabled' })
  })

  it('TC-SYNC-UI-004: reports the current Source from progress', async () => {
    const { model, emitProgress } = setup()
    model.subscribe()
    await model.loadSources()

    emitProgress({ state: 'running', sourceId: 'enabled' })

    expect(model.state.value).toBe('running')
    expect(model.currentSourceName.value).toBe('Source enabled')
    expect(model.message.value).toBe('Source enabled 동기화 중')
  })

  it('TC-SYNC-UI-005: exposes completion totals', async () => {
    const { model, manualSync } = setup()
    vi.mocked(manualSync.syncAll).mockResolvedValue(result())

    await model.syncAll()

    expect(model.totals.value).toEqual({
      created: 2,
      updated: 1,
      changed: 1,
      missing: 0,
      errors: 0
    })
  })

  it('TC-SYNC-UI-006: distinguishes a failed Source and gives a public action', async () => {
    const { model, manualSync } = setup()
    vi.mocked(manualSync.syncAll).mockResolvedValue(result('failed'))

    await model.syncAll()

    expect(model.state.value).toBe('completed')
    expect(model.message.value).toBe('일부 Source 동기화에 실패했습니다.')
    expect(model.failureMessage('network_error')).toBe('네트워크 연결을 확인하세요.')
  })

  it('TC-SYNC-UI-007/008: requests cancellation and keeps it distinct from failure', async () => {
    const { model, manualSync } = setup()
    let resolveSync: ((value: ReturnType<typeof result>) => void) | undefined
    vi.mocked(manualSync.syncAll).mockImplementation(
      () => new Promise((resolve) => (resolveSync = resolve))
    )
    vi.mocked(manualSync.cancel).mockResolvedValue({ cancelled: true })

    const running = model.syncAll()
    await model.cancel()
    expect(model.state.value).toBe('cancelling')
    expect(manualSync.cancel).toHaveBeenCalledOnce()

    resolveSync?.(result('cancelled'))
    await running
    expect(model.state.value).toBe('cancelled')
    expect(model.message.value).toBe('동기화가 취소되었습니다.')
  })

  it('TC-SYNC-UI-009: ignores duplicate start actions while running', async () => {
    const { model, manualSync } = setup()
    let resolveSync: ((value: ReturnType<typeof result>) => void) | undefined
    vi.mocked(manualSync.syncAll).mockImplementation(
      () => new Promise((resolve) => (resolveSync = resolve))
    )

    const first = model.syncAll()
    await model.syncAll()
    expect(manualSync.syncAll).toHaveBeenCalledOnce()

    resolveSync?.(result())
    await first
  })

  it('TC-SYNC-UI-010: replaces unknown backend details with a sanitized message', async () => {
    const { model, manualSync } = setup()
    vi.mocked(manualSync.syncAll).mockRejectedValue(
      new Error('secret token SQL path raw Notion response')
    )

    await model.syncAll()

    expect(model.state.value).toBe('error')
    expect(model.message.value).toBe('동기화 중 내부 오류가 발생했습니다.')
    expect(model.message.value).not.toContain('secret')
  })

  it('subscribes once and releases the progress listener', () => {
    const { model, manualSync, unsubscribe } = setup()

    model.subscribe()
    model.subscribe()
    model.dispose()

    expect(manualSync.onProgress).toHaveBeenCalledOnce()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
