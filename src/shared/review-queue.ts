export interface ReviewQueueItemDto {
  id: string
  title: string
  sourceId: string
  sourceName: string
  sourceNames: string[]
  displayCategory: string
  tags: string[]
  originLabel: string | null
  dueAt: string
  lastReviewedAt: string | null
  lastSyncedAt: string | null
  status: 'active'
  notionUrl: string
}

export interface ReviewQueueListResultDto {
  items: ReviewQueueItemDto[]
  isEmpty: boolean
  emptyReason: 'no-active-items' | null
  totalCount: number
  sort: 'due'
}
