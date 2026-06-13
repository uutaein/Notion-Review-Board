import { describe, expect, it, vi } from 'vitest'
import { useReviewSourceSettings, type ReviewSourceSettingsApi } from '../useReviewSourceSettings'

const sourceApi = (): ReviewSourceSettingsApi => ({
  listSources: vi.fn().mockResolvedValue([]),
  createSource: vi.fn().mockResolvedValue({
    id: 'source-1',
    name: 'Study',
    notionTargetId: 'target',
    notionTargetUrl: null,
    enabled: true,
    collectionMode: 'all',
    titlePropertyName: 'Name',
    urlPropertyName: null,
    categoryPropertyName: null,
    tagPropertyName: null,
    sourcePropertyName: null,
    reviewCheckboxPropertyName: null,
    lastEditedPropertyName: null,
    filterPropertyName: null,
    filterOperator: null,
    filterValue: null,
    lastSyncedAt: null
  }),
  updateSource: vi.fn(),
  deleteSource: vi.fn(),
  setEnabled: vi.fn()
})

const existingSource = {
  id: 'source-1',
  name: 'Study',
  notionTargetId: 'target',
  notionTargetUrl: null,
  enabled: true,
  collectionMode: 'tag' as const,
  titlePropertyName: 'Name',
  urlPropertyName: null,
  categoryPropertyName: 'Category',
  tagPropertyName: 'Tags',
  sourcePropertyName: null,
  reviewCheckboxPropertyName: null,
  lastEditedPropertyName: null,
  filterPropertyName: 'Category',
  filterOperator: 'contains' as const,
  filterValue: 'AI',
  lastSyncedAt: null
}

const properties = [
  { id: 'title', name: 'Name', type: 'title' },
  { id: 'url', name: 'URL', type: 'url' },
  { id: 'category', name: 'Category', type: 'select' },
  { id: 'tags', name: 'Tags', type: 'multi_select' },
  { id: 'review', name: 'Review', type: 'checkbox' },
  { id: 'edited', name: 'Edited', type: 'last_edited_time' }
]

function setup() {
  const reviewSource = sourceApi()
  const notionMetadata = {
    listProperties: vi.fn().mockResolvedValue(properties)
  }
  const onSourcesChanged = vi.fn()
  const model = useReviewSourceSettings({ reviewSource, notionMetadata, onSourcesChanged })
  return { model, reviewSource, notionMetadata, onSourcesChanged }
}

