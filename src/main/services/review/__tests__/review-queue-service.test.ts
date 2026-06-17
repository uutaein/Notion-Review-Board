import { describe, expect, it, vi } from 'vitest'
import type { ReviewItem, ReviewItemStatus } from '../../../../shared/domain/item'
import type { DateTimeString, ReviewItemId, ReviewSourceId } from '../../../../shared/domain/types'
import { createReviewQueueService, type ReviewQueueReader } from '../index'
import { createReviewItem, createReviewSource, sourceId } from './fixtures'

const sourceB = 'source-2' as ReviewSourceId

function createReader(items: ReviewItem[]): ReviewQueueReader {
  return {
    findByStatuses: vi.fn((statuses: ReviewItemStatus[]) =>
      items.filter((item) => statuses.includes(item.status))
    ),
    findSourceById: vi.fn((id) => {
      if (id === sourceId) return createReviewSource()
      if (id === sourceB) return createReviewSource({ id, name: 'AI 학습' })
      return null
    })
  }
}

describe('ReviewQueueService', () => {
  it('lists every active item regardless of whether it is due today', () => {
    const reader = createReader([
      createReviewItem({ id: 'due' as ReviewItemId }),
      createReviewItem({
        id: 'future' as ReviewItemId,
        dueAt: '2026-07-01T00:00:00.000Z' as DateTimeString
      }),
      createReviewItem({ id: 'changed' as ReviewItemId, status: 'changed' }),
      createReviewItem({ id: 'missing' as ReviewItemId, status: 'missing' }),
      createReviewItem({ id: 'archived' as ReviewItemId, status: 'archived' })
    ])
    const service = createReviewQueueService({ reader })

    const result = service.list()

    expect(reader.findByStatuses).toHaveBeenCalledWith(['active'])
    expect(result.items.map(({ id }) => id)).toEqual(['due', 'future'])
    expect(result.totalCount).toBe(2)
    expect(result.emptyReason).toBeNull()
  })

  it('sorts the full queue by due date and projects safe display metadata', () => {
    const reader = createReader([
      createReviewItem({
        id: 'later' as ReviewItemId,
        dueAt: '2026-07-10T00:00:00.000Z' as DateTimeString
      }),
      createReviewItem({
        id: 'earlier' as ReviewItemId,
        primarySourceId: sourceB,
        sourceIds: [sourceB, sourceId],
        dueAt: '2026-06-20T00:00:00.000Z' as DateTimeString,
        category: null,
        tags: [],
        originLabel: null
      })
    ])
    const service = createReviewQueueService({ reader })

    const result = service.list()

    expect(result.sort).toBe('due')
    expect(result.items[0]).toEqual({
      id: 'earlier',
      title: 'Electron 프로세스 모델 정리',
      sourceId: sourceB,
      sourceName: 'AI 학습',
      sourceNames: ['AI 학습', '개발 학습'],
      displayCategory: '미분류',
      tags: ['미분류'],
      originLabel: null,
      dueAt: '2026-06-20T00:00:00.000Z',
      lastReviewedAt: null,
      lastSyncedAt: '2026-06-11T01:00:00.000Z',
      status: 'active',
      notionUrl: 'https://www.notion.so/page-1'
    })
    expect(result.items.map(({ id }) => id)).toEqual(['earlier', 'later'])
  })

  it('returns an explicit empty state when no active queue item exists', () => {
    const service = createReviewQueueService({
      reader: createReader([createReviewItem({ status: 'changed' })])
    })

    const result = service.list()

    expect(result.items).toEqual([])
    expect(result.isEmpty).toBe(true)
    expect(result.emptyReason).toBe('no-active-items')
  })
})
