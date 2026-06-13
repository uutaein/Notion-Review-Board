import { computed, ref } from 'vue'
import type { NotionConnectionStatus } from '../../../shared/notion-connection'

export type { NotionConnectionStatus } from '../../../shared/notion-connection'

export interface NotionConnectionRendererApi {
  getStatus: () => Promise<NotionConnectionStatus>
  saveToken: (payload: { token: string }) => Promise<NotionConnectionStatus>
  deleteToken: () => Promise<NotionConnectionStatus>
  verify: () => Promise<NotionConnectionStatus>
}

type ConnectionUiState = 'idle' | 'saving' | 'verifying' | 'deleting'

const STATUS_MESSAGES: Record<NotionConnectionStatus, string> = {
  not_configured: 'Notion 토큰이 설정되지 않았습니다.',
  configured: '토큰이 저장되었습니다. 연결 검증을 실행하세요.',
  connected: 'Notion 연결이 확인되었습니다.',
  unauthorized: '인증 실패: 토큰을 확인하세요.',
  forbidden: '권한 부족: Notion 공유 권한을 확인하세요.',
  rate_limited: '요청 한도 초과: 잠시 후 다시 시도하세요.',
  network_error: '네트워크 오류: 연결 상태를 확인하세요.'
}

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_PAYLOAD: '토큰을 입력하세요.',
  PERSISTENCE_ERROR: '토큰을 저장하지 못했습니다.',
  OS_ENCRYPTION_UNAVAILABLE: '운영체제 보안 저장소를 사용할 수 없습니다.',
  DISALLOWED_ENCRYPTION_BACKEND: '안전하지 않은 보안 저장소라 토큰을 저장하지 않았습니다.',
  DECRYPTION_ERROR: '저장된 토큰을 읽을 수 없습니다.',
  MISSING_TOKEN: '먼저 Notion 토큰을 저장하세요.',
  INTERNAL_ERROR: 'Notion 연결 설정 중 오류가 발생했습니다.'
}

export function useNotionConnection(api: NotionConnectionRendererApi) {
  const tokenInput = ref('')
  const status = ref<NotionConnectionStatus>('not_configured')
  const state = ref<ConnectionUiState>('idle')
  const message = ref(STATUS_MESSAGES.not_configured)

  const canSave = computed(() => state.value === 'idle' && tokenInput.value.trim().length > 0)
  const canVerify = computed(() => state.value === 'idle' && status.value !== 'not_configured')
  const canDelete = computed(() => state.value === 'idle' && status.value !== 'not_configured')
  const isBusy = computed(() => state.value !== 'idle')

  function publicError(error: unknown): string {
    const code = error instanceof Error ? error.message : ''
    return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR
  }

  function setStatus(nextStatus: NotionConnectionStatus): void {
    status.value = nextStatus
    message.value = STATUS_MESSAGES[nextStatus]
  }

  async function loadStatus(): Promise<void> {
    try {
      setStatus(await api.getStatus())
    } catch (error) {
      message.value = publicError(error)
    }
  }

  async function save(): Promise<void> {
    if (!canSave.value) {
      message.value = ERROR_MESSAGES.INVALID_PAYLOAD
      return
    }

    state.value = 'saving'
    try {
      const token = tokenInput.value
      setStatus(await api.saveToken({ token }))
      tokenInput.value = ''
    } catch (error) {
      message.value = publicError(error)
    } finally {
      state.value = 'idle'
    }
  }

  async function verify(): Promise<void> {
    if (!canVerify.value) {
      message.value = ERROR_MESSAGES.MISSING_TOKEN
      return
    }

    state.value = 'verifying'
    try {
      setStatus(await api.verify())
    } catch (error) {
      message.value = publicError(error)
    } finally {
      state.value = 'idle'
    }
  }

  async function deleteToken(confirmDelete: () => boolean = () => false): Promise<void> {
    if (!canDelete.value || !confirmDelete()) return

    state.value = 'deleting'
    try {
      setStatus(await api.deleteToken())
      tokenInput.value = ''
    } catch (error) {
      message.value = publicError(error)
    } finally {
      state.value = 'idle'
    }
  }

  return {
    tokenInput,
    status,
    state,
    message,
    canSave,
    canVerify,
    canDelete,
    isBusy,
    loadStatus,
    save,
    verify,
    deleteToken
  }
}
