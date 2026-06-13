import { computed, ref } from 'vue'
import type {
  TodayReviewItemDto,
  TodayReviewListFilterDto,
  TodayReviewListInputDto,
  TodayReviewListResultDto
} from '../../../shared/today-review'

export interface TodayReviewRendererApi {
  list: (payload?: TodayReviewListInputDto) => Promise<TodayReviewListResultDto>
}

type TodayReviewUiState = 'idle' | 'loading' | 'error'

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED_SENDER: '복습 목록 요청 권한을 확인할 수 없습니다.',
  INVALID_PAYLOAD: '복습 목록 요청 형식이 올바르지 않습니다.',
  INTERNAL_ERROR: '복습 목록을 불러오지 못했습니다.'
}

function publicError(error: unknown): string {
  const code = error instanceof Error ? error.message : ''
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR
}

function dueLabel(dueAt: string): string {
  const dueTime = Date.parse(dueAt)
  if (Number.isNaN(dueTime)) return '오늘'

  const now = Date.now()
  if (dueTime > now) return '오늘'

  const elapsedDays = Math.floor((now - dueTime) / 86_400_000)
  return elapsedDays <= 0 ? '오늘' : `${elapsedDays}일 지남`
}

export function useTodayReview(api: TodayReviewRendererApi) {
  const items = ref<TodayReviewItemDto[]>([])
  const selectedId = ref<string | null>(null)
  const state = ref<TodayReviewUiState>('idle')
  const message = ref('')
  const sourceFilterId = ref<string | null>(null)

  const selectedItem = computed(
    () => items.value.find((item) => item.id === selectedId.value) ?? items.value[0] ?? null
  )

  async function load(): Promise<void> {
    state.value = 'loading'
    try {
      const filter: TodayReviewListFilterDto | undefined = sourceFilterId.value
        ? { kind: 'source', sourceId: sourceFilterId.value }
        : undefined
      const result = await api.list({ sort: 'due', filter })
      items.value = result.items
      if (!items.value.some((item) => item.id === selectedId.value)) {
        selectedId.value = items.value[0]?.id ?? null
      }
      message.value = result.isEmpty
        ? '오늘 복습할 항목이 없습니다. Source를 동기화하면 새 항목이 표시됩니다.'
        : ''
    } catch (error) {
      state.value = 'error'
      message.value = publicError(error)
    } finally {
      if (state.value === 'loading') state.value = 'idle'
    }
  }

  async function setSourceFilter(sourceId: string | null): Promise<void> {
    sourceFilterId.value = sourceId
    selectedId.value = null
    await load()
  }

  function removeItem(reviewItemId: string): void {
    items.value = items.value.filter((item) => item.id !== reviewItemId)
    if (selectedId.value === reviewItemId) {
      selectedId.value = items.value[0]?.id ?? null
    }
    if (items.value.length === 0) {
      message.value = '오늘 복습할 항목이 없습니다. Source를 동기화하면 새 항목이 표시됩니다.'
    }
  }

  return {
    items,
    selectedId,
    selectedItem,
    sourceFilterId,
    state,
    message,
    dueLabel,
    load,
    setSourceFilter,
    removeItem
  }
}
