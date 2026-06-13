import { computed, ref } from 'vue'
import type {
  ManualSyncResult,
  SourceSyncCounts,
  SyncFailureCode,
  SyncProgress
} from '../../../shared/manual-sync'

export interface SyncSourceOption {
  id: string
  name: string
  enabled: boolean
}

export interface ManualSyncRendererApi {
  syncAll: () => Promise<ManualSyncResult>
  syncSource: (payload: { sourceId: string }) => Promise<ManualSyncResult>
  cancel: () => Promise<{ cancelled: true }>
  onProgress: (listener: (progress: SyncProgress) => void) => () => void
}

export interface SyncSourceReaderApi {
  listSources: () => Promise<SyncSourceOption[]>
}

type SyncUiState = 'idle' | 'running' | 'cancelling' | 'completed' | 'cancelled' | 'error'

const EMPTY_COUNTS: SourceSyncCounts = {
  created: 0,
  updated: 0,
  changed: 0,
  missing: 0,
  errors: 0
}

const ERROR_MESSAGES: Record<string, string> = {
  SOURCE_NOT_SYNCABLE: '선택한 Source를 동기화할 수 없습니다.',
  SYNC_IN_PROGRESS: '이미 동기화가 진행 중입니다.',
  NO_SYNC_IN_PROGRESS: '진행 중인 동기화가 없습니다.',
  UNAUTHORIZED_SENDER: '동기화 요청 권한을 확인할 수 없습니다.',
  INVALID_PAYLOAD: '동기화 요청 형식이 올바르지 않습니다.',
  INTERNAL_ERROR: '동기화 중 내부 오류가 발생했습니다.'
}

const FAILURE_MESSAGES: Record<SyncFailureCode, string> = {
  unauthorized: 'Notion 토큰을 확인하세요.',
  forbidden: 'Notion 공유 권한을 확인하세요.',
  not_found: 'Notion Source를 찾을 수 없습니다.',
  rate_limit: '요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.',
  network_error: '네트워크 연결을 확인하세요.',
  schema_mismatch: 'Source 필드 매핑을 확인하세요.',
  internal_error: '동기화 중 내부 오류가 발생했습니다.'
}

export interface ManualSyncUiDependencies {
  manualSync: ManualSyncRendererApi
  reviewSource: SyncSourceReaderApi
}

export function useManualSync(dependencies: ManualSyncUiDependencies) {
  const sources = ref<SyncSourceOption[]>([])
  const selectedSourceId = ref('')
  const state = ref<SyncUiState>('idle')
  const currentSourceId = ref<string | null>(null)
  const result = ref<ManualSyncResult | null>(null)
  const message = ref('')
  let unsubscribeProgress: (() => void) | null = null

  const enabledSources = computed(() => sources.value.filter((source) => source.enabled))
  const isRunning = computed(() => state.value === 'running' || state.value === 'cancelling')
  const currentSourceName = computed(
    () =>
      sources.value.find((source) => source.id === currentSourceId.value)?.name ??
      currentSourceId.value
  )
  const totals = computed(() => result.value?.totals ?? EMPTY_COUNTS)

  function publicError(error: unknown): string {
    const code = error instanceof Error ? error.message : ''
    return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR
  }

  function sourceName(sourceId: string): string {
    return sources.value.find((source) => source.id === sourceId)?.name ?? sourceId
  }

  function failureMessage(code: SyncFailureCode | null): string {
    return code ? FAILURE_MESSAGES[code] : ''
  }

  function handleProgress(progress: SyncProgress): void {
    currentSourceId.value = progress.sourceId
    if (progress.state === 'running') {
      state.value = 'running'
      message.value = `${sourceName(progress.sourceId)} 동기화 중`
    } else if (progress.state === 'source-failed') {
      message.value = `${sourceName(progress.sourceId)}: ${failureMessage(progress.code)}`
    } else if (progress.state === 'source-cancelled') {
      state.value = 'cancelled'
      message.value = '동기화가 취소되었습니다.'
    }
  }

  function subscribe(): void {
    if (!unsubscribeProgress) {
      unsubscribeProgress = dependencies.manualSync.onProgress(handleProgress)
    }
  }

  function dispose(): void {
    unsubscribeProgress?.()
    unsubscribeProgress = null
  }

  async function loadSources(): Promise<void> {
    try {
      sources.value = await dependencies.reviewSource.listSources()
      if (!enabledSources.value.some((source) => source.id === selectedSourceId.value)) {
        selectedSourceId.value = enabledSources.value[0]?.id ?? ''
      }
    } catch (error) {
      state.value = 'error'
      message.value = publicError(error)
    }
  }

  async function run(request: () => Promise<ManualSyncResult>): Promise<void> {
    if (isRunning.value) return

    state.value = 'running'
    currentSourceId.value = null
    result.value = null
    message.value = '동기화를 시작합니다.'
    try {
      const nextResult = await request()
      result.value = nextResult
      if (nextResult.sources.some((source) => source.status === 'cancelled')) {
        state.value = 'cancelled'
        message.value = '동기화가 취소되었습니다.'
      } else {
        state.value = 'completed'
        message.value = nextResult.sources.some((source) => source.status === 'failed')
          ? '일부 Source 동기화에 실패했습니다.'
          : '동기화가 완료되었습니다.'
      }
    } catch (error) {
      state.value = 'error'
      message.value = publicError(error)
    } finally {
      currentSourceId.value = null
    }
  }

  async function syncAll(): Promise<void> {
    await run(() => dependencies.manualSync.syncAll())
  }

  async function syncSelected(): Promise<void> {
    const source = enabledSources.value.find((entry) => entry.id === selectedSourceId.value)
    if (!source) {
      state.value = 'error'
      message.value = '활성 Source를 선택하세요.'
      return
    }
    await run(() => dependencies.manualSync.syncSource({ sourceId: source.id }))
  }

  async function cancel(): Promise<void> {
    if (!isRunning.value || state.value === 'cancelling') return
    state.value = 'cancelling'
    message.value = '동기화를 취소하는 중입니다.'
    try {
      await dependencies.manualSync.cancel()
    } catch (error) {
      state.value = 'error'
      message.value = publicError(error)
    }
  }

  return {
    sources,
    enabledSources,
    selectedSourceId,
    state,
    currentSourceName,
    result,
    totals,
    message,
    isRunning,
    sourceName,
    failureMessage,
    subscribe,
    dispose,
    loadSources,
    syncAll,
    syncSelected,
    cancel
  }
}
