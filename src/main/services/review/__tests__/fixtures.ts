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
export const now = '2026-06-11T03:00:00.000Z' as DateTimeString

export function createReviewSource(overrides: Partial<ReviewSource> = {}): ReviewSource {
  return {
    id: sourceId,
    name: '개발 학습',
    notionTargetId: 'target-1' as NotionTargetId,
    notionTargetUrl: null,
    notionTargetType: 'data_source',
    enabled: true,
    collectionMode: 'all',
    titlePropertyName: 'Name',
    urlPropertyName: null,
    categoryPropertyName: 'Category',
    tagPropertyName: 'Tags',
    sourcePropertyName: 'Origin',
    reviewCheckboxPropertyName: null,
    lastEditedPropertyName: null,
    filterPropertyName: null,
    filterOperator: null,
    filterValue: null,
    lastSyncedAt: null,
    createdAt: '2026-06-01T00:00:00.000Z' as DateTimeString,
    updatedAt: '2026-06-01T00:00:00.000Z' as DateTimeString,
    ...overrides
  }
}

export function createReviewItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'item-1' as ReviewItemId,
    notionPageId: 'page-1' as NotionPageId,
    notionUrl: 'https://www.notion.so/page-1',
    title: 'Electron 프로세스 모델 정리',
    primarySourceId: sourceId,
    sourceIds: [sourceId],
    dueAt: '2026-06-10T15:00:00.000Z' as DateTimeString,
    fsrsState: {
      version: 'ts-fsrs@5',
      payload: {
        due: '2026-06-10T15:00:00.000Z',
        stability: 1,
        difficulty: 5,
        elapsed_days: 0,
        scheduled_days: 1,
        reps: 0,
        lapses: 0,
        state: 0,
        last_review: null
      }
    },
    status: 'active',
    category: 'Electron',
    tags: ['desktop', 'security'],
    originLabel: '공식 문서',
    lastReviewedAt: null,
    notionLastEditedAt: null,
    lastSyncedAt: '2026-06-11T01:00:00.000Z' as DateTimeString,
    missingDetectedAt: null,
    deletedDetectedAt: null,
    createdAt: '2026-06-01T00:00:00.000Z' as DateTimeString,
    updatedAt: '2026-06-11T01:00:00.000Z' as DateTimeString,
    ...overrides
  }
}
