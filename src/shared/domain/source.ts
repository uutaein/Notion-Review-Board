import { ReviewSourceId, NotionTargetId, DateTimeString } from './types'

export type CollectionMode = 'tag' | 'checkbox' | 'all'
export type NotionTargetType = 'database' | 'data_source' | 'unknown'
export type FilterOperator = 'equals' | 'contains' | 'checked'

export interface FieldMapping {
  titlePropertyName: string
  urlPropertyName: string | null
  categoryPropertyName: string | null
  tagPropertyName: string | null
  sourcePropertyName: string | null
  reviewCheckboxPropertyName: string | null
  lastEditedPropertyName: string | null
}

export interface ReviewSource {
  id: ReviewSourceId
  name: string
  notionTargetId: NotionTargetId
  notionTargetUrl: string | null
  notionTargetType: NotionTargetType
  enabled: boolean
  collectionMode: CollectionMode

  // Field mappings
  titlePropertyName: string
  urlPropertyName: string | null
  categoryPropertyName: string | null
  tagPropertyName: string | null
  sourcePropertyName: string | null
  reviewCheckboxPropertyName: string | null
  lastEditedPropertyName: string | null

  // Collection filters
  filterPropertyName: string | null
  filterOperator: FilterOperator | null
  filterValue: string | null

  lastSyncedAt: DateTimeString | null
  createdAt: DateTimeString
  updatedAt: DateTimeString
}

/**
 * Pure function: Source 활성 여부에 따른 동기화 대상 판정
 */
export function isSyncTarget(source: ReviewSource): boolean {
  return source.enabled
}
