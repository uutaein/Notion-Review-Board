/**
 * @file today-review-service.ts
 * @description Implements the business logic, time-boundary calculations, sorting, filtering,
 * and view model projections for the "Today Review" feature (SRS-FR-050 through SRS-FR-054).
 *
 * This service ensures that items scheduled for the user's current local date are eligible for review,
 * correctly handling daylight-saving transitions (DST) and time zone shifts, and presenting clean
 * view models to the presentation layer without leaking database structure.
 */

import {
  ReviewItem,
  getDisplayCategory,
  getDisplayTags,
  isTodayReview,
  compareReviewItemsByDue
} from '../../../shared/domain/item'
import type { ReviewSource } from '../../../shared/domain/source'
import type { DateTimeString, ReviewItemId, ReviewSourceId } from '../../../shared/domain/types'

/**
 * Represents the formatted review item payload projected to the presentation/renderer view.
 * It hides database-specific or library-specific structures and guarantees standard representations.
 */
export interface TodayReviewItem {
  /** The unique ID of the review item */
  id: ReviewItemId
  /** The visible title of the page/item */
  title: string
  /** The resolved human-readable name of the primary review source */
  sourceName: string
  /** The sanitized, display-friendly category name (defaults to '미분류' if missing) */
  displayCategory: string
  /** The sanitized list of tags (defaults to ['미분류'] if missing or empty) */
  tags: string[]
  /** Optional origin metadata tag (e.g. '공식 문서') */
  originLabel: string | null
  /** The ISO 8601 UTC date representing when this item was or is due */
  dueAt: DateTimeString
  /** The ISO 8601 UTC date of the last completed review, or null if never reviewed */
  lastReviewedAt: DateTimeString | null
  /** The lifecycle status of the item. Guaranteed to be 'active' for Today Review */
  status: 'active'
  /** The direct web address to open the target document/Notion page */
  notionUrl: string
}

/**
 * Defines the classification filter modes supported by the Today Review query.
 */
export type TodayReviewFilter =
  /** Matches items that have neither a category nor any tags defined */
  | { kind: 'unclassified' }
  /** Matches items with the exact specified category value */
  | { kind: 'category'; value: string }
  /** Matches items containing the exact specified tag value */
  | { kind: 'tag'; value: string }

/** Supported sorting modes for the Today Review list */
export type TodayReviewSort = 'due' | 'random'

/**
 * Holds the output payload of the Today Review query.
 */
export interface TodayReviewListResult {
  /** The ordered, filtered list of review items projected to the view model */
  items: TodayReviewItem[]
  /** True if no eligible items remain in today's review queue */
  isEmpty: boolean
  /** Provides context on why the list is empty (e.g., all caught up) or null if not empty */
  emptyReason: 'no-due-items' | null
  /** The active sort mode applied to the returned items */
  sort: TodayReviewSort
}

/**
 * Data retrieval dependency interface for fetching active review items and metadata.
 */
export interface TodayReviewReader {
  /** Retrieves all review items whose due date is on or before the specified boundary time */
  findDue(through: DateTimeString): ReviewItem[]
  /** Resolves metadata for a specific Notion database or synchronized source */
  findSourceById(id: ReviewSourceId): ReviewSource | null
}

/**
 * Service initialization dependencies.
 */
export interface TodayReviewServiceDependencies {
  /** Repository/data reader for review items and sources */
  reader: TodayReviewReader
  /** Optional custom random number generator (enables deterministic seeding for tests) */
  random?: () => number
}

/**
 * Input parameters to retrieve the Today Review list.
 */
export interface TodayReviewListInput {
  /** The current execution timestamp (anchor) in ISO 8601 format */
  now: DateTimeString
  /** The user's active IANA time zone identifier (e.g., 'Asia/Seoul', 'America/New_York') */
  timeZone: string
  /** The desired sorting criterion (defaults to 'due') */
  sort?: TodayReviewSort
  /** The optional metadata filter to select a subset of due items */
  filter?: TodayReviewFilter
}

/**
 * The TodayReviewService interface exposing the capability to list today's review queue.
 */
export interface TodayReviewService {
  /** Fetches, filters, sorts, and projects the review queue for the current local date */
  list(input: TodayReviewListInput): TodayReviewListResult
}

/**
 * Converts a set of local date-time components in a specific timezone to a UTC Date object.
 *
 * This function handles daylight-saving time (DST) and time zone offsets dynamically by
 * constructing an initial UTC estimate and checking the resulting timezone representation
 * using the system's `Intl.DateTimeFormat` parser. Any discrepancy is calculated and adjusted
 * iteratively to resolve the precise UTC epoch timestamp corresponding to the local time.
 *
 * @param year - Local year component.
 * @param month - Local month component (1-12).
 * @param day - Local day-of-month component.
 * @param hour - Local hour component (0-23).
 * @param minute - Local minute component (0-59).
 * @param second - Local second component (0-59).
 * @param timeZone - Target IANA time zone identifier.
 * @returns A standard JavaScript Date object set to the precise UTC instant.
 */
function localToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  // 1. Construct an initial estimate by treating the local components directly as UTC.
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second))

  // 2. Instantiate a formatter configured for the target time zone in 24-hour mode.
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

  // Helper utility to parse localized date-time components from formatted parts.
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

  // 3. Compare the local components observed in the target timezone with our target components.
  const guessParts = getParts(utcDate)
  const targetTime = Date.UTC(year, month - 1, day, hour, minute, second)
  
  // Normalize 24 hour representation to 0 index for midnight on systems that output 24.
  const normalizedGuessHour = guessParts.hour === 24 ? 0 : guessParts.hour
  const actualTimeInTz = Date.UTC(
    guessParts.year,
    guessParts.month - 1,
    guessParts.day,
    normalizedGuessHour,
    guessParts.minute,
    guessParts.second
  )

  // 4. Compute the adjustment offset (in milliseconds) and shift the estimate.
  const diff = targetTime - actualTimeInTz
  const resultDate = new Date(utcDate.getTime() + diff)

  // 5. Run a second-pass confirmation to verify correctness, particularly at DST boundaries.
  const finalParts = getParts(resultDate)
  const normalizedFinalHour = finalParts.hour === 24 ? 0 : finalParts.hour
  const finalTimeInTz = Date.UTC(
    finalParts.year,
    finalParts.month - 1,
    finalParts.day,
    normalizedFinalHour,
    finalParts.minute,
    finalParts.second
  )

  if (finalTimeInTz !== targetTime) {
    const secondDiff = targetTime - finalTimeInTz
    return new Date(resultDate.getTime() + secondDiff)
  }

  return resultDate
}

/**
 * Computes the exact end of the user's current local day in UTC time.
 *
 * Rather than using `now` directly or assuming a standard 24-hour day, this function
 * determines the local date of `now` in the user's timezone, finds the next day's local
 * midnight, and subtracts 1 millisecond. This ensures that every item due up to 23:59:59.999
 * in the local timezone is correctly collected (SRS-FR-050).
 *
 * @param now - The current anchor UTC timestamp.
 * @param timeZone - The user's active IANA time zone identifier.
 * @returns The ISO 8601 UTC string corresponding to the final millisecond of the current local date.
 * @throws {Error} If `now` is an invalid date or if `timeZone` is not supported.
 */
export function getLocalDayEndUtc(now: DateTimeString, timeZone: string): DateTimeString {
  // Validate date value
  if (isNaN(Date.parse(now))) {
    throw new Error('Invalid date')
  }
  // Validate time zone name by attempting instantiation
  try {
    Intl.DateTimeFormat(undefined, { timeZone })
  } catch {
    throw new Error('Invalid time zone')
  }

  // 1. Extract the current local date components (YYYY-MM-DD) in the target timezone
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

  // 2. Increment the local day to locate the next day's midnight boundary
  const nextDayLocalDate = new Date(Date.UTC(year, month - 1, day + 1))
  const nextYear = nextDayLocalDate.getUTCFullYear()
  const nextMonth = nextDayLocalDate.getUTCMonth() + 1
  const nextDay = nextDayLocalDate.getUTCDate()

  // 3. Resolve the UTC equivalent of that next local midnight (00:00:00)
  const nextMidnightUtc = localToUtc(nextYear, nextMonth, nextDay, 0, 0, 0, timeZone)

  // 4. Subtract 1 millisecond to target the final millisecond (23:59:59.999 local)
  const dayEndUtc = new Date(nextMidnightUtc.getTime() - 1)
  return dayEndUtc.toISOString() as DateTimeString
}

/**
 * Shuffles an array in place using the Fisher-Yates (Knuth) algorithm.
 *
 * Iterates backward through the array, swapping each element with another random element
 * chosen from the remaining indices. Utilizes an injectable random number generator
 * for test repeatability.
 *
 * @param array - The source array to shuffle.
 * @param random - Custom or standard random number generator.
 * @returns A new shuffled array.
 */
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

/**
 * Factory function to instantiate a new Today Review service.
 *
 * Registers the required database readers and optional random generators, encapsulating
 * validation, filtering, sorting, and projection operations.
 *
 * @param dependencies - Core operational requirements.
 * @returns TodayReviewService instance.
 */
export function createTodayReviewService(
  dependencies: TodayReviewServiceDependencies
): TodayReviewService {
  const { reader, random } = dependencies

  return {
    list({ now, timeZone, sort, filter }: TodayReviewListInput): TodayReviewListResult {
      // 1. Guard check inputs before querying database/storage.
      if (isNaN(Date.parse(now))) {
        throw new Error('Invalid date')
      }
      try {
        Intl.DateTimeFormat(undefined, { timeZone })
      } catch {
        throw new Error('Invalid time zone')
      }

      // Calculate the upper bound UTC timestamp for today's local date (e.g. 23:59:59.999)
      const endOfDayUtc = getLocalDayEndUtc(now, timeZone)

      // 2. Fetch all review items due on or before that boundary from the repository.
      const items = reader.findDue(endOfDayUtc)

      // 3. Apply eligibility rules: exclude items whose local due date is tomorrow,
      //    or whose status is not 'active' (e.g., changed, missing, deleted, sync_error, archived).
      const eligibleItems = items.filter((item) => isTodayReview(item, now, timeZone))

      // 4. Apply metadata classification filters (SRS-FR-054)
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

      // 5. Apply sorting (SRS-FR-052 / SRS-FR-053)
      let sortedItems = [...filteredItems]
      const activeSort = sort || 'due'
      if (activeSort === 'random') {
        const rand = random || Math.random
        sortedItems = shuffle(sortedItems, rand)
      } else {
        // Default sort is due date ascending; equal dates put never-reviewed items first
        sortedItems.sort(compareReviewItemsByDue)
      }

      // 6. Project database domain objects to representation view models (SRS-FR-051)
      const projectedItems = sortedItems.map((item): TodayReviewItem => {
        // Resolve database primary source display names
        const source = reader.findSourceById(item.primarySourceId)
        const sourceName = source ? source.name : '알 수 없는 Source'
        
        // Provide user-visible fallbacks for empty metadata categories and tags
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
