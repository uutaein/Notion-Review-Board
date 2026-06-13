import { computed, ref } from 'vue'
import type {
  ChangedPageAction,
  HandleChangedPageInputDto,
  HandleChangedPageResultDto,
  StatusPageItemDto,
  StatusPageKind,
  StatusPageListInputDto,
  StatusPageListResultDto
} from '../../../shared/status-pages'

export interface StatusPagesRendererApi {
  list: (payload: StatusPageListInputDto) => Promise<StatusPageListResultDto>
  handleChanged: (payload: HandleChangedPageInputDto) => Promise<HandleChangedPageResultDto>
}

type StatusPagesUiState = 'idle' | 'loading' | 'error'

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED_SENDER: '상태 페이지 요청 권한을 확인할 수 없습니다.',
  INVALID_PAYLOAD: '상태 페이지 요청 형식이 올바르지 않습니다.',
  INTERNAL_ERROR: '상태 페이지를 불러오지 못했습니다.'
}

const ACTION_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED_SENDER: '변경 항목 처리 권한을 확인할 수 없습니다.',
  INVALID_PAYLOAD: '변경 항목 처리 요청 형식이 올바르지 않습니다.',
  STATUS_ITEM_NOT_FOUND: '변경 항목을 찾을 수 없습니다.',
  STATUS_ITEM_NOT_CHANGED: '변경 상태 항목만 처리할 수 있습니다.',
  INTERNAL_ERROR: '변경 항목 처리에 실패했습니다.'
}

function publicError(error: unknown): string {
  const code = error instanceof Error ? error.message : ''
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR
}

function publicActionError(error: unknown): string {
  const code = error instanceof Error ? error.message : ''
  return ACTION_ERROR_MESSAGES[code] ?? ACTION_ERROR_MESSAGES.INTERNAL_ERROR
}

export function useStatusPages(api: StatusPagesRendererApi) {
  const items = ref<StatusPageItemDto[]>([])
  const selectedId = ref<string | null>(null)
  const kind = ref<StatusPageKind>('changed')
  const state = ref<StatusPagesUiState>('idle')
  const actionState = ref<StatusPagesUiState>('idle')
  const message = ref('')

  const selectedItem = computed(
    () => items.value.find((item) => item.id === selectedId.value) ?? items.value[0] ?? null
  )

  async function load(nextKind: StatusPageKind): Promise<void> {
    kind.value = nextKind
    state.value = 'loading'
    try {
      const result = await api.list({ kind: nextKind })
      items.value = result.items
      if (!items.value.some((item) => item.id === selectedId.value)) {
        selectedId.value = items.value[0]?.id ?? null
      }
      message.value = result.isEmpty ? emptyMessage(nextKind) : ''
    } catch (error) {
      state.value = 'error'
      message.value = publicError(error)
    } finally {
      if (state.value === 'loading') state.value = 'idle'
    }
  }

  async function handleChanged(reviewItemId: string, action: ChangedPageAction): Promise<boolean> {
    if (actionState.value === 'loading') return false

    actionState.value = 'loading'
    message.value = ''
    try {
      await api.handleChanged({ reviewItemId, action })
      items.value = items.value.filter((item) => item.id !== reviewItemId)
      if (selectedId.value === reviewItemId) {
        selectedId.value = items.value[0]?.id ?? null
      }
      if (items.value.length === 0) {
        message.value = emptyMessage(kind.value)
      }
      actionState.value = 'idle'
      return true
    } catch (error) {
      actionState.value = 'error'
      message.value = publicActionError(error)
      return false
    }
  }

  return {
    items,
    selectedId,
    selectedItem,
    kind,
    state,
    actionState,
    message,
    load,
    handleChanged
  }
}

export function emptyMessage(kind: StatusPageKind): string {
  return kind === 'changed' ? '변경된 페이지가 없습니다.' : '누락되거나 삭제된 페이지가 없습니다.'
}
