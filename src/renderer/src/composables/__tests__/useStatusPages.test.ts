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
      handleChanged: vi.fn(),
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
      handleChanged: vi.fn(),
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
      handleChanged: vi.fn(),
      list: vi.fn().mockRejectedValue(new Error('raw token SQL path'))
    }
    const model = useStatusPages(api)

    await model.load('changed')

    expect(model.state.value).toBe('error')
    expect(model.message.value).toBe('상태 페이지를 불러오지 못했습니다.')
    expect(model.message.value).not.toContain('raw')
  })

  it('handles a changed page action and removes it from the current list', async () => {
    const api: StatusPagesRendererApi = {
      list: vi.fn().mockResolvedValue({
        kind: 'changed',
        items: [item('item-1'), item('item-2')],
        isEmpty: false
      }),
      handleChanged: vi.fn().mockResolvedValue({
        itemId: 'item-1',
        status: 'active',
        dueAt: '2026-06-13T07:00:00.000Z',
        handledAt: '2026-06-13T07:00:00.000Z'
      })
    }
    const model = useStatusPages(api)

    await model.load('changed')
    await expect(model.handleChanged('item-1', 'keep-schedule')).resolves.toBe(true)

    expect(api.handleChanged).toHaveBeenCalledWith({
      reviewItemId: 'item-1',
      action: 'keep-schedule'
    })
    expect(model.items.value.map(({ id }) => id)).toEqual(['item-2'])
    expect(model.selectedItem.value?.id).toBe('item-2')
  })

  it('prevents duplicate changed page actions while one is pending', async () => {
    let resolveAction!: () => void
    const pending = new Promise<void>((resolve) => {
      resolveAction = resolve
    })
    const api: StatusPagesRendererApi = {
      list: vi.fn().mockResolvedValue({
        kind: 'changed',
        items: [item('item-1')],
        isEmpty: false
      }),
      handleChanged: vi.fn().mockReturnValue(pending)
    }
    const model = useStatusPages(api)

    await model.load('changed')
    const first = model.handleChanged('item-1', 'pull-today')
    const second = await model.handleChanged('item-1', 'pull-today')

    expect(second).toBe(false)
    expect(api.handleChanged).toHaveBeenCalledOnce()
    resolveAction()
    await expect(first).resolves.toBe(true)
  })

  it('masks changed page action backend details', async () => {
    const api: StatusPagesRendererApi = {
      list: vi.fn().mockResolvedValue({
        kind: 'changed',
        items: [item('item-1')],
        isEmpty: false
      }),
      handleChanged: vi.fn().mockRejectedValue(new Error('raw SQL path'))
    }
    const model = useStatusPages(api)

    await model.load('changed')
    await expect(model.handleChanged('item-1', 'pull-today')).resolves.toBe(false)

    expect(model.message.value).toBe('변경 항목 처리에 실패했습니다.')
    expect(model.message.value).not.toContain('raw')
  })
})
