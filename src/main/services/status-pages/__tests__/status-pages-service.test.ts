import { describe, expect, it, vi } from 'vitest'
import type { ReviewItem } from '../../../../shared/domain/item'
import type {
  DateTimeString,
  ReviewItemId,
  ReviewSourceId,
  SyncEventId
} from '../../../../shared/domain/types'
import { createReviewItem, createReviewSource, sourceId } from '../../review/__tests__/fixtures'
import { createStatusPageService, type StatusPagePersistence, type StatusPageReader } from '..'

function createDependencies(items: ReviewItem[]) {
  const recordStatusAction = vi.fn<StatusPagePersistence['recordStatusAction']>()
  const reader: StatusPageReader = {
    findByStatuses: vi.fn((statuses) => items.filter((item) => statuses.includes(item.status))),
    findSourceById: vi.fn((id) => (id === sourceId ? createReviewSource() : null))
  }
  const persistence: StatusPagePersistence = {
    findReviewItemById: vi.fn((id) => items.find((item) => item.id === id) ?? null),
    recordStatusAction
  }

  return {
    reader,
    persistence,
    createSyncEventId: () => 'event-1' as SyncEventId,
    recordStatusAction
  }
}

describe('StatusPageService', () => {
  it('lists only changed Review Items for the changed page', () => {
    const dependencies = createDependencies([
      createReviewItem({ id: 'changed-item' as ReviewItemId, status: 'changed' }),
      createReviewItem({ id: 'active-item' as ReviewItemId, status: 'active' })
    ])
    const service = createStatusPageService(dependencies)

    const result = service.list({ kind: 'changed' })

    expect(dependencies.reader.findByStatuses).toHaveBeenCalledWith(['changed'])
    expect(result.items.map(({ id }) => id)).toEqual(['changed-item'])
    expect(result.isEmpty).toBe(false)
  })

  it('lists missing and deleted Review Items for the deleted page', () => {
    const dependencies = createDependencies([
      createReviewItem({ id: 'missing-item' as ReviewItemId, status: 'missing' }),
      createReviewItem({ id: 'deleted-item' as ReviewItemId, status: 'deleted' }),
      createReviewItem({ id: 'changed-item' as ReviewItemId, status: 'changed' })
    ])
    const service = createStatusPageService(dependencies)

    const result = service.list({ kind: 'missing-deleted' })

    expect(dependencies.reader.findByStatuses).toHaveBeenCalledWith(['missing', 'deleted'])
    expect(result.items.map(({ id }) => id)).toEqual(['missing-item', 'deleted-item'])
  })

  it('projects status page display fields without exposing FSRS state', () => {
    const item = createReviewItem({
      status: 'missing',
      lastReviewedAt: '2026-06-10T00:00:00.000Z' as DateTimeString,
      missingDetectedAt: '2026-06-12T00:00:00.000Z' as DateTimeString
    })
    const service = createStatusPageService(createDependencies([item]))

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
    const service = createStatusPageService(
      createDependencies([
        createReviewItem({
          status: 'changed',
          primarySourceId: missingSource,
          sourceIds: [missingSource],
          category: ' ',
          tags: []
        })
      ])
    )

    const result = service.list({ kind: 'changed' })

    expect(result.items[0]).toMatchObject({
      sourceName: '알 수 없는 Source',
      displayCategory: '미분류',
      tags: ['미분류']
    })
  })

  it('returns an explicit empty state', () => {
    const service = createStatusPageService(createDependencies([]))

    expect(service.list({ kind: 'changed' })).toEqual({
      kind: 'changed',
      items: [],
      isEmpty: true
    })
  })

  it('pulls a changed page into Today Review without changing FSRS state', () => {
    const item = createReviewItem({
      status: 'changed',
      dueAt: '2026-06-30T00:00:00.000Z' as DateTimeString
    })
    const dependencies = createDependencies([item])
    const service = createStatusPageService(dependencies)
    const handledAt = '2026-06-13T07:00:00.000Z' as DateTimeString

    const result = service.handleChanged({
      reviewItemId: item.id,
      action: 'pull-today',
      handledAt
    })

    expect(result).toEqual({
      itemId: item.id,
      status: 'active',
      dueAt: handledAt,
      handledAt
    })
    expect(dependencies.recordStatusAction).toHaveBeenCalledWith(
      { ...item, status: 'active', dueAt: handledAt, updatedAt: handledAt },
      expect.objectContaining({
        eventType: 'user_action',
        message: 'Changed page pulled into Today Review',
        occurredAt: handledAt
      })
    )
    expect(dependencies.recordStatusAction.mock.calls[0][0].fsrsState).toEqual(item.fsrsState)
  })

  it('keeps a changed page schedule while clearing the changed status', () => {
    const item = createReviewItem({
      status: 'changed',
      dueAt: '2026-06-30T00:00:00.000Z' as DateTimeString
    })
    const dependencies = createDependencies([item])
    const service = createStatusPageService(dependencies)
    const handledAt = '2026-06-13T07:00:00.000Z' as DateTimeString

    const result = service.handleChanged({
      reviewItemId: item.id,
      action: 'keep-schedule',
      handledAt
    })

    expect(result.dueAt).toBe(item.dueAt)
    expect(dependencies.recordStatusAction.mock.calls[0][0]).toEqual({
      ...item,
      status: 'active',
      updatedAt: handledAt
    })
    expect(dependencies.recordStatusAction.mock.calls[0][1]).toMatchObject({
      eventType: 'user_action',
      message: 'Changed page kept on existing schedule'
    })
  })

  it.each(['active', 'missing', 'deleted', 'archived', 'sync_error'] as const)(
    'rejects a %s item before persistence',
    (status) => {
      const item = createReviewItem({ status })
      const dependencies = createDependencies([item])
      const service = createStatusPageService(dependencies)

      expect(() =>
        service.handleChanged({
          reviewItemId: item.id,
          action: 'keep-schedule',
          handledAt: '2026-06-13T07:00:00.000Z' as DateTimeString
        })
      ).toThrow('STATUS_ITEM_NOT_CHANGED')
      expect(dependencies.recordStatusAction).not.toHaveBeenCalled()
    }
  )

  it('rejects an unknown item before persistence', () => {
    const dependencies = createDependencies([])
    const service = createStatusPageService(dependencies)

    expect(() =>
      service.handleChanged({
        reviewItemId: 'missing-item' as ReviewItemId,
        action: 'pull-today',
        handledAt: '2026-06-13T07:00:00.000Z' as DateTimeString
      })
    ).toThrow('STATUS_ITEM_NOT_FOUND')
    expect(dependencies.recordStatusAction).not.toHaveBeenCalled()
  })
})
