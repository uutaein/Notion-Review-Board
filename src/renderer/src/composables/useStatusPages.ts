import { computed, ref } from 'vue'
import type {
  StatusPageItemDto,
  StatusPageKind,
  StatusPageListInputDto,
  StatusPageListResultDto
} from '../../../shared/status-pages'

export interface StatusPagesRendererApi {
  list: (payload: StatusPageListInputDto) => Promise<StatusPageListResultDto>
}

type StatusPagesUiState = 'idle' | 'loading' | 'error'

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED_SENDER: '상태 페이지 요청 권한을 확인할 수 없습니다.',
  INVALID_PAYLOAD: '상태 페이지 요청 형식이 올바르지 않습니다.',
  INTERNAL_ERROR: '상태 페이지를 불러오지 못했습니다.'
}

function publicError(error: unknown): string {
  const code = error instanceof Error ? error.message : ''
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR
}

export function useStatusPages(api: StatusPagesRendererApi) {
  const items = ref<StatusPageItemDto[]>([])
  const selectedId = ref<string | null>(null)
  const kind = ref<StatusPageKind>('changed')
  const state = ref<StatusPagesUiState>('idle')
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

  return {
    items,
    selectedId,
    selectedItem,
    kind,
    state,
    message,
    load
  }
}

export function emptyMessage(kind: StatusPageKind): string {
  return kind === 'changed' ? '변경된 페이지가 없습니다.' : '누락되거나 삭제된 페이지가 없습니다.'
}
