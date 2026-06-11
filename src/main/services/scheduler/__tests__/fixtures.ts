import type { ReviewItem } from '../../../../shared/domain/item'
import type { ReviewSource } from '../../../../shared/domain/source'
import type {
  DateTimeString,
  NotionPageId,
  NotionTargetId,
  ReviewItemId,
  ReviewSourceId
} from '../../../../shared/domain/types'

export const sourceId = 'source-1' as ReviewSourceId
export const itemId = 'item-1' as ReviewItemId
export const reviewedAt = '2026-06-11T12:00:00.000Z' as DateTimeString

export function createReviewSource(): ReviewSource {
  return {
    id: sourceId,
    name: 'Study',
    notionTargetId: 'target-1' as NotionTargetId,
    notionTargetUrl: null,
    notionTargetType: 'data_source',
    enabled: true,
    collectionMode: 'all',
    titlePropertyName: 'Name',
    urlPropertyName: null,
    categoryPropertyName: 'Category',
    tagPropertyName: 'Tags',
    sourcePropertyName: null,
    reviewCheckboxPropertyName: null,
    filterPropertyName: null,
    filterOperator: null,
    filterValue: null,
    lastSyncedAt: null,
    createdAt: '2026-06-01T00:00:00.000Z' as DateTimeString,
    updatedAt: '2026-06-01T00:00:00.000Z' as DateTimeString
  }
}

export function createReviewItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: itemId,
    notionPageId: 'page-1' as NotionPageId,
    notionUrl: 'https://www.notion.so/page-1',
    title: 'FSRS review',
    primarySourceId: sourceId,
    sourceIds: [sourceId],
    dueAt: '2026-06-11T00:00:00.000Z' as DateTimeString,
    fsrsState: {
      version: 'ts-fsrs@test',
      payload: {
        due: '2026-06-11T00:00:00.000Z',
        stability: 1,
        difficulty: 5,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        last_review: null
      }
    },
    status: 'active',
    category: 'database',
    tags: ['sqlite', 'fsrs'],
    originLabel: 'Notion',
    lastReviewedAt: null,
    notionLastEditedAt: '2026-06-10T00:00:00.000Z' as DateTimeString,
    lastSyncedAt: '2026-06-10T01:00:00.000Z' as DateTimeString,
    missingDetectedAt: null,
    deletedDetectedAt: null,
    createdAt: '2026-06-01T00:00:00.000Z' as DateTimeString,
    updatedAt: '2026-06-10T01:00:00.000Z' as DateTimeString,
    ...overrides
  }
}
