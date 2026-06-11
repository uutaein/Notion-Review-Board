import { describe, test, expect } from 'vitest'
import {
  DateTimeString,
  ReviewSourceId,
  ReviewItemId,
  NotionPageId,
  NotionTargetId
} from '../types'
import { ReviewSource, isSyncTarget } from '../source'
import {
  ReviewItem,
  ReviewItemStatus,
  isTodayReview,
  isValidStatusTransition,
  normalizeNotionPageId,
  isEqualNotionPageId,
  getDisplayCategory,
  getDisplayTags,
  compareReviewItemsByDue
} from '../item'
import { mapAppRatingToFsrs, FSRS_RATING } from '../log'

describe('Notion Review Board Domain Layer Tests', () => {
  describe('ID and Dates branding', () => {
    test('Branded types are treated as strings at runtime', () => {
      const sourceId = 'source-123' as ReviewSourceId
      const itemId = 'item-456' as ReviewItemId
      expect(typeof sourceId).toBe('string')
      expect(typeof itemId).toBe('string')
    })
  })

  describe('ReviewSource Rules', () => {
    test('isSyncTarget returns correct sync eligibility based on enabled status', () => {
      const sourceEnabled: ReviewSource = {
        id: 'src-1' as ReviewSourceId,
        name: 'DB 1',
        notionTargetId: 'notion-db-1' as NotionTargetId,
        notionTargetUrl: null,
        notionTargetType: 'database',
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
        lastSyncedAt: null,
        createdAt: '2026-06-11T12:00:00Z' as DateTimeString,
        updatedAt: '2026-06-11T12:00:00Z' as DateTimeString
      }

      const sourceDisabled: ReviewSource = {
        ...sourceEnabled,
        enabled: false
      }

      expect(isSyncTarget(sourceEnabled)).toBe(true)
      expect(isSyncTarget(sourceDisabled)).toBe(false)
    })
  })

  describe('ReviewItem Status Transitions', () => {
    test('Valid status transitions from active', () => {
      expect(isValidStatusTransition('active', 'active')).toBe(true)
      expect(isValidStatusTransition('active', 'changed')).toBe(true)
      expect(isValidStatusTransition('active', 'missing')).toBe(true)
      expect(isValidStatusTransition('active', 'sync_error')).toBe(true)
      expect(isValidStatusTransition('active', 'archived')).toBe(true)

      expect(isValidStatusTransition('active', 'deleted')).toBe(false)
    })

    test('Valid status transitions from changed', () => {
      expect(isValidStatusTransition('changed', 'active')).toBe(true)

      expect(isValidStatusTransition('changed', 'changed')).toBe(false)
      expect(isValidStatusTransition('changed', 'archived')).toBe(false)
    })

    test('Valid status transitions from missing', () => {
      expect(isValidStatusTransition('missing', 'active')).toBe(true)
      expect(isValidStatusTransition('missing', 'deleted')).toBe(true)
      expect(isValidStatusTransition('missing', 'archived')).toBe(true)

      expect(isValidStatusTransition('missing', 'changed')).toBe(false)
    })

    test('Valid status transitions from deleted', () => {
      expect(isValidStatusTransition('deleted', 'archived')).toBe(true)

      expect(isValidStatusTransition('deleted', 'active')).toBe(false)
    })

    test('Valid status transitions from sync_error', () => {
      expect(isValidStatusTransition('sync_error', 'active')).toBe(true)

      expect(isValidStatusTransition('sync_error', 'archived')).toBe(false)
    })

    test('Archived is a terminal state', () => {
      expect(isValidStatusTransition('archived', 'active')).toBe(false)
      expect(isValidStatusTransition('archived', 'archived')).toBe(false)
    })

    test('Initial creation transitions to active', () => {
      expect(isValidStatusTransition(undefined, 'active')).toBe(true)
      expect(isValidStatusTransition(undefined, 'changed')).toBe(false)
    })
  })

  describe('Notion Page ID Normalization and Equality', () => {
    test('normalizeNotionPageId strips hyphens and lowercase characters', () => {
      const rawId1 = 'c8f42289-42b8-4c28-971c-e7fb53641b6c'
      const rawId2 = 'C8F4228942B84C28971CE7FB53641B6C'

      expect(normalizeNotionPageId(rawId1)).toBe('c8f4228942b84c28971ce7fb53641b6c')
      expect(normalizeNotionPageId(rawId2)).toBe('c8f4228942b84c28971ce7fb53641b6c')
    })

    test('isEqualNotionPageId checks equality regardless of formatting', () => {
      const idWithDashes = 'c8f42289-42b8-4c28-971c-e7fb53641b6c'
      const idNoDashesUpper = 'C8F4228942B84C28971CE7FB53641B6C'
      const completelyDifferent = 'd8f42289-42b8-4c28-971c-e7fb53641b6d'

      expect(isEqualNotionPageId(idWithDashes, idNoDashesUpper)).toBe(true)
      expect(isEqualNotionPageId(idWithDashes, completelyDifferent)).toBe(false)
    })
  })

  describe('Display Category and Tags Fallbacks', () => {
    test('getDisplayCategory returns value or "미분류"', () => {
      expect(getDisplayCategory('AI')).toBe('AI')
      expect(getDisplayCategory(null)).toBe('미분류')
      expect(getDisplayCategory(undefined)).toBe('미분류')
      expect(getDisplayCategory('   ')).toBe('미분류')
    })

    test('getDisplayTags returns tags list or ["미분류"]', () => {
      expect(getDisplayTags(['review', 'study'])).toEqual(['review', 'study'])
      expect(getDisplayTags(null)).toEqual(['미분류'])
      expect(getDisplayTags(undefined)).toEqual(['미분류'])
      expect(getDisplayTags([])).toEqual(['미분류'])
    })

    test('getDisplayTags cleans whitespace-only elements and returns ["미분류"] if empty', () => {
      expect(getDisplayTags(['   ', ''])).toEqual(['미분류'])
      expect(getDisplayTags(['  tag1 ', '   ', 'tag2'])).toEqual(['tag1', 'tag2'])
    })
  })

  describe('AppRating to FSRS mapping', () => {
    test('AppRating maps correctly to FSRS numbers', () => {
      expect(mapAppRatingToFsrs('again')).toBe(FSRS_RATING.Again)
      expect(mapAppRatingToFsrs('hard')).toBe(FSRS_RATING.Hard)
      expect(mapAppRatingToFsrs('good')).toBe(FSRS_RATING.Good)
      expect(mapAppRatingToFsrs('easy')).toBe(FSRS_RATING.Easy)
    })
  })

  describe('Today Review Logic', () => {
    const defaultItem: ReviewItem = {
      id: 'item-1' as ReviewItemId,
      notionPageId: 'page-1' as NotionPageId,
      notionUrl: 'https://notion.so/page-1',
      title: 'Test Page',
      primarySourceId: 'src-1' as ReviewSourceId,
      sourceIds: ['src-1' as ReviewSourceId],
      dueAt: '2026-06-11T00:00:00Z' as DateTimeString,
      fsrsState: {
        version: 'ts-fsrs@5',
        payload: {
          stability: 1,
          difficulty: 1,
          elapsed_days: 0,
          scheduled_days: 1,
          reps: 1,
          lapses: 0,
          state: 0,
          last_review: null
        }
      },
      status: 'active',
      category: null,
      tags: [],
      originLabel: null,
      lastReviewedAt: null,
      notionLastEditedAt: null,
      lastSyncedAt: null,
      missingDetectedAt: null,
      deletedDetectedAt: null,
      createdAt: '2026-06-11T00:00:00Z' as DateTimeString,
      updatedAt: '2026-06-11T00:00:00Z' as DateTimeString
    }

    test('Item due in the past or today with active status is included in today review', () => {
      const today = '2026-06-11T12:00:00Z'
      const timeZone = 'UTC'

      const duePast: ReviewItem = {
        ...defaultItem,
        dueAt: '2026-06-10T23:59:59Z' as DateTimeString
      }
      const dueToday: ReviewItem = {
        ...defaultItem,
        dueAt: '2026-06-11T08:00:00Z' as DateTimeString
      }
      const dueFuture: ReviewItem = {
        ...defaultItem,
        dueAt: '2026-06-12T00:00:00Z' as DateTimeString
      }

      expect(isTodayReview(duePast, today, timeZone)).toBe(true)
      expect(isTodayReview(dueToday, today, timeZone)).toBe(true)
      expect(isTodayReview(dueFuture, today, timeZone)).toBe(false)
    })

    test('timezone offset changes local date calculation for midnight boundary', () => {
      // 2026-06-11T15:00:00Z is 2026-06-12T00:00:00 in Seoul (Asia/Seoul)
      const dueAtSeoulMidnight = '2026-06-11T15:00:00Z' as DateTimeString
      const item: ReviewItem = { ...defaultItem, dueAt: dueAtSeoulMidnight }

      // In UTC, 2026-06-11T15:00:00Z is June 11th. So if today is June 11th, it is due.
      const todayInUtc = '2026-06-11T12:00:00Z'
      expect(isTodayReview(item, todayInUtc, 'UTC')).toBe(true)

      // In Seoul, 2026-06-11T15:00:00Z is June 12th.
      // If today is June 11th in Seoul (represented by 2026-06-11T12:00:00Z which is Seoul 21:00:00),
      // it should NOT be due yet because the local due date is June 12th.
      expect(isTodayReview(item, todayInUtc, 'Asia/Seoul')).toBe(false)

      // If today is June 12th in Seoul (represented by 2026-06-11T15:00:00Z which is Seoul 00:00:00),
      // it is now due.
      const todayMidnightInSeoul = '2026-06-11T15:00:00Z'
      expect(isTodayReview(item, todayMidnightInSeoul, 'Asia/Seoul')).toBe(true)
    })

    test('FSRS state keeps library-specific data inside a versioned payload', () => {
      expect(defaultItem.fsrsState.version).toBe('ts-fsrs@5')
      expect(defaultItem.fsrsState.payload).toEqual({
        stability: 1,
        difficulty: 1,
        elapsed_days: 0,
        scheduled_days: 1,
        reps: 1,
        lapses: 0,
        state: 0,
        last_review: null
      })
    })

    test('Non-active items are excluded from today review regardless of dueAt', () => {
      const today = '2026-06-11T12:00:00Z'
      const timeZone = 'UTC'
      const statuses: ReviewItemStatus[] = [
        'changed',
        'missing',
        'deleted',
        'sync_error',
        'archived'
      ]

      statuses.forEach((status) => {
        const item: ReviewItem = {
          ...defaultItem,
          status,
          dueAt: '2026-06-10T00:00:00Z' as DateTimeString
        }
        expect(isTodayReview(item, today, timeZone)).toBe(false)
      })
    })

    test('Sorting by compareReviewItemsByDue helper function', () => {
      const item1: ReviewItem = {
        ...defaultItem,
        id: 'item-1' as ReviewItemId,
        dueAt: '2026-06-10T00:00:00Z' as DateTimeString,
        lastReviewedAt: '2026-06-09T00:00:00Z' as DateTimeString
      }

      const item2: ReviewItem = {
        ...defaultItem,
        id: 'item-2' as ReviewItemId,
        dueAt: '2026-06-11T00:00:00Z' as DateTimeString,
        lastReviewedAt: null
      }

      const item3: ReviewItem = {
        ...defaultItem,
        id: 'item-3' as ReviewItemId,
        dueAt: '2026-06-11T00:00:00Z' as DateTimeString,
        lastReviewedAt: '2026-06-08T00:00:00Z' as DateTimeString
      }

      const items = [item2, item1, item3]
      const sorted = [...items].sort(compareReviewItemsByDue)

      expect(sorted[0].id).toBe('item-1') // dueAt: 2026-06-10
      expect(sorted[1].id).toBe('item-2') // dueAt: 2026-06-11, lastReviewedAt: null
      expect(sorted[2].id).toBe('item-3') // dueAt: 2026-06-11, lastReviewedAt: 2026-06-08
    })

    test('Randomization boundaries filter only today review targets', () => {
      const items: ReviewItem[] = [
        {
          ...defaultItem,
          id: 'item-1' as ReviewItemId,
          dueAt: '2026-06-10T00:00:00Z' as DateTimeString,
          status: 'active'
        },
        {
          ...defaultItem,
          id: 'item-2' as ReviewItemId,
          dueAt: '2026-06-11T00:00:00Z' as DateTimeString,
          status: 'active'
        },
        {
          ...defaultItem,
          id: 'item-3' as ReviewItemId,
          dueAt: '2026-06-12T00:00:00Z' as DateTimeString,
          status: 'active'
        }, // future
        {
          ...defaultItem,
          id: 'item-4' as ReviewItemId,
          dueAt: '2026-06-10T00:00:00Z' as DateTimeString,
          status: 'changed'
        } // inactive
      ]

      const today = '2026-06-11T12:00:00Z'
      const timeZone = 'UTC'
      const todayReviewTargets = items.filter((item) => isTodayReview(item, today, timeZone))

      expect(todayReviewTargets.map((i) => i.id)).toEqual(['item-1', 'item-2'])
    })
  })
})
