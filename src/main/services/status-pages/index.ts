import {
  getDisplayCategory,
  getDisplayTags,
  type ReviewItem,
  type ReviewItemStatus
} from '../../../shared/domain/item'
import type { ReviewSource } from '../../../shared/domain/source'
import type { SyncEvent } from '../../../shared/domain/sync'
import type {
  DateTimeString,
  ReviewItemId,
  ReviewSourceId,
  SyncEventId
} from '../../../shared/domain/types'
import type {
  ChangedPageAction,
  HandleChangedPageResultDto,
  StatusPageItemDto,
  StatusPageKind,
  StatusPageListResultDto
} from '../../../shared/status-pages'

export interface StatusPageReader {
  findByStatuses(statuses: ReviewItemStatus[]): ReviewItem[]
  findSourceById(id: ReviewSourceId): ReviewSource | null
}

export interface StatusPagePersistence {
  findReviewItemById(id: ReviewItemId): ReviewItem | null
  recordStatusAction(item: ReviewItem, event: SyncEvent): void
}

export interface StatusPageServiceDependencies {
  reader: StatusPageReader
  persistence: StatusPagePersistence
  createSyncEventId: () => SyncEventId
}

export interface StatusPageService {
  list(input: { kind: StatusPageKind }): StatusPageListResultDto
  handleChanged(input: {
    reviewItemId: ReviewItemId
    action: ChangedPageAction
    handledAt: DateTimeString
  }): HandleChangedPageResultDto
}

function statusesForKind(kind: StatusPageKind): ReviewItemStatus[] {
  switch (kind) {
    case 'changed':
      return ['changed']
    case 'missing-deleted':
      return ['missing', 'deleted']
  }
}

function projectItem(item: ReviewItem, source: ReviewSource | null): StatusPageItemDto {
  return {
    id: item.id,
    title: item.title,
    sourceName: source?.name ?? '알 수 없는 Source',
    displayCategory: getDisplayCategory(item.category),
    tags: getDisplayTags(item.tags),
    status: item.status as StatusPageItemDto['status'],
    notionPageId: item.notionPageId,
    notionUrl: item.notionUrl,
    dueAt: item.dueAt,
    lastReviewedAt: item.lastReviewedAt,
    lastSyncedAt: item.lastSyncedAt,
    notionLastEditedAt: item.notionLastEditedAt,
    missingDetectedAt: item.missingDetectedAt,
    deletedDetectedAt: item.deletedDetectedAt
  }
}

export function createStatusPageService(
  dependencies: StatusPageServiceDependencies
): StatusPageService {
  const { reader, persistence, createSyncEventId } = dependencies

  return {
    list({ kind }) {
      const statuses = statusesForKind(kind)
      const items = reader.findByStatuses(statuses).map((item) => {
        const source = reader.findSourceById(item.primarySourceId)
        return projectItem(item, source)
      })

      return {
        kind,
        items,
        isEmpty: items.length === 0
      }
    },

    handleChanged({ reviewItemId, action, handledAt }) {
      const item = persistence.findReviewItemById(reviewItemId)
      if (!item) throw new Error('STATUS_ITEM_NOT_FOUND')
      if (item.status !== 'changed') throw new Error('STATUS_ITEM_NOT_CHANGED')

      const updated: ReviewItem = {
        ...item,
        status: 'active',
        dueAt: action === 'pull-today' ? handledAt : item.dueAt,
        updatedAt: handledAt
      }
      const event: SyncEvent = {
        id: createSyncEventId(),
        sourceId: item.primarySourceId,
        reviewItemId,
        eventType: 'user_action',
        severity: 'info',
        message:
          action === 'pull-today'
            ? 'Changed page pulled into Today Review'
            : 'Changed page kept on existing schedule',
        technicalMessage: null,
        occurredAt: handledAt
      }

      persistence.recordStatusAction(updated, event)

      return {
        itemId: updated.id,
        status: 'active',
        dueAt: updated.dueAt,
        handledAt
      }
    }
  }
}
