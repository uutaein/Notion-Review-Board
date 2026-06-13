export interface TodayReviewItemDto {
  id: string
  title: string
  sourceId: string
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

export type TodayReviewListFilterDto =
  | { kind: 'unclassified' }
  | { kind: 'category'; value: string }
  | { kind: 'tag'; value: string }
  | { kind: 'source'; sourceId: string }

export interface TodayReviewListInputDto {
  sort?: 'due' | 'random'
  filter?: TodayReviewListFilterDto
}
