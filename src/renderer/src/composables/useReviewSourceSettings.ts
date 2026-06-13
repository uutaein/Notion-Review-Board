import { computed, ref } from 'vue'
import type { CollectionMode, FilterOperator } from '../../../shared/domain/source'

export interface SourcePropertyOption {
  id: string
  name: string
  type: string
}

export interface ReviewSourceSummary {
  id: string
  name: string
  notionTargetId: string
  notionTargetUrl: string | null
  enabled: boolean
  collectionMode: string
  titlePropertyName: string
  urlPropertyName: string | null
  categoryPropertyName: string | null
  tagPropertyName: string | null
  sourcePropertyName: string | null
  reviewCheckboxPropertyName: string | null
  lastEditedPropertyName: string | null
  filterPropertyName: string | null
  filterOperator: string | null
  filterValue: string | null
  lastSyncedAt: string | null
}

export type SourceDeletePolicy = 'archive' | 'delete' | 'keep-history'

export interface ReviewSourceSettingsApi {
  listSources: () => Promise<ReviewSourceSummary[]>
  createSource: (payload: {
    name: string
    target: string
    enabled: boolean
    collectionMode: CollectionMode
    titlePropertyName: string
    urlPropertyName?: string | null
    categoryPropertyName?: string | null
    tagPropertyName?: string | null
    sourcePropertyName?: string | null
    reviewCheckboxPropertyName?: string | null
    lastEditedPropertyName?: string | null
    filterPropertyName?: string | null
    filterOperator?: FilterOperator | null
    filterValue?: string | null
  }) => Promise<ReviewSourceSummary>
  updateSource: (payload: {
    id: string
    name: string
    enabled: boolean
    collectionMode: CollectionMode
    titlePropertyName: string
    urlPropertyName?: string | null
    categoryPropertyName?: string | null
    tagPropertyName?: string | null
    sourcePropertyName?: string | null
    reviewCheckboxPropertyName?: string | null
    lastEditedPropertyName?: string | null
    filterPropertyName?: string | null
    filterOperator?: FilterOperator | null
    filterValue?: string | null
  }) => Promise<ReviewSourceSummary>
  deleteSource: (payload: {
    sourceId: string
    itemPolicy: SourceDeletePolicy
  }) => Promise<{ success: boolean }>
  setEnabled: (payload: { sourceId: string; enabled: boolean }) => Promise<ReviewSourceSummary>
}

export interface NotionMappingApi {
  listProperties: (payload: { target: string }) => Promise<SourcePropertyOption[]>
}

export interface ReviewSourceSettingsDependencies {
  reviewSource: ReviewSourceSettingsApi
  notionMetadata: NotionMappingApi
  onSourcesChanged?: () => Promise<void> | void
}

type SourceSettingsState = 'idle' | 'loading' | 'saving' | 'error'

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_PAYLOAD: '필수 Source 정보를 확인하세요.',
  MISSING_TOKEN: '먼저 Notion 토큰을 저장하세요.',
  DUPLICATE_TARGET: '이미 등록된 Notion 대상입니다.',
  UNAUTHORIZED: 'Notion 토큰을 확인하세요.',
  FORBIDDEN: 'Notion 공유 권한을 확인하세요.',
  NOT_FOUND: 'Notion 대상 URL 또는 ID를 확인하세요.',
  RATE_LIMITED: '요청 한도 초과: 잠시 후 다시 시도하세요.',
  NETWORK_ERROR: '네트워크 연결을 확인하세요.',
  INVALID_NAME: 'Source 이름을 입력하세요.',
  INVALID_TITLE_MAPPING: '제목 속성을 선택하세요.',
  INVALID_TAG_FILTER: '태그/분류 필터 설정을 확인하세요.',
  INVALID_CHECKBOX_MAPPING: '체크박스 속성을 선택하세요.',
  INTERNAL_ERROR: 'Source 설정 중 오류가 발생했습니다.'
}

