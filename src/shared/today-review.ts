export interface TodayReviewItemDto {
  id: string
  title: string
  sourceName: string
  displayCategory: string
  tags: string[]
  originLabel: string | null
  dueAt: string
  lastReviewedAt: string | null
  status: 'active'
  notionUrl: string
}

export interface TodayReviewListResultDto {
  items: TodayReviewItemDto[]
  isEmpty: boolean
  emptyReason: 'no-due-items' | null
  sort: 'due' | 'random'
}
