import { describe, expect, it, vi } from 'vitest'
import { useTodayReview, type TodayReviewRendererApi } from '../useTodayReview'

function apiWithItems(items = [item('item-1')]): TodayReviewRendererApi {
  return {
    list: vi.fn().mockResolvedValue({
      items,
      isEmpty: items.length === 0,
      emptyReason: items.length === 0 ? 'no-due-items' : null,
      sort: 'due'
    })
  }
}

function item(id: string) {
  return {
    id,
    title: `Title ${id}`,
    sourceId: 'source-a',
    sourceName: 'Source A',
    displayCategory: '미분류',
    tags: ['미분류'],
    originLabel: null,
    dueAt: '2026-06-13T00:00:00.000Z',
    lastReviewedAt: null,
    status: 'active' as const,
    notionUrl: `https://www.notion.so/${id}`
  }
}

describe('Today Review renderer model', () => {
  it('loads real Today Review rows from the preload API', async () => {
    const api = apiWithItems([item('item-1'), item('item-2')])
    const model = useTodayReview(api)

    await model.load()

    expect(api.list).toHaveBeenCalledWith({ sort: 'due' })
    expect(model.items.value.map(({ id }) => id)).toEqual(['item-1', 'item-2'])
    expect(model.selectedItem.value?.id).toBe('item-1')
    expect(model.message.value).toBe('')
  })

  it('preserves selection when the item remains in the refreshed list', async () => {
    const api = apiWithItems([item('item-1'), item('item-2')])
    const model = useTodayReview(api)

    await model.load()
    model.selectedId.value = 'item-2'
    await model.load()

    expect(model.selectedItem.value?.id).toBe('item-2')
  })

  it('loads Today Review rows for a selected Review Source filter', async () => {
    const api = apiWithItems([item('item-1')])
    const model = useTodayReview(api)

    await model.setSourceFilter('source-a')

    expect(api.list).toHaveBeenCalledWith({
      sort: 'due',
      filter: { kind: 'source', sourceId: 'source-a' }
    })
    expect(model.sourceFilterId.value).toBe('source-a')
    expect(model.selectedItem.value?.id).toBe('item-1')
  })

  it('removes a completed item from the current Today Review session', async () => {
    const model = useTodayReview(apiWithItems([item('item-1'), item('item-2')]))

    await model.load()
    model.selectedId.value = 'item-1'
    model.removeItem('item-1')

    expect(model.items.value.map(({ id }) => id)).toEqual(['item-2'])
    expect(model.selectedItem.value?.id).toBe('item-2')
  })

  it('shows the empty state when the last completed item is removed from the session', async () => {
    const model = useTodayReview(apiWithItems([item('item-1')]))

    await model.load()
    model.removeItem('item-1')

    expect(model.items.value).toEqual([])
    expect(model.selectedItem.value).toBeNull()
    expect(model.message.value).toBe(
      '오늘 복습할 항목이 없습니다. Source를 동기화하면 새 항목이 표시됩니다.'
    )
  })

  it('shows an actionable empty state for an empty Today Review queue', async () => {
    const model = useTodayReview(apiWithItems([]))

    await model.load()

    expect(model.items.value).toEqual([])
    expect(model.selectedItem.value).toBeNull()
    expect(model.message.value).toBe(
      '오늘 복습할 항목이 없습니다. Source를 동기화하면 새 항목이 표시됩니다.'
    )
  })

  it('masks unknown backend details from renderer messages', async () => {
    const api = {
      list: vi.fn().mockRejectedValue(new Error('secret token raw SQL path'))
    } as TodayReviewRendererApi
    const model = useTodayReview(api)

    await model.load()

    expect(model.state.value).toBe('error')
    expect(model.message.value).toBe('복습 목록을 불러오지 못했습니다.')
    expect(model.message.value).not.toContain('secret')
  })
})
