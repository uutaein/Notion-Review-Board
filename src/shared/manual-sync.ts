export type SyncFailureCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limit'
  | 'network_error'
  | 'schema_mismatch'
  | 'internal_error'

export interface SourceSyncCounts {
  created: number
  updated: number
  changed: number
  missing: number
  errors: number
}

export interface SourceSyncResult {
  sourceId: string
  status: 'completed' | 'failed' | 'cancelled'
  counts: SourceSyncCounts
  errorCode: SyncFailureCode | null
}

export interface ManualSyncResult {
  sources: SourceSyncResult[]
  totals: SourceSyncCounts
}

export type SyncProgress =
  | { state: 'running'; sourceId: string }
  | { state: 'source-completed'; sourceId: string; counts: SourceSyncCounts }
  | { state: 'source-failed'; sourceId: string; code: SyncFailureCode }
  | { state: 'source-cancelled'; sourceId: string }
