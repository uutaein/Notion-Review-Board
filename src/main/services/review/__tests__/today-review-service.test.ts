import { describe, expect, it, vi } from 'vitest'
import type { ReviewItem } from '../../../../shared/domain/item'
import type { DateTimeString, ReviewItemId } from '../../../../shared/domain/types'
import { createTodayReviewService, getLocalDayEndUtc, type TodayReviewReader } from '../index'
import { createReviewItem, createReviewSource, now, sourceId } from './fixtures'

function createReader(items: ReviewItem[]): TodayReviewReader {
  return {
    findDue: vi.fn(() => items),
    findSourceById: vi.fn((id) => (id === sourceId ? createReviewSource() : null))
  }
}

describe('TodayReviewService', () => {
  it('queries through the end of the user local day instead of the current instant', () => {
    const reader = createReader([])
    const service = createTodayReviewService({ reader })

    service.list({ now, timeZone: 'Asia/Seoul' })

    expect(reader.findDue).toHaveBeenCalledWith('2026-06-11T14:59:59.999Z')
  })

  it('handles daylight-saving local day boundaries', () => {
    expect(
      getLocalDayEndUtc('2026-03-08T16:00:00.000Z' as DateTimeString, 'America/New_York')
    ).toBe('2026-03-09T03:59:59.999Z')
  })

  it('defensively excludes future-local-date and non-active items returned by the reader', () => {
    const items = [
      createReviewItem({ id: 'due' as ReviewItemId }),
      createReviewItem({
        id: 'future-local-date' as ReviewItemId,
        dueAt: '2026-06-11T15:00:00.000Z' as DateTimeString
      }),
      createReviewItem({
        id: 'changed' as ReviewItemId,
        status: 'changed'
      })
    ]
    const service = createTodayReviewService({ reader: createReader(items) })

    const result = service.list({ now, timeZone: 'Asia/Seoul' })

    expect(result.items.map(({ id }) => id)).toEqual(['due'])
  })

  it('returns an explicit empty state when no item is eligible', () => {
    const service = createTodayReviewService({ reader: createReader([]) })

    const result = service.list({ now, timeZone: 'Asia/Seoul' })

    expect(result.items).toEqual([])
    expect(result.isEmpty).toBe(true)
    expect(result.emptyReason).toBe('no-due-items')
  })

  it('projects every field required by the Today Review feature', () => {
    const item = createReviewItem()
    const service = createTodayReviewService({ reader: createReader([item]) })

    const result = service.list({ now, timeZone: 'Asia/Seoul' })

    expect(result.items[0]).toEqual({
      id: item.id,
      title: item.title,
      sourceName: '개발 학습',
      displayCategory: 'Electron',
      tags: ['desktop', 'security'],
      originLabel: '공식 문서',
      dueAt: item.dueAt,
      lastReviewedAt: null,
      status: 'active',
      notionUrl: item.notionUrl
    })
  })

  it('uses visible fallbacks when source and classification metadata are missing', () => {
    const reader = createReader([
      createReviewItem({
        primarySourceId: 'missing-source' as typeof sourceId,
        sourceIds: ['missing-source' as typeof sourceId],
        category: ' ',
        tags: [' ', ''],
        originLabel: null
      })
    ])
    const service = createTodayReviewService({ reader })

    const result = service.list({ now, timeZone: 'Asia/Seoul' })

    expect(result.items[0]).toMatchObject({
      sourceName: '알 수 없는 Source',
      displayCategory: '미분류',
      tags: ['미분류'],
      originLabel: null
    })
  })

  it('uses due order by default and exposes the active sort mode', () => {
    const items = [
      createReviewItem({
        id: 'latest' as ReviewItemId,
        dueAt: '2026-06-11T05:00:00.000Z' as DateTimeString
      }),
      createReviewItem({
        id: 'oldest' as ReviewItemId,
        dueAt: '2026-06-09T00:00:00.000Z' as DateTimeString
      }),
      createReviewItem({
        id: 'same-due-reviewed' as ReviewItemId,
        dueAt: '2026-06-10T00:00:00.000Z' as DateTimeString,
        lastReviewedAt: '2026-06-01T00:00:00.000Z' as DateTimeString
      }),
      createReviewItem({
        id: 'same-due-never-reviewed' as ReviewItemId,
        dueAt: '2026-06-10T00:00:00.000Z' as DateTimeString,
        lastReviewedAt: null
      })
    ]
    const service = createTodayReviewService({ reader: createReader(items) })

    const result = service.list({ now, timeZone: 'Asia/Seoul' })

    expect(result.sort).toBe('due')
    expect(result.items.map(({ id }) => id)).toEqual([
      'oldest',
      'same-due-never-reviewed',
      'same-due-reviewed',
      'latest'
    ])
  })

  it('randomizes only eligible items when random sort is explicitly selected', () => {
    const random = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0)
    const service = createTodayReviewService({
      reader: createReader([
        createReviewItem({ id: 'one' as ReviewItemId }),
        createReviewItem({ id: 'two' as ReviewItemId }),
        createReviewItem({ id: 'three' as ReviewItemId }),
        createReviewItem({
          id: 'future' as ReviewItemId,
          dueAt: '2026-06-11T15:00:00.000Z' as DateTimeString
        })
      ]),
      random
    })

    const result = service.list({
      now,
      timeZone: 'Asia/Seoul',
      sort: 'random'
    })

    expect(result.sort).toBe('random')
    expect(result.items.map(({ id }) => id)).toEqual(['two', 'three', 'one'])
    expect(random).toHaveBeenCalledTimes(2)
  })

  it('does not consume randomness for the default due sort', () => {
    const random = vi.fn()
    const service = createTodayReviewService({
      reader: createReader([createReviewItem()]),
      random
    })

    service.list({ now, timeZone: 'Asia/Seoul' })

    expect(random).not.toHaveBeenCalled()
  })

  it('filters unclassified items without weakening due date or active status rules', () => {
    const service = createTodayReviewService({
      reader: createReader([
        createReviewItem({
          id: 'unclassified' as ReviewItemId,
          category: null,
          tags: []
        }),
        createReviewItem({
          id: 'classified' as ReviewItemId,
          category: 'Electron'
        }),
        createReviewItem({
          id: 'future-unclassified' as ReviewItemId,
          category: null,
          tags: [],
          dueAt: '2026-06-11T15:00:00.000Z' as DateTimeString
        }),
        createReviewItem({
          id: 'changed-unclassified' as ReviewItemId,
          category: null,
          tags: [],
          status: 'changed'
        })
      ])
    })

    const result = service.list({
      now,
      timeZone: 'Asia/Seoul',
      filter: { kind: 'unclassified' }
    })

    expect(result.items.map(({ id }) => id)).toEqual(['unclassified'])
  })

  it.each([
    [{ kind: 'category', value: 'Electron' } as const, ['category-match']],
    [{ kind: 'tag', value: 'security' } as const, ['tag-match']]
  ])('supports %j filtering', (filter, expectedIds) => {
    const service = createTodayReviewService({
      reader: createReader([
        createReviewItem({
          id: 'category-match' as ReviewItemId,
          category: 'Electron',
          tags: []
        }),
        createReviewItem({
          id: 'tag-match' as ReviewItemId,
          category: null,
          tags: ['security']
        })
      ])
    })

    const result = service.list({ now, timeZone: 'Asia/Seoul', filter })

    expect(result.items.map(({ id }) => id)).toEqual(expectedIds)
  })

  it('rejects invalid dates and time zones before querying storage', () => {
    const reader = createReader([])
    const service = createTodayReviewService({ reader })

    expect(() =>
      service.list({
        now: 'not-a-date' as DateTimeString,
        timeZone: 'Asia/Seoul'
      })
    ).toThrow(/date/i)
    expect(() =>
      service.list({
        now,
        timeZone: 'Invalid/TimeZone'
      })
    ).toThrow(/time zone/i)
    expect(reader.findDue).not.toHaveBeenCalled()
  })
})
