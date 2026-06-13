import { describe, expect, it, vi } from 'vitest'
import type { ReviewItem } from '../../../../shared/domain/item'
import type { DateTimeString, ReviewItemId, ReviewSourceId } from '../../../../shared/domain/types'
import { createReviewItem, createReviewSource, sourceId } from '../../review/__tests__/fixtures'
import { createStatusPageService, type StatusPageReader } from '..'

function createReader(items: ReviewItem[]): StatusPageReader {
  return {
    findByStatuses: vi.fn((statuses) => items.filter((item) => statuses.includes(item.status))),
    findSourceById: vi.fn((id) => (id === sourceId ? createReviewSource() : null))
  }
}

describe('StatusPageService', () => {
  it('lists only changed Review Items for the changed page', () => {
    const reader = createReader([
      createReviewItem({ id: 'changed-item' as ReviewItemId, status: 'changed' }),
      createReviewItem({ id: 'active-item' as ReviewItemId, status: 'active' })
    ])
    const service = createStatusPageService({ reader })

    const result = service.list({ kind: 'changed' })

    expect(reader.findByStatuses).toHaveBeenCalledWith(['changed'])
    expect(result.items.map(({ id }) => id)).toEqual(['changed-item'])
    expect(result.isEmpty).toBe(false)
  })

  it('lists missing and deleted Review Items for the deleted page', () => {
    const reader = createReader([
      createReviewItem({ id: 'missing-item' as ReviewItemId, status: 'missing' }),
      createReviewItem({ id: 'deleted-item' as ReviewItemId, status: 'deleted' }),
      createReviewItem({ id: 'changed-item' as ReviewItemId, status: 'changed' })
    ])
    const service = createStatusPageService({ reader })

    const result = service.list({ kind: 'missing-deleted' })

    expect(reader.findByStatuses).toHaveBeenCalledWith(['missing', 'deleted'])
    expect(result.items.map(({ id }) => id)).toEqual(['missing-item', 'deleted-item'])
  })

  it('projects status page display fields without exposing FSRS state', () => {
    const item = createReviewItem({
      status: 'missing',
      lastReviewedAt: '2026-06-10T00:00:00.000Z' as DateTimeString,
      missingDetectedAt: '2026-06-12T00:00:00.000Z' as DateTimeString
    })
    const service = createStatusPageService({ reader: createReader([item]) })

    const result = service.list({ kind: 'missing-deleted' })

    expect(result.items[0]).toEqual({
      id: item.id,
      title: item.title,
      sourceName: '개발 학습',
      displayCategory: 'Electron',
      tags: ['desktop', 'security'],
      status: 'missing',
      notionPageId: item.notionPageId,
      notionUrl: item.notionUrl,
      dueAt: item.dueAt,
      lastReviewedAt: '2026-06-10T00:00:00.000Z',
      lastSyncedAt: item.lastSyncedAt,
      notionLastEditedAt: item.notionLastEditedAt,
      missingDetectedAt: '2026-06-12T00:00:00.000Z',
      deletedDetectedAt: null
    })
    expect(result.items[0]).not.toHaveProperty('fsrsState')
  })

  it('uses visible fallbacks when source and classification metadata are missing', () => {
    const missingSource = 'missing-source' as ReviewSourceId
    const service = createStatusPageService({
      reader: createReader([
        createReviewItem({
          status: 'changed',
          primarySourceId: missingSource,
          sourceIds: [missingSource],
          category: ' ',
          tags: []
        })
      ])
    })

    const result = service.list({ kind: 'changed' })

    expect(result.items[0]).toMatchObject({
      sourceName: '알 수 없는 Source',
      displayCategory: '미분류',
      tags: ['미분류']
    })
  })

  it('returns an explicit empty state', () => {
    const service = createStatusPageService({ reader: createReader([]) })

    expect(service.list({ kind: 'changed' })).toEqual({
      kind: 'changed',
      items: [],
      isEmpty: true
    })
  })
})
