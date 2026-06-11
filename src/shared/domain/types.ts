/**
 * Branded types for preventing compile-time ID mismatch bugs.
 */
export type ReviewSourceId = string & { readonly __brand: 'ReviewSourceId' }
export type ReviewItemId = string & { readonly __brand: 'ReviewItemId' }
export type ReviewLogId = string & { readonly __brand: 'ReviewLogId' }
export type SyncEventId = string & { readonly __brand: 'SyncEventId' }

// External integration IDs
export type NotionDatabaseId = string & { readonly __brand: 'NotionDatabaseId' }
export type NotionTargetId = string & { readonly __brand: 'NotionTargetId' }
export type NotionPageId = string & { readonly __brand: 'NotionPageId' }

export type JsonPrimitive = string | number | boolean | null
export type JsonObject = { [key: string]: JsonValue }
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]

/**
 * ISO 8601 UTC date-time string (e.g. "2026-06-11T20:00:00Z")
 */
export type DateTimeString = string & { readonly __brand: 'DateTimeString' }
