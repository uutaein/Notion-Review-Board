import { ReviewItemId, NotionPageId, ReviewSourceId, DateTimeString, JsonObject } from './types'

export type ReviewItemStatus =
  | 'active'
  | 'changed'
  | 'missing'
  | 'deleted'
  | 'sync_error'
  | 'archived'

export interface FsrsState {
  version: string
  payload: JsonObject
}

export interface ReviewItem {
  id: ReviewItemId
  notionPageId: NotionPageId
  notionUrl: string
  title: string
  primarySourceId: ReviewSourceId
  sourceIds: ReviewSourceId[]
  dueAt: DateTimeString
  fsrsState: FsrsState
  status: ReviewItemStatus

  // Optional/Nullable metadata fields
  category: string | null
  tags: string[]
  originLabel: string | null
  lastReviewedAt: DateTimeString | null
  notionLastEditedAt: DateTimeString | null
  lastSyncedAt: DateTimeString | null
  missingDetectedAt: DateTimeString | null
  deletedDetectedAt: DateTimeString | null
  createdAt: DateTimeString
  updatedAt: DateTimeString
}

/**
 * Pure function: Convert UTC date-time string to local date string (YYYY-MM-DD) in the specified time zone
 */
export function getLocalDateString(utcString: string, timeZone: string): string {
  const date = new Date(utcString)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) {
    throw new RangeError('Unable to format the local date')
  }

  return `${year}-${month}-${day}`
}

/**
 * Pure function: ReviewItem이 Today Review 대상인지 판정
 * Comparison uses the user's explicit local timezone date
 */
export function isTodayReview(item: ReviewItem, todayUtc: string, timeZone: string): boolean {
  if (item.status !== 'active') return false

  const itemDate = getLocalDateString(item.dueAt, timeZone)
  const todayDate = getLocalDateString(todayUtc, timeZone)
  return itemDate <= todayDate
}

/**
 * Pure function: 상태 전이가 허용되는지 판정
 */
export function isValidStatusTransition(
  from: ReviewItemStatus | undefined,
  to: ReviewItemStatus
): boolean {
  if (from === undefined) {
    return to === 'active'
  }

  switch (from) {
    case 'active':
      return ['active', 'changed', 'missing', 'sync_error', 'archived'].includes(to)
    case 'changed':
      return to === 'active'
    case 'missing':
      return ['active', 'deleted', 'archived'].includes(to)
    case 'deleted':
      return to === 'archived'
    case 'sync_error':
      return to === 'active'
    case 'archived':
      return false
    default:
      return false
  }
}

/**
 * Pure function: Notion Page ID 정규화 (dash 제거 및 소문자화)
 */
export function normalizeNotionPageId(id: string): string {
  return id.replace(/-/g, '').toLowerCase()
}

/**
 * Pure function: 동일 Notion Page ID 여부 판정
 */
export function isEqualNotionPageId(id1: string, id2: string): boolean {
  return normalizeNotionPageId(id1) === normalizeNotionPageId(id2)
}

/**
 * Pure function: 분류가 비어 있을 때 '미분류' 반환
 */
export function getDisplayCategory(category?: string | null): string {
  if (!category || category.trim() === '') {
    return '미분류'
  }
  return category
}

/**
 * Pure function: 분류/태그가 비어 있거나 공백인 항목을 걸러내고 없으면 '미분류' 반환
 */
export function getDisplayTags(tags?: string[] | null): string[] {
  if (!tags) {
    return ['미분류']
  }
  const cleanTags = tags.map((t) => t.trim()).filter((t) => t !== '')
  if (cleanTags.length === 0) {
    return ['미분류']
  }
  return cleanTags
}

/**
 * Pure function: 복습 항목 정렬 비교 함수
 * 1. dueAt 오름차순
 * 2. dueAt이 같으면 lastReviewedAt이 오래되었거나 없는(null) 항목을 우선
 */
export function compareReviewItemsByDue(a: ReviewItem, b: ReviewItem): number {
  if (a.dueAt !== b.dueAt) {
    return a.dueAt.localeCompare(b.dueAt)
  }
  if (!a.lastReviewedAt && !b.lastReviewedAt) return 0
  if (!a.lastReviewedAt) return -1
  if (!b.lastReviewedAt) return 1
  return a.lastReviewedAt.localeCompare(b.lastReviewedAt)
}
