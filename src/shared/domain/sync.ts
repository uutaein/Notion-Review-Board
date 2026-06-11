import { SyncEventId, ReviewSourceId, ReviewItemId, DateTimeString } from './types'

export type SyncEventType =
  | 'created'
  | 'updated'
  | 'changed_detected'
  | 'missing_detected'
  | 'deleted_detected'
  | 'sync_error'
  | 'reviewed'
  | 'user_action'

export type SyncEventSeverity = 'info' | 'warning' | 'error'

/**
 * Synchronization errors as described in SRS
 */
export type SyncErrorType =
  | 'unauthorized' // Invalid token (401)
  | 'forbidden' // Insufficient permissions (403)
  | 'not_found' // Database/Source not found (404)
  | 'rate_limit' // Notion rate limit (429)
  | 'network_error' // Network issue / DNS
  | 'schema_mismatch' // Invalid mapping / properties missing
  | 'internal_error' // Unexpected errors

export interface SyncEvent {
  id: SyncEventId
  sourceId: ReviewSourceId | null
  reviewItemId: ReviewItemId | null
  eventType: SyncEventType
  severity: SyncEventSeverity
  message: string
  technicalMessage: string | null
  occurredAt: DateTimeString
}
