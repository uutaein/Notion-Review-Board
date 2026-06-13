export type StatusPageKind = 'changed' | 'missing-deleted'

export type StatusPageItemStatus = 'changed' | 'missing' | 'deleted'

export interface StatusPageItemDto {
  id: string
  title: string
  sourceName: string
  displayCategory: string
  tags: string[]
  status: StatusPageItemStatus
  notionPageId: string
  notionUrl: string
  dueAt: string
  lastReviewedAt: string | null
  lastSyncedAt: string | null
  notionLastEditedAt: string | null
  missingDetectedAt: string | null
  deletedDetectedAt: string | null
}

export interface StatusPageListInputDto {
  kind: StatusPageKind
}

export interface StatusPageListResultDto {
  kind: StatusPageKind
  items: StatusPageItemDto[]
  isEmpty: boolean
}