export function useReviewSourceSettings(dependencies: ReviewSourceSettingsDependencies) {
  const sources = ref<ReviewSourceSummary[]>([])
  const properties = ref<SourcePropertyOption[]>([])
  const state = ref<SourceSettingsState>('idle')
  const message = ref('')
  const editingSourceId = ref<string | null>(null)
  const deletePolicy = ref<SourceDeletePolicy>('archive')
  const form = ref({
    name: '',
    target: '',
    enabled: true,
    collectionMode: 'all' as CollectionMode,
    titlePropertyName: '',
    urlPropertyName: '',
    categoryPropertyName: '',
    tagPropertyName: '',
    sourcePropertyName: '',
    reviewCheckboxPropertyName: '',
    lastEditedPropertyName: '',
    filterPropertyName: '',
    filterOperator: 'equals' as FilterOperator,
    filterValue: ''
  })

  const titleProperties = computed(() =>
    properties.value.filter((property) => property.type === 'title')
  )
  const urlProperties = computed(() =>
    properties.value.filter((property) => property.type === 'url')
  )
  const textLikeProperties = computed(() =>
    properties.value.filter((property) =>
      ['title', 'rich_text', 'select', 'status', 'date', 'last_edited_time'].includes(property.type)
    )
  )
  const multiSelectProperties = computed(() =>
    properties.value.filter((property) => property.type === 'multi_select')
  )
  const checkboxProperties = computed(() =>
    properties.value.filter((property) => property.type === 'checkbox')
  )
  const filterProperties = computed(() =>
    properties.value.filter((property) =>
      ['select', 'status', 'multi_select', 'rich_text'].includes(property.type)
    )
  )
  const hasProperties = computed(() => properties.value.length > 0)
  const isBusy = computed(() => state.value === 'loading' || state.value === 'saving')
  const isEditing = computed(() => editingSourceId.value !== null)

  function optional(value: string): string | null {
    return value.trim() === '' ? null : value
  }

  function collectionMode(value: string): CollectionMode {
    return value === 'tag' || value === 'checkbox' || value === 'all' ? value : 'all'
  }

  function filterOperator(value: string | null): FilterOperator {
    return value === 'contains' || value === 'checked' || value === 'equals' ? value : 'equals'
  }

  function publicError(error: unknown): string {
    const code = error instanceof Error ? error.message : ''
    return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR
  }

  function validateForm(): string | null {
    if (form.value.name.trim() === '') return 'Source 이름을 입력하세요.'
    if (!isEditing.value && form.value.target.trim() === '') {
      return 'Notion 대상 URL 또는 ID를 입력하세요.'
    }
    if (form.value.titlePropertyName.trim() === '') return '제목 속성을 선택하세요.'
    if (form.value.collectionMode === 'tag') {
      if (form.value.filterPropertyName.trim() === '' || form.value.filterValue.trim() === '') {
        return '태그/분류 필터 속성과 값을 입력하세요.'
      }
    }
    if (
      form.value.collectionMode === 'checkbox' &&
      form.value.reviewCheckboxPropertyName.trim() === ''
    ) {
      return '체크박스 속성을 선택하세요.'
    }
    return null
  }

  function resetModeFields(): void {
    if (form.value.collectionMode === 'all') {
      form.value.filterPropertyName = ''
      form.value.filterValue = ''
      form.value.reviewCheckboxPropertyName = ''
      form.value.filterOperator = 'equals'
    } else if (form.value.collectionMode === 'tag') {
      form.value.reviewCheckboxPropertyName = ''
      if (form.value.filterOperator === 'checked') form.value.filterOperator = 'equals'
    } else if (form.value.collectionMode === 'checkbox') {
      form.value.filterPropertyName = ''
      form.value.filterValue = ''
      form.value.filterOperator = 'checked'
    }
  }

  async function loadSources(): Promise<void> {
    sources.value = await dependencies.reviewSource.listSources()
  }

  function resetForm(): void {
    editingSourceId.value = null
    properties.value = []
    deletePolicy.value = 'archive'
    form.value = {
      name: '',
      target: '',
      enabled: true,
      collectionMode: 'all',
      titlePropertyName: '',
      urlPropertyName: '',
      categoryPropertyName: '',
      tagPropertyName: '',
      sourcePropertyName: '',
      reviewCheckboxPropertyName: '',
      lastEditedPropertyName: '',
      filterPropertyName: '',
      filterOperator: 'equals',
      filterValue: ''
    }
    message.value = ''
  }

  async function editSource(source: ReviewSourceSummary): Promise<void> {
    editingSourceId.value = source.id
    deletePolicy.value = 'archive'
    form.value = {
      name: source.name,
      target: source.notionTargetUrl ?? source.notionTargetId,
      enabled: source.enabled,
      collectionMode: collectionMode(source.collectionMode),
      titlePropertyName: source.titlePropertyName,
      urlPropertyName: source.urlPropertyName ?? '',
      categoryPropertyName: source.categoryPropertyName ?? '',
      tagPropertyName: source.tagPropertyName ?? '',
      sourcePropertyName: source.sourcePropertyName ?? '',
      reviewCheckboxPropertyName: source.reviewCheckboxPropertyName ?? '',
      lastEditedPropertyName: source.lastEditedPropertyName ?? '',
      filterPropertyName: source.filterPropertyName ?? '',
      filterOperator: filterOperator(source.filterOperator),
      filterValue: source.filterValue ?? ''
    }
    await loadProperties()
  }

  async function loadProperties(): Promise<void> {
    if (form.value.target.trim() === '') {
      message.value = 'Notion 대상 URL 또는 ID를 입력하세요.'
      return
    }

    state.value = 'loading'
    try {
      properties.value = await dependencies.notionMetadata.listProperties({
        target: form.value.target
      })
      message.value =
        properties.value.length > 0
          ? '속성을 불러왔습니다. 필드 매핑을 선택하세요.'
          : '속성이 없습니다. Notion 대상과 공유 권한을 확인하세요.'
    } catch (error) {
      message.value = publicError(error)
    } finally {
      state.value = 'idle'
    }
  }

  async function createSource(): Promise<void> {
    resetModeFields()
    const validation = validateForm()
    if (validation) {
      message.value = validation
      return
    }

    state.value = 'saving'
    try {
      await dependencies.reviewSource.createSource({
        name: form.value.name,
        target: form.value.target,
        enabled: form.value.enabled,
        collectionMode: form.value.collectionMode,
        titlePropertyName: form.value.titlePropertyName,
        urlPropertyName: optional(form.value.urlPropertyName),
        categoryPropertyName: optional(form.value.categoryPropertyName),
        tagPropertyName: optional(form.value.tagPropertyName),
        sourcePropertyName: optional(form.value.sourcePropertyName),
        reviewCheckboxPropertyName: optional(form.value.reviewCheckboxPropertyName),
        lastEditedPropertyName: optional(form.value.lastEditedPropertyName),
        filterPropertyName: optional(form.value.filterPropertyName),
        filterOperator:
          form.value.collectionMode === 'checkbox'
            ? 'checked'
            : form.value.collectionMode === 'tag'
              ? form.value.filterOperator
              : null,
        filterValue: form.value.collectionMode === 'tag' ? optional(form.value.filterValue) : null
      })
      await loadSources()
      await dependencies.onSourcesChanged?.()
      message.value = 'Review Source가 저장되었습니다.'
    } catch (error) {
      message.value = publicError(error)
    } finally {
      state.value = 'idle'
    }
  }

  function sourcePayload() {
    return {
      name: form.value.name,
      enabled: form.value.enabled,
      collectionMode: form.value.collectionMode,
      titlePropertyName: form.value.titlePropertyName,
      urlPropertyName: optional(form.value.urlPropertyName),
      categoryPropertyName: optional(form.value.categoryPropertyName),
      tagPropertyName: optional(form.value.tagPropertyName),
      sourcePropertyName: optional(form.value.sourcePropertyName),
      reviewCheckboxPropertyName: optional(form.value.reviewCheckboxPropertyName),
      lastEditedPropertyName: optional(form.value.lastEditedPropertyName),
      filterPropertyName: optional(form.value.filterPropertyName),
      filterOperator:
        form.value.collectionMode === 'checkbox'
          ? 'checked'
          : form.value.collectionMode === 'tag'
            ? form.value.filterOperator
            : null,
      filterValue: form.value.collectionMode === 'tag' ? optional(form.value.filterValue) : null
    }
  }

  async function saveSource(): Promise<void> {
    resetModeFields()
    const validation = validateForm()
    if (validation) {
      message.value = validation
      return
    }

    state.value = 'saving'
    try {
      if (editingSourceId.value) {
        await dependencies.reviewSource.updateSource({
          id: editingSourceId.value,
          ...sourcePayload()
        })
        resetForm()
        message.value = 'Review Source가 수정되었습니다.'
      } else {
        await dependencies.reviewSource.createSource({
          target: form.value.target,
          ...sourcePayload()
        })
        message.value = 'Review Source가 저장되었습니다.'
      }
      await loadSources()
      await dependencies.onSourcesChanged?.()
    } catch (error) {
      message.value = publicError(error)
    } finally {
      state.value = 'idle'
    }
  }

  async function deleteSelectedSource(confirmDelete: () => boolean): Promise<void> {
    if (!editingSourceId.value) return
    if (!confirmDelete()) return

    state.value = 'saving'
    try {
      await dependencies.reviewSource.deleteSource({
        sourceId: editingSourceId.value,
        itemPolicy: deletePolicy.value
      })
      resetForm()
      await loadSources()
      await dependencies.onSourcesChanged?.()
      message.value = 'Review Source가 삭제되었습니다.'
    } catch (error) {
      message.value = publicError(error)
    } finally {
      state.value = 'idle'
    }
  }

  async function setEnabled(sourceId: string, enabled: boolean): Promise<void> {
    try {
      await dependencies.reviewSource.setEnabled({ sourceId, enabled })
      await loadSources()
      await dependencies.onSourcesChanged?.()
    } catch (error) {
      message.value = publicError(error)
    }
  }

  return {
    sources,
    properties,
    editingSourceId,
    deletePolicy,
    form,
    state,
    message,
    titleProperties,
    urlProperties,
    textLikeProperties,
    multiSelectProperties,
    checkboxProperties,
    filterProperties,
    hasProperties,
    isBusy,
    isEditing,
    resetModeFields,
    resetForm,
    loadSources,
    loadProperties,
    editSource,
    createSource,
    saveSource,
    deleteSelectedSource,
    setEnabled
  }
}
