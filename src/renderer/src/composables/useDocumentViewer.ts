import { ref } from 'vue'
import type {
  DocumentViewerBoundsDto,
  DocumentViewerCloseResultDto,
  DocumentViewerOpenInputDto,
  DocumentViewerOpenResultDto
} from '../../../shared/document-viewer'

export interface DocumentViewerRendererApi {
  open: (payload: DocumentViewerOpenInputDto) => Promise<DocumentViewerOpenResultDto>
  openExternal: (payload: { url: string }) => Promise<DocumentViewerOpenResultDto>
  close: () => Promise<DocumentViewerCloseResultDto>
}

type DocumentViewerUiState = 'idle' | 'opening' | 'error'

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED_SENDER: '문서 열기 권한을 확인할 수 없습니다.',
  INVALID_PAYLOAD: '문서 URL 형식이 올바르지 않습니다.',
  UNSAFE_DOCUMENT_URL: '허용된 Notion HTTPS 문서만 열 수 있습니다.',
  INTERNAL_ERROR: '문서를 열 수 없습니다. 외부 브라우저 열기를 시도해 주세요.'
}

function publicError(error: unknown): string {
  const code = error instanceof Error ? error.message : ''
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR
}

export function useDocumentViewer(api: DocumentViewerRendererApi) {
  const state = ref<DocumentViewerUiState>('idle')
  const message = ref('')

  async function open(url: string, bounds: DocumentViewerBoundsDto): Promise<boolean> {
    if (state.value === 'opening') return false

    state.value = 'opening'
    message.value = ''
    try {
      await api.open({ url, bounds })
      state.value = 'idle'
      message.value = '내부 뷰어에서 문서를 열었습니다.'
      return true
    } catch (error) {
      state.value = 'error'
      message.value = publicError(error)
      return false
    }
  }

  async function openExternal(url: string): Promise<boolean> {
    if (state.value === 'opening') return false

    state.value = 'opening'
    message.value = ''
    try {
      await api.openExternal({ url })
      state.value = 'idle'
      message.value = '외부 브라우저에서 문서를 열었습니다.'
      return true
    } catch (error) {
      state.value = 'error'
      message.value = publicError(error)
      return false
    }
  }

  async function close(): Promise<void> {
    try {
      await api.close()
    } catch {
      // Closing is best-effort because the view may already be gone after window teardown.
    }
  }

  return {
    state,
    message,
    open,
    openExternal,
    close
  }
}
