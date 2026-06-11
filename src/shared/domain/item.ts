import { ReviewItemId, NotionPageId, ReviewSourceId, DateTimeString } from './types';

export type ReviewItemStatus = 'active' | 'changed' | 'missing' | 'deleted' | 'sync_error' | 'archived';

export interface FsrsState {
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
}

export interface ReviewItem {
  id: ReviewItemId;
  notionPageId: NotionPageId;
  notionUrl: string;
  title: string;
  primarySourceId: ReviewSourceId;
  sourceIds: ReviewSourceId[];
  dueAt: DateTimeString;
  fsrsState: FsrsState;
  status: ReviewItemStatus;
  
  // Optional/Nullable metadata fields
  category: string | null;
  tags: string[];
  originLabel: string | null;
  lastReviewedAt: DateTimeString | null;
  notionLastEditedAt: DateTimeString | null;
  lastSyncedAt: DateTimeString | null;
  missingDetectedAt: DateTimeString | null;
  deletedDetectedAt: DateTimeString | null;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
}

/**
 * Pure function: ReviewItem이 Today Review 대상인지 판정
 * dueAt <= today (YYYY-MM-DD comparison) and status === 'active'
 */
export function isTodayReview(item: ReviewItem, today: string): boolean {
  if (item.status !== 'active') return false;
  
  // Clean dates to YYYY-MM-DD
  const itemDate = item.dueAt.substring(0, 10);
  const todayDate = today.substring(0, 10);
  return itemDate <= todayDate;
}

/**
 * Pure function: 상태 전이가 허용되는지 판정
 */
export function isValidStatusTransition(from: ReviewItemStatus | undefined, to: ReviewItemStatus): boolean {
  if (from === undefined) {
    return to === 'active';
  }

  switch (from) {
    case 'active':
      return ['active', 'changed', 'missing', 'sync_error', 'archived'].includes(to);
    case 'changed':
      return to === 'active';
    case 'missing':
      return ['active', 'deleted', 'archived'].includes(to);
    case 'deleted':
      return to === 'archived';
    case 'sync_error':
      return to === 'active';
    case 'archived':
      // Archived is a terminal state in current specification
      return false;
    default:
      return false;
  }
}

/**
 * Pure function: Notion Page ID 정규화 (dash 제거 및 소문자화)
 */
export function normalizeNotionPageId(id: string): string {
  return id.replace(/-/g, '').toLowerCase();
}

/**
 * Pure function: 동일 Notion Page ID 여부 판정
 */
export function isEqualNotionPageId(id1: string, id2: string): boolean {
  return normalizeNotionPageId(id1) === normalizeNotionPageId(id2);
}

/**
 * Pure function: 분류가 비어 있을 때 '미분류' 반환
 */
export function getDisplayCategory(category?: string | null): string {
  if (!category || category.trim() === '') {
    return '미분류';
  }
  return category;
}

/**
 * Pure function: 분류/태그가 비어 있을 때 '미분류' 반환
 */
export function getDisplayTags(tags?: string[] | null): string[] {
  if (!tags || tags.length === 0) {
    return ['미분류'];
  }
  return tags;
}
