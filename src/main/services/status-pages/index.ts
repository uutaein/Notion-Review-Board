import {
  getDisplayCategory,
  getDisplayTags,
  type ReviewItem,
  type ReviewItemStatus
} from '../../../shared/domain/item'
import type { ReviewSource } from '../../../shared/domain/source'
import type { ReviewSourceId } from '../../../shared/domain/types'
import type {
  StatusPageItemDto,
  StatusPageKind,
  StatusPageListResultDto
} from '../../../shared/status-pages'

export interface StatusPageReader {
  findByStatuses(statuses: ReviewItemStatus[]): ReviewItem[]
  findSourceById(id: ReviewSourceId): ReviewSource | null
}

export interface StatusPageServiceDependencies {
  reader: StatusPageReader
}

export interface StatusPageService {
  list(input: { kind: StatusPageKind }): StatusPageListResultDto
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
  const { reader } = dependencies

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
    }
  }
}
