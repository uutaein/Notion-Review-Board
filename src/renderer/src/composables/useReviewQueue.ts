import { computed, ref } from 'vue'
import type { ReviewQueueItemDto, ReviewQueueListResultDto } from '../../../shared/review-queue'

export interface ReviewQueueRendererApi {
  list: () => Promise<ReviewQueueListResultDto>
}

type ReviewQueueUiState = 'idle' | 'loading' | 'error'

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED_SENDER: '전체 큐 요청 권한을 확인할 수 없습니다.',
  INVALID_PAYLOAD: '전체 큐 요청 형식이 올바르지 않습니다.',
  INTERNAL_ERROR: '전체 큐를 불러오지 못했습니다.'
}

function publicError(error: unknown): string {
  const code = error instanceof Error ? error.message : ''
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR
}

export function dueScheduleLabel(dueAt: string): string {
  const dueTime = Date.parse(dueAt)
  if (Number.isNaN(dueTime)) return '-'

  const diffMs = dueTime - Date.now()
  const dayMs = 86_400_000
  if (diffMs > dayMs) return `${Math.ceil(diffMs / dayMs)}일 후`
  if (diffMs > 0) return '오늘 예정'

  const elapsedDays = Math.floor(Math.abs(diffMs) / dayMs)
  return elapsedDays <= 0 ? '오늘까지' : `${elapsedDays}일 지남`
}

export function useReviewQueue(api: ReviewQueueRendererApi) {
  const items = ref<ReviewQueueItemDto[]>([])
  const selectedId = ref<string | null>(null)
  const state = ref<ReviewQueueUiState>('idle')
  const message = ref('')

  const selectedItem = computed(
    () => items.value.find((item) => item.id === selectedId.value) ?? items.value[0] ?? null
  )

  async function load(): Promise<void> {
    state.value = 'loading'
    try {
      const result = await api.list()
      items.value = result.items
      if (!items.value.some((item) => item.id === selectedId.value)) {
        selectedId.value = items.value[0]?.id ?? null
      }
      message.value = result.isEmpty
        ? '전체 큐에 active 항목이 없습니다. Source를 동기화하면 항목이 표시됩니다.'
        : ''
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
    state,
    message,
    dueScheduleLabel,
    load
  }
}
