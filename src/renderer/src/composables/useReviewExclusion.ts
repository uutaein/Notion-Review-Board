import { computed, ref } from 'vue'
import type {
  ExcludeReviewItemInputDto,
  ExcludeReviewItemResultDto
} from '../../../shared/review-exclusion'

export interface ReviewExclusionRendererApi {
  exclude: (payload: ExcludeReviewItemInputDto) => Promise<ExcludeReviewItemResultDto>
}

type ReviewExclusionUiState = 'idle' | 'saving' | 'error'

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED_SENDER: '문서 제외 권한을 확인할 수 없습니다.',
  INVALID_PAYLOAD: '문서 제외 요청 형식이 올바르지 않습니다.',
  REVIEW_ITEM_NOT_FOUND: '복습 항목을 찾을 수 없습니다.',
  REVIEW_ITEM_NOT_ACTIVE: '활성 복습 항목만 제외할 수 있습니다.',
  INTERNAL_ERROR: '문서 제외에 실패했습니다.'
}

function publicError(error: unknown): string {
  const code = error instanceof Error ? error.message : ''
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR
}

export function useReviewExclusion(api: ReviewExclusionRendererApi) {
  const state = ref<ReviewExclusionUiState>('idle')
  const pendingItemId = ref<string | null>(null)
  const message = ref('')
  const isPending = computed(() => state.value === 'saving')

  async function exclude(reviewItemId: string): Promise<boolean> {
    if (state.value === 'saving') return false

    state.value = 'saving'
    pendingItemId.value = reviewItemId
    message.value = ''
    try {
      await api.exclude({ reviewItemId })
      state.value = 'idle'
      pendingItemId.value = null
      message.value = '문서를 복습 목록에서 제외했습니다.'
      return true
    } catch (error) {
      state.value = 'error'
      message.value = publicError(error)
      pendingItemId.value = null
      return false
    }
  }

  return {
    state,
    pendingItemId,
    message,
    isPending,
    exclude
  }
}
