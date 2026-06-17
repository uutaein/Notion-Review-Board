import { afterEach, describe, expect, it, vi } from 'vitest'
import { dueScheduleLabel, useReviewQueue, type ReviewQueueRendererApi } from '../useReviewQueue'

function apiWithItems(items = [item('item-1')]): ReviewQueueRendererApi {
  return {
    list: vi.fn().mockResolvedValue({
      items,
      isEmpty: items.length === 0,
      emptyReason: items.length === 0 ? 'no-active-items' : null,
      totalCount: items.length,
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
    sourceNames: ['Source A'],
    displayCategory: '미분류',
    tags: ['미분류'],
    originLabel: null,
    dueAt: '2026-06-20T00:00:00.000Z',
    lastReviewedAt: null,
    lastSyncedAt: '2026-06-13T00:00:00.000Z',
    status: 'active' as const,
    notionUrl: `https://www.notion.so/${id}`
  }
}

describe('Review Queue renderer model', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads active Review Queue rows from the preload API', async () => {
    const api = apiWithItems([item('item-1'), item('item-2')])
    const model = useReviewQueue(api)

    await model.load()

    expect(api.list).toHaveBeenCalledWith()
    expect(model.items.value.map(({ id }) => id)).toEqual(['item-1', 'item-2'])
    expect(model.selectedItem.value?.id).toBe('item-1')
    expect(model.message.value).toBe('')
  })

  it('preserves selection when the item remains in the refreshed list', async () => {
    const api = apiWithItems([item('item-1'), item('item-2')])
    const model = useReviewQueue(api)

    await model.load()
    model.selectedId.value = 'item-2'
    await model.load()

    expect(model.selectedItem.value?.id).toBe('item-2')
  })

  it('shows an explicit empty state for an empty active queue', async () => {
    const model = useReviewQueue(apiWithItems([]))

    await model.load()

    expect(model.items.value).toEqual([])
    expect(model.selectedItem.value).toBeNull()
    expect(model.message.value).toBe(
      '전체 큐에 active 항목이 없습니다. Source를 동기화하면 항목이 표시됩니다.'
    )
  })

  it('masks unknown backend details from renderer messages', async () => {
    const api = {
      list: vi.fn().mockRejectedValue(new Error('secret token raw SQL path'))
    } as ReviewQueueRendererApi
    const model = useReviewQueue(api)

    await model.load()

    expect(model.state.value).toBe('error')
    expect(model.message.value).toBe('전체 큐를 불러오지 못했습니다.')
    expect(model.message.value).not.toContain('secret')
  })

  it('labels future and overdue due dates', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-20T12:00:00.000Z'))

    expect(dueScheduleLabel('2026-06-22T12:00:00.000Z')).toBe('2일 후')
    expect(dueScheduleLabel('2026-06-20T15:00:00.000Z')).toBe('오늘 예정')
    expect(dueScheduleLabel('2026-06-18T00:00:00.000Z')).toBe('2일 지남')
    expect(dueScheduleLabel('not-a-date')).toBe('-')
  })
})
