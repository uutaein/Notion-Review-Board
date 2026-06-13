import type { CollectionMode, FilterOperator } from '../shared/domain/source'
import type { ManualSyncResult, SyncProgress } from '../shared/manual-sync'
import type { NotionConnectionStatus } from '../shared/notion-connection'

export type {
  ManualSyncResult,
  SourceSyncCounts,
  SyncFailureCode,
  SyncProgress
} from '../shared/manual-sync'

export interface ElectronAPI {
  getAppVersion: () => Promise<string>
  openExternal: (url: string) => Promise<void>
}

export interface NotionConnectionAPI {
  getStatus: () => Promise<NotionConnectionStatus>
  saveToken: (payload: { token: string }) => Promise<NotionConnectionStatus>
  deleteToken: () => Promise<NotionConnectionStatus>
  verify: () => Promise<NotionConnectionStatus>
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

export interface ReviewSourceDto {
  id: string
  name: string
  notionTargetId: string
  notionTargetUrl: string | null
  notionTargetType: string
  enabled: boolean
  collectionMode: string
  titlePropertyName: string
  urlPropertyName: string | null
  categoryPropertyName: string | null
  tagPropertyName: string | null
  sourcePropertyName: string | null
  reviewCheckboxPropertyName: string | null
  lastEditedPropertyName: string | null
  filterPropertyName: string | null
  filterOperator: string | null
  filterValue: string | null
  lastSyncedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ReviewSourceAPI {
  listSources: () => Promise<ReviewSourceDto[]>
  getSource: (payload: { sourceId: string }) => Promise<ReviewSourceDto | null>
  createSource: (payload: CreateSourceInput) => Promise<ReviewSourceDto>
  updateSource: (payload: UpdateSourceInput) => Promise<ReviewSourceDto>
  getDeleteImpact: (payload: {
    sourceId: string
  }) => Promise<{ soleReferencedItemCount: number; sharedReferencedItemCount: number }>
  deleteSource: (payload: {
    sourceId: string
    itemPolicy: 'archive' | 'delete' | 'keep-history'
  }) => Promise<{ success: boolean }>
  setEnabled: (payload: { sourceId: string; enabled: boolean }) => Promise<ReviewSourceDto>
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

export interface ManualSyncAPI {
  syncAll: () => Promise<ManualSyncResult>
  syncSource: (payload: { sourceId: string }) => Promise<ManualSyncResult>
  cancel: () => Promise<{ cancelled: true }>
  onProgress: (listener: (progress: SyncProgress) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
    notionConnection: NotionConnectionAPI
    reviewSource: ReviewSourceAPI
    notionMetadata: NotionMetadataAPI
    manualSync: ManualSyncAPI
  }
}
