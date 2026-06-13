import { describe, expect, it, vi } from 'vitest'
import { emptyMessage, useStatusPages, type StatusPagesRendererApi } from '../useStatusPages'

function item(id: string) {
  return {
    id,
    title: `Title ${id}`,
    sourceName: 'Source A',
    displayCategory: '미분류',
    tags: ['미분류'],
    status: 'changed' as const,
    notionPageId: `page-${id}`,
    notionUrl: `https://www.notion.so/${id}`,
    dueAt: '2026-06-13T00:00:00.000Z',
    lastReviewedAt: null,
    lastSyncedAt: '2026-06-13T01:00:00.000Z',
    notionLastEditedAt: '2026-06-13T02:00:00.000Z',
    missingDetectedAt: null,
    deletedDetectedAt: null
  }
}

describe('Status Pages renderer model', () => {
  it('loads changed rows through the preload API', async () => {
    const api: StatusPagesRendererApi = {
      list: vi.fn().mockResolvedValue({
        kind: 'changed',
        items: [item('item-1')],
        isEmpty: false
      })
    }
    const model = useStatusPages(api)

    await model.load('changed')

    expect(api.list).toHaveBeenCalledWith({ kind: 'changed' })
    expect(model.items.value.map(({ id }) => id)).toEqual(['item-1'])
    expect(model.selectedItem.value?.id).toBe('item-1')
    expect(model.message.value).toBe('')
  })

  it('loads missing/deleted rows and exposes an empty state', async () => {
    const api: StatusPagesRendererApi = {
      list: vi.fn().mockResolvedValue({
        kind: 'missing-deleted',
        items: [],
        isEmpty: true
      })
    }
    const model = useStatusPages(api)

    await model.load('missing-deleted')

    expect(api.list).toHaveBeenCalledWith({ kind: 'missing-deleted' })
    expect(model.items.value).toEqual([])
    expect(model.selectedItem.value).toBeNull()
    expect(model.message.value).toBe(emptyMessage('missing-deleted'))
  })

  it('masks unknown backend details from renderer messages', async () => {
    const api: StatusPagesRendererApi = {
      list: vi.fn().mockRejectedValue(new Error('raw token SQL path'))
    }
    const model = useStatusPages(api)

    await model.load('changed')

    expect(model.state.value).toBe('error')
    expect(model.message.value).toBe('상태 페이지를 불러오지 못했습니다.')
    expect(model.message.value).not.toContain('raw')
  })
})
