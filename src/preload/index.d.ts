import type { ReviewSource, CollectionMode, FilterOperator } from '../shared/domain/source'

export interface ElectronAPI {
  getAppVersion: () => Promise<string>
  openExternal: (url: string) => Promise<void>
}

export interface NotionConnectionAPI {
  getStatus: () => Promise<string>
  saveToken: (payload: { token: string }) => Promise<string>
  deleteToken: () => Promise<string>
  verify: () => Promise<string>
}

export interface CreateSourceInput {
  name: string
  target: string
  enabled: boolean
  collectionMode: CollectionMode
  titlePropertyName: string
  urlPropertyName?: string | null
  categoryPropertyName?: string | null
  tagPropertyName?: string | null
  sourcePropertyName?: string | null
  reviewCheckboxPropertyName?: string | null
  lastEditedPropertyName?: string | null
  filterPropertyName?: string | null
  filterOperator?: FilterOperator | null
  filterValue?: string | null
}

export interface UpdateSourceInput {
  id: string
  name: string
  enabled: boolean
  collectionMode: CollectionMode
  titlePropertyName: string
  urlPropertyName?: string | null
  categoryPropertyName?: string | null
  tagPropertyName?: string | null
  sourcePropertyName?: string | null
  reviewCheckboxPropertyName?: string | null
  lastEditedPropertyName?: string | null
  filterPropertyName?: string | null
  filterOperator?: FilterOperator | null
  filterValue?: string | null
}

export interface ReviewSourceAPI {
  listSources: () => Promise<ReviewSource[]>
  getSource: (payload: { sourceId: string }) => Promise<ReviewSource | null>
  createSource: (payload: CreateSourceInput) => Promise<ReviewSource>
  updateSource: (payload: UpdateSourceInput) => Promise<ReviewSource>
  getDeleteImpact: (payload: {
    sourceId: string
  }) => Promise<{ soleReferencedItemCount: number; sharedReferencedItemCount: number }>
  deleteSource: (payload: {
    sourceId: string
    itemPolicy: 'archive' | 'delete' | 'keep-history'
  }) => Promise<{ success: boolean }>
  setEnabled: (payload: { sourceId: string; enabled: boolean }) => Promise<ReviewSource>
}

export interface ResolveTargetResult {
  targetId: string
  targetType: 'database' | 'data_source' | 'unknown'
}

export interface NotionPropertyInfo {
  id: string
  name: string
  type: string
}

export interface ValidateMappingInput {
  target: string
  collectionMode: CollectionMode
  titlePropertyName: string
  urlPropertyName?: string | null
  categoryPropertyName?: string | null
  tagPropertyName?: string | null
  sourcePropertyName?: string | null
  reviewCheckboxPropertyName?: string | null
  lastEditedPropertyName?: string | null
  filterPropertyName?: string | null
  filterOperator?: FilterOperator | null
  filterValue?: string | null
}

export interface PreviewMappingInput {
  target: string
  titlePropertyName: string
  urlPropertyName?: string | null
  categoryPropertyName?: string | null
  tagPropertyName?: string | null
  sourcePropertyName?: string | null
  reviewCheckboxPropertyName?: string | null
  lastEditedPropertyName?: string | null
}

export interface PreviewMappingResult {
  hasSample: boolean
  title: string | null
  url: string | null
  category: string | null
  tags: string[]
  originLabel: string | null
  lastEditedAt: string | null
  reviewCheckbox: boolean | null
}

export interface NotionMetadataAPI {
  resolveTarget: (payload: { target: string }) => Promise<ResolveTargetResult>
  listProperties: (payload: { target: string }) => Promise<NotionPropertyInfo[]>
  validateMapping: (payload: ValidateMappingInput) => Promise<{ valid: boolean; errors: string[] }>
  previewMapping: (payload: PreviewMappingInput) => Promise<PreviewMappingResult>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
    notionConnection: NotionConnectionAPI
    reviewSource: ReviewSourceAPI
    notionMetadata: NotionMetadataAPI
  }
}
