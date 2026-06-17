import { describe, expect, it, vi } from 'vitest'
import type { SyncEvent } from '../../../../shared/domain/sync'
import type { DateTimeString, ReviewItemId, SyncEventId } from '../../../../shared/domain/types'
import { createReviewExclusionService } from '../index'
import { createReviewItem } from './fixtures'

describe('ReviewExclusionService', () => {
  it('archives an active review item and records a user action event', () => {
    const item = createReviewItem()
    const recordStatusAction = vi.fn<(updatedItem: typeof item, event: SyncEvent) => void>()
    const service = createReviewExclusionService({
      persistence: {
        findReviewItemById: vi.fn(() => item),
        recordStatusAction
      },
      createSyncEventId: () => 'event-1' as SyncEventId
    })

    const result = service.exclude({
      reviewItemId: item.id,
      excludedAt: '2026-06-13T07:00:00.000Z' as DateTimeString
    })

    expect(result).toEqual({
      itemId: item.id,
      status: 'archived',
      excludedAt: '2026-06-13T07:00:00.000Z'
    })
    expect(recordStatusAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: item.id,
        status: 'archived',
        updatedAt: '2026-06-13T07:00:00.000Z'
      }),
      expect.objectContaining({
        id: 'event-1',
        sourceId: item.primarySourceId,
        reviewItemId: item.id,
        eventType: 'user_action',
        message: 'Review item excluded from Today Review',
        occurredAt: '2026-06-13T07:00:00.000Z'
      })
    )
  })

  it('rejects missing and non-active review items before persistence', () => {
    const recordStatusAction = vi.fn()
    const missingService = createReviewExclusionService({
      persistence: {
        findReviewItemById: vi.fn(() => null),
        recordStatusAction
      },
      createSyncEventId: () => 'event-1' as SyncEventId
    })

    expect(() =>
      missingService.exclude({
        reviewItemId: 'item-1' as ReviewItemId,
        excludedAt: '2026-06-13T07:00:00.000Z' as DateTimeString
      })
    ).toThrow('REVIEW_ITEM_NOT_FOUND')

    const changedService = createReviewExclusionService({
      persistence: {
        findReviewItemById: vi.fn(() => createReviewItem({ status: 'changed' })),
        recordStatusAction
      },
      createSyncEventId: () => 'event-1' as SyncEventId
    })

    expect(() =>
      changedService.exclude({
        reviewItemId: 'item-1' as ReviewItemId,
        excludedAt: '2026-06-13T07:00:00.000Z' as DateTimeString
      })
    ).toThrow('REVIEW_ITEM_NOT_ACTIVE')
    expect(recordStatusAction).not.toHaveBeenCalled()
  })
})