describe('Review Source settings renderer model', () => {
  it('TC-MAPPING-UI-001/002: loads property selectors from a Notion target', async () => {
    const { model, notionMetadata } = setup()
    model.form.value.target = 'https://notion.so/data-source'

    await model.loadProperties()

    expect(notionMetadata.listProperties).toHaveBeenCalledWith({
      target: 'https://notion.so/data-source'
    })
    expect(model.titleProperties.value.map((property) => property.name)).toEqual(['Name'])
    expect(model.urlProperties.value.map((property) => property.name)).toEqual(['URL'])
    expect(model.message.value).toBe('속성을 불러왔습니다. 필드 매핑을 선택하세요.')
  })

  it('TC-SOURCE-UI-001: blocks missing required Source fields before persistence', async () => {
    const { model, reviewSource } = setup()

    await model.createSource()

    expect(reviewSource.createSource).not.toHaveBeenCalled()
    expect(model.message.value).toBe('Source 이름을 입력하세요.')
  })

  it('TC-SOURCE-UI-002: collection mode controls conditional field requirements', async () => {
    const { model, reviewSource } = setup()
    Object.assign(model.form.value, {
      name: 'Study',
      target: 'target',
      collectionMode: 'checkbox',
      titlePropertyName: 'Name'
    })

    await model.createSource()

    expect(reviewSource.createSource).not.toHaveBeenCalled()
    expect(model.message.value).toBe('체크박스 속성을 선택하세요.')
  })

  it('TC-SOURCE-UI-001/TC-MAPPING-UI-002: creates an all-mode Source with optional fallbacks', async () => {
    const { model, reviewSource, onSourcesChanged } = setup()
    Object.assign(model.form.value, {
      name: 'Study',
      target: 'target',
      enabled: true,
      collectionMode: 'all',
      titlePropertyName: 'Name',
      urlPropertyName: '',
      categoryPropertyName: 'Category'
    })

    await model.createSource()

    expect(reviewSource.createSource).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Study',
        target: 'target',
        enabled: true,
        collectionMode: 'all',
        titlePropertyName: 'Name',
        urlPropertyName: null,
        categoryPropertyName: 'Category',
        filterPropertyName: null,
        filterOperator: null,
        filterValue: null
      })
    )
    expect(model.message.value).toBe('Review Source가 저장되었습니다.')
    expect(onSourcesChanged).toHaveBeenCalledOnce()
  })

  it('TC-SOURCE-UI-002: creates a tag-mode Source with filter configuration', async () => {
    const { model, reviewSource } = setup()
    Object.assign(model.form.value, {
      name: 'Study',
      target: 'target',
      collectionMode: 'tag',
      titlePropertyName: 'Name',
      filterPropertyName: 'Category',
      filterOperator: 'equals',
      filterValue: 'AI'
    })

    await model.createSource()

    expect(reviewSource.createSource).toHaveBeenCalledWith(
      expect.objectContaining({
        collectionMode: 'tag',
        filterPropertyName: 'Category',
        filterOperator: 'equals',
        filterValue: 'AI',
        reviewCheckboxPropertyName: null
      })
    )
  })

  it('TC-MAPPING-UI-005: distinguishes metadata loading errors with sanitized messages', async () => {
    const { model, notionMetadata } = setup()
    model.form.value.target = 'target'
    notionMetadata.listProperties.mockRejectedValue(new Error('FORBIDDEN'))

    await model.loadProperties()

    expect(model.message.value).toBe('Notion 공유 권한을 확인하세요.')
  })

  it('TC-SOURCE-UI-003: duplicate target warning is displayed without raw details', async () => {
    const { model, reviewSource } = setup()
    vi.mocked(reviewSource.createSource).mockRejectedValue(new Error('DUPLICATE_TARGET'))
    Object.assign(model.form.value, {
      name: 'Study',
      target: 'target',
      collectionMode: 'all',
      titlePropertyName: 'Name'
    })

    await model.createSource()

    expect(model.message.value).toBe('이미 등록된 Notion 대상입니다.')
  })

  it('TC-SOURCE-UI-008: toggles enabled state and refreshes sync source options', async () => {
    const { model, reviewSource, onSourcesChanged } = setup()

    await model.setEnabled('source-1', false)

    expect(reviewSource.setEnabled).toHaveBeenCalledWith({
      sourceId: 'source-1',
      enabled: false
    })
    expect(onSourcesChanged).toHaveBeenCalledOnce()
  })

  it('TC-SOURCE-UI-004/005: loads a Source into edit mode and cancels without persistence', async () => {
    const { model, notionMetadata, reviewSource } = setup()

    await model.editSource(existingSource)
    expect(notionMetadata.listProperties).toHaveBeenCalledWith({ target: 'target' })
    expect(model.isEditing.value).toBe(true)
    expect(model.form.value).toMatchObject({
      name: 'Study',
      target: 'target',
      collectionMode: 'tag',
      titlePropertyName: 'Name',
      filterPropertyName: 'Category',
      filterOperator: 'contains',
      filterValue: 'AI'
    })

    model.resetForm()
    expect(model.isEditing.value).toBe(false)
    expect(reviewSource.updateSource).not.toHaveBeenCalled()
  })

  it('TC-SOURCE-UI-004: updates the selected Source with editable settings only', async () => {
    const { model, reviewSource, onSourcesChanged } = setup()
    await model.editSource(existingSource)
    model.form.value.name = 'Updated'
    model.form.value.filterValue = 'Cheetos'

    await model.saveSource()

    expect(reviewSource.updateSource).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'source-1',
        name: 'Updated',
        collectionMode: 'tag',
        titlePropertyName: 'Name',
        filterPropertyName: 'Category',
        filterOperator: 'contains',
        filterValue: 'Cheetos'
      })
    )
    expect(reviewSource.createSource).not.toHaveBeenCalled()
    expect(model.message.value).toBe('Review Source가 수정되었습니다.')
    expect(onSourcesChanged).toHaveBeenCalled()
  })

  it('TC-SOURCE-UI-006/007: deletes the selected Source only after confirmation and policy choice', async () => {
    const { model, reviewSource, onSourcesChanged } = setup()
    await model.editSource(existingSource)
    model.deletePolicy.value = 'keep-history'

    await model.deleteSelectedSource(() => true)

    expect(reviewSource.deleteSource).toHaveBeenCalledWith({
      sourceId: 'source-1',
      itemPolicy: 'keep-history'
    })
    expect(model.isEditing.value).toBe(false)
    expect(model.message.value).toBe('Review Source가 삭제되었습니다.')
    expect(onSourcesChanged).toHaveBeenCalled()
  })

  it('does not delete a selected Source when confirmation is rejected', async () => {
    const { model, reviewSource } = setup()
    await model.editSource(existingSource)

    await model.deleteSelectedSource(() => false)

    expect(reviewSource.deleteSource).not.toHaveBeenCalled()
    expect(model.isEditing.value).toBe(true)
  })
})
