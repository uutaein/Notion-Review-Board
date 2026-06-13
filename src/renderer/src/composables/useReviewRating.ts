import { computed, ref } from 'vue'
import type {
  RateReviewInputDto,
  RateReviewResultDto,
  ReviewRating
} from '../../../shared/review-rating'

export interface ReviewRatingRendererApi {
  rate: (payload: RateReviewInputDto) => Promise<RateReviewResultDto>
}

type ReviewRatingUiState = 'idle' | 'saving' | 'error'

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED_SENDER: '복습 평가 권한을 확인할 수 없습니다.',
  INVALID_PAYLOAD: '복습 평가 요청 형식이 올바르지 않습니다.',
  REVIEW_ITEM_NOT_FOUND: '복습 항목을 찾을 수 없습니다.',
  REVIEW_ITEM_NOT_ACTIVE: '활성 복습 항목만 평가할 수 있습니다.',
  INTERNAL_ERROR: '평가 저장에 실패했습니다.'
}

function publicError(error: unknown): string {
  const code = error instanceof Error ? error.message : ''
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR
}

export function useReviewRating(api: ReviewRatingRendererApi) {
  const state = ref<ReviewRatingUiState>('idle')
  const pendingItemId = ref<string | null>(null)
  const message = ref('')
  const isPending = computed(() => state.value === 'saving')

  async function rate(reviewItemId: string, rating: ReviewRating): Promise<boolean> {
    if (state.value === 'saving') return false

    state.value = 'saving'
    pendingItemId.value = reviewItemId
    message.value = ''
    try {
      await api.rate({ reviewItemId, rating })
      state.value = 'idle'
      pendingItemId.value = null
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
    rate
  }
}
