import {
  ReviewItem,
  getDisplayCategory,
  getDisplayTags,
  isTodayReview,
  compareReviewItemsByDue
} from '../../../shared/domain/item'
import type { ReviewSource } from '../../../shared/domain/source'
import type { DateTimeString, ReviewItemId, ReviewSourceId } from '../../../shared/domain/types'

export interface TodayReviewItem {
  id: ReviewItemId
  title: string
  sourceName: string
  displayCategory: string
  tags: string[]
  originLabel: string | null
  dueAt: DateTimeString
  lastReviewedAt: DateTimeString | null
  status: 'active'
  notionUrl: string
}

export type TodayReviewFilter =
  | { kind: 'unclassified' }
  | { kind: 'category'; value: string }
  | { kind: 'tag'; value: string }

export type TodayReviewSort = 'due' | 'random'

export interface TodayReviewListResult {
  items: TodayReviewItem[]
  isEmpty: boolean
  emptyReason: 'no-due-items' | null
  sort: TodayReviewSort
}

export interface TodayReviewReader {
  findDue(through: DateTimeString): ReviewItem[]
  findSourceById(id: ReviewSourceId): ReviewSource | null
}

export interface TodayReviewServiceDependencies {
  reader: TodayReviewReader
  random?: () => number
}

export interface TodayReviewListInput {
  now: DateTimeString
  timeZone: string
  sort?: TodayReviewSort
  filter?: TodayReviewFilter
}

export interface TodayReviewService {
  list(input: TodayReviewListInput): TodayReviewListResult
}

function localToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second))

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  })

  const getParts = (date: Date) => {
    const parts = formatter.formatToParts(date)
    const res: Record<string, number> = {}
    for (const p of parts) {
      if (p.type !== 'literal') {
        res[p.type] = parseInt(p.value, 10)
      }
    }
    return res
  }

  const guessParts = getParts(utcDate)
  const targetTime = Date.UTC(year, month - 1, day, hour, minute, second)
  const actualTimeInTz = Date.UTC(
    guessParts.year,
    guessParts.month - 1,
    guessParts.day,
    guessParts.hour === 24 ? 0 : guessParts.hour,
    guessParts.minute,
    guessParts.second
  )

  const diff = targetTime - actualTimeInTz
  const resultDate = new Date(utcDate.getTime() + diff)

  const finalParts = getParts(resultDate)
  const finalTimeInTz = Date.UTC(
    finalParts.year,
    finalParts.month - 1,
    finalParts.day,
    finalParts.hour === 24 ? 0 : finalParts.hour,
    finalParts.minute,
    finalParts.second
  )

  if (finalTimeInTz !== targetTime) {
    const secondDiff = targetTime - finalTimeInTz
    return new Date(resultDate.getTime() + secondDiff)
  }

  return resultDate
}

export function getLocalDayEndUtc(now: DateTimeString, timeZone: string): DateTimeString {
  // Validate inputs
  if (isNaN(Date.parse(now))) {
    throw new Error('Invalid date')
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone })
  } catch {
    throw new Error('Invalid time zone')
  }

  const date = new Date(now)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const parts = formatter.formatToParts(date)
  const yearStr = parts.find((part) => part.type === 'year')?.value
  const monthStr = parts.find((part) => part.type === 'month')?.value
  const dayStr = parts.find((part) => part.type === 'day')?.value

  if (!yearStr || !monthStr || !dayStr) {
    throw new RangeError('Unable to format the local date')
  }

  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  // Next local day date parts in UTC
  const nextDayLocalDate = new Date(Date.UTC(year, month - 1, day + 1))
  const nextYear = nextDayLocalDate.getUTCFullYear()
  const nextMonth = nextDayLocalDate.getUTCMonth() + 1
  const nextDay = nextDayLocalDate.getUTCDate()

  const nextMidnightUtc = localToUtc(nextYear, nextMonth, nextDay, 0, 0, 0, timeZone)

  // Subtract 1 millisecond
  const dayEndUtc = new Date(nextMidnightUtc.getTime() - 1)
  return dayEndUtc.toISOString() as DateTimeString
}

function shuffle<T>(array: T[], random: () => number): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const temp = result[i]
    result[i] = result[j]
    result[j] = temp
  }
  return result
}

export function createTodayReviewService(
  dependencies: TodayReviewServiceDependencies
): TodayReviewService {
  const { reader, random } = dependencies

  return {
    list({ now, timeZone, sort, filter }: TodayReviewListInput): TodayReviewListResult {
      // 1. Validate inputs before querying storage
      if (isNaN(Date.parse(now))) {
        throw new Error('Invalid date')
      }
      try {
        Intl.DateTimeFormat(undefined, { timeZone })
      } catch {
        throw new Error('Invalid time zone')
      }

      const endOfDayUtc = getLocalDayEndUtc(now, timeZone)

      // 2. Fetch all due items through the end of the local day
      const items = reader.findDue(endOfDayUtc)

      // 3. Filter for active and eligible items
      const eligibleItems = items.filter((item) => isTodayReview(item, now, timeZone))

      // 4. Apply filter criteria
      let filteredItems = [...eligibleItems]
      if (filter) {
        if (filter.kind === 'unclassified') {
          filteredItems = filteredItems.filter((item) => {
            const isCategoryEmpty = !item.category || item.category.trim() === ''
            const isTagsEmpty =
              !item.tags ||
              item.tags.map((t) => t.trim()).filter((t) => t !== '').length === 0
            return isCategoryEmpty && isTagsEmpty
          })
        } else if (filter.kind === 'category') {
          filteredItems = filteredItems.filter((item) => item.category === filter.value)
        } else if (filter.kind === 'tag') {
          filteredItems = filteredItems.filter((item) => item.tags.includes(filter.value))
        }
      }

      // 5. Apply sorting
      let sortedItems = [...filteredItems]
      const activeSort = sort || 'due'
      if (activeSort === 'random') {
        const rand = random || Math.random
        sortedItems = shuffle(sortedItems, rand)
      } else {
        // default sort is due
        sortedItems.sort(compareReviewItemsByDue)
      }

      // 6. Project to view model
      const projectedItems = sortedItems.map((item): TodayReviewItem => {
        const source = reader.findSourceById(item.primarySourceId)
        const sourceName = source ? source.name : '알 수 없는 Source'
        const displayCategory = getDisplayCategory(item.category)
        const tags = getDisplayTags(item.tags)

        return {
          id: item.id,
          title: item.title,
          sourceName,
          displayCategory,
          tags,
          originLabel: item.originLabel,
          dueAt: item.dueAt,
          lastReviewedAt: item.lastReviewedAt,
          status: 'active',
          notionUrl: item.notionUrl
        }
      })

      const isEmpty = projectedItems.length === 0

      return {
        items: projectedItems,
        isEmpty,
        emptyReason: isEmpty ? 'no-due-items' : null,
        sort: activeSort
      }
    }
  }
}
