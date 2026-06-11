import type Database from 'better-sqlite3'
import type { ReviewItem } from '../../../shared/domain/item'
import type { ReviewLog } from '../../../shared/domain/log'
import type { ReviewSource } from '../../../shared/domain/source'
import type { SyncEvent } from '../../../shared/domain/sync'
import type { ReviewItemId } from '../../../shared/domain/types'

type SqlValue = string | number | bigint | Buffer | null
type SqlParams = Record<string, SqlValue>

function json(value: unknown): string {
  return JSON.stringify(value)
}

function parse<T>(value: string): T {
  return JSON.parse(value) as T
}

function sourceParams(source: ReviewSource): SqlParams {
  return {
    id: source.id,
    name: source.name,
    notionTargetId: source.notionTargetId,
    notionTargetUrl: source.notionTargetUrl,
    notionTargetType: source.notionTargetType,
    enabled: source.enabled ? 1 : 0,
    collectionMode: source.collectionMode,
    titlePropertyName: source.titlePropertyName,
    urlPropertyName: source.urlPropertyName,
    categoryPropertyName: source.categoryPropertyName,
    tagPropertyName: source.tagPropertyName,
    sourcePropertyName: source.sourcePropertyName,
    reviewCheckboxPropertyName: source.reviewCheckboxPropertyName,
    lastEditedPropertyName: source.lastEditedPropertyName,
    filterPropertyName: source.filterPropertyName,
    filterOperator: source.filterOperator,
    filterValue: source.filterValue,
    lastSyncedAt: source.lastSyncedAt,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt
  }
}

function itemParams(item: ReviewItem): SqlParams {
  return {
    id: item.id,
    notionPageId: item.notionPageId.replace(/-/g, '').toLowerCase(),
    notionUrl: item.notionUrl,
    title: item.title,
    primarySourceId: item.primarySourceId,
    sourceIdsJson: json(item.sourceIds),
    dueAt: item.dueAt,
    fsrsStateJson: json(item.fsrsState),
    status: item.status,
    category: item.category,
    tagsJson: json(item.tags),
    originLabel: item.originLabel,
    lastReviewedAt: item.lastReviewedAt,
    notionLastEditedAt: item.notionLastEditedAt,
    lastSyncedAt: item.lastSyncedAt,
    missingDetectedAt: item.missingDetectedAt,
    deletedDetectedAt: item.deletedDetectedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }
}

export class ReviewSourceRepository {
  constructor(private readonly database: Database.Database) {}

  save(source: ReviewSource): void {
    this.database
      .prepare(
        `
        INSERT INTO review_sources (
          id, name, notion_target_id, notion_target_url, notion_target_type, enabled,
          collection_mode, title_property_name, url_property_name, category_property_name,
          tag_property_name, source_property_name, review_checkbox_property_name, last_edited_property_name,
          filter_property_name, filter_operator, filter_value, last_synced_at, created_at, updated_at
        ) VALUES (
          @id, @name, @notionTargetId, @notionTargetUrl, @notionTargetType, @enabled,
          @collectionMode, @titlePropertyName, @urlPropertyName, @categoryPropertyName,
          @tagPropertyName, @sourcePropertyName, @reviewCheckboxPropertyName, @lastEditedPropertyName,
          @filterPropertyName, @filterOperator, @filterValue, @lastSyncedAt, @createdAt, @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          notion_target_id = excluded.notion_target_id,
          notion_target_url = excluded.notion_target_url,
          notion_target_type = excluded.notion_target_type,
          enabled = excluded.enabled,
          collection_mode = excluded.collection_mode,
          title_property_name = excluded.title_property_name,
          url_property_name = excluded.url_property_name,
          category_property_name = excluded.category_property_name,
          tag_property_name = excluded.tag_property_name,
          source_property_name = excluded.source_property_name,
          review_checkbox_property_name = excluded.review_checkbox_property_name,
          last_edited_property_name = excluded.last_edited_property_name,
          filter_property_name = excluded.filter_property_name,
          filter_operator = excluded.filter_operator,
          filter_value = excluded.filter_value,
          last_synced_at = excluded.last_synced_at,
          updated_at = excluded.updated_at
      `
      )
      .run(sourceParams(source))
  }

  findById(id: string): ReviewSource | null {
    const row = this.database.prepare('SELECT * FROM review_sources WHERE id = ?').get(id)
    return row ? mapSource(row as Record<string, unknown>) : null
  }

  findAll(): ReviewSource[] {
    return this.database
      .prepare('SELECT * FROM review_sources ORDER BY created_at, id')
      .all()
      .map((row) => mapSource(row as Record<string, unknown>))
  }
}

export class ReviewItemRepository {
  constructor(private readonly database: Database.Database) {}

  save(item: ReviewItem): void {
    this.database
      .prepare(
        `
        INSERT INTO review_items (
          id, notion_page_id, notion_url, title, primary_source_id, source_ids_json,
          due_at, fsrs_state_json, status, category, tags_json, origin_label,
          last_reviewed_at, notion_last_edited_at, last_synced_at, missing_detected_at,
          deleted_detected_at, created_at, updated_at
        ) VALUES (
          @id, @notionPageId, @notionUrl, @title, @primarySourceId, @sourceIdsJson,
          @dueAt, @fsrsStateJson, @status, @category, @tagsJson, @originLabel,
          @lastReviewedAt, @notionLastEditedAt, @lastSyncedAt, @missingDetectedAt,
          @deletedDetectedAt, @createdAt, @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          notion_page_id = excluded.notion_page_id,
          notion_url = excluded.notion_url,
          title = excluded.title,
          primary_source_id = excluded.primary_source_id,
          source_ids_json = excluded.source_ids_json,
          due_at = excluded.due_at,
          fsrs_state_json = excluded.fsrs_state_json,
          status = excluded.status,
          category = excluded.category,
          tags_json = excluded.tags_json,
          origin_label = excluded.origin_label,
          last_reviewed_at = excluded.last_reviewed_at,
          notion_last_edited_at = excluded.notion_last_edited_at,
          last_synced_at = excluded.last_synced_at,
          missing_detected_at = excluded.missing_detected_at,
          deleted_detected_at = excluded.deleted_detected_at,
          updated_at = excluded.updated_at
      `
      )
      .run(itemParams(item))
  }

  findById(id: string): ReviewItem | null {
    const row = this.database.prepare('SELECT * FROM review_items WHERE id = ?').get(id)
    return row ? mapItem(row as Record<string, unknown>) : null
  }

  findByNotionPageId(notionPageId: string): ReviewItem | null {
    const normalizedId = notionPageId.replace(/-/g, '').toLowerCase()
    const row = this.database
      .prepare('SELECT * FROM review_items WHERE notion_page_id = ?')
      .get(normalizedId)
    return row ? mapItem(row as Record<string, unknown>) : null
  }

  findDue(through: string): ReviewItem[] {
    return this.database
      .prepare(
        `
        SELECT * FROM review_items
        WHERE status = 'active' AND primary_source_id != 'system-deleted' AND due_at <= ?
        ORDER BY due_at, COALESCE(last_reviewed_at, ''), id
      `
      )
      .all(through)
      .map((row) => mapItem(row as Record<string, unknown>))
  }
}

export class ReviewLogRepository {
  constructor(private readonly database: Database.Database) {}

  save(log: ReviewLog): void {
    this.database
      .prepare(
        `
        INSERT INTO review_logs (
          id, review_item_id, rating, reviewed_at, previous_due_at, next_due_at,
          previous_fsrs_state_json, next_fsrs_state_json, source_id, category, created_at
        ) VALUES (
          @id, @reviewItemId, @rating, @reviewedAt, @previousDueAt, @nextDueAt,
          @previousFsrsStateJson, @nextFsrsStateJson, @sourceId, @category, @createdAt
        )
      `
      )
      .run({
        id: log.id,
        reviewItemId: log.reviewItemId,
        rating: log.rating,
        reviewedAt: log.reviewedAt,
        previousDueAt: log.previousDueAt,
        nextDueAt: log.nextDueAt,
        previousFsrsStateJson: json(log.previousFsrsState),
        nextFsrsStateJson: json(log.nextFsrsState),
        sourceId: log.sourceId,
        category: log.category,
        createdAt: log.createdAt
      })
  }

  findByItemId(itemId: ReviewItemId): ReviewLog[] {
    return this.database
      .prepare('SELECT * FROM review_logs WHERE review_item_id = ? ORDER BY reviewed_at, id')
      .all(itemId)
      .map((row) => mapLog(row as Record<string, unknown>))
  }
}

export class SyncEventRepository {
  constructor(private readonly database: Database.Database) {}

  save(event: SyncEvent): void {
    this.database
      .prepare(
        `
        INSERT INTO sync_events (
          id, source_id, review_item_id, event_type, severity,
          message, technical_message, occurred_at
        ) VALUES (
          @id, @sourceId, @reviewItemId, @eventType, @severity,
          @message, @technicalMessage, @occurredAt
        )
      `
      )
      .run(event)
  }

  findRecent(limit = 100): SyncEvent[] {
    return this.database
      .prepare('SELECT * FROM sync_events ORDER BY occurred_at DESC, id DESC LIMIT ?')
      .all(limit)
      .map((row) => mapSyncEvent(row as Record<string, unknown>))
  }
}

function mapSource(row: Record<string, unknown>): ReviewSource {
  return {
    id: row.id as ReviewSource['id'],
    name: row.name as string,
    notionTargetId: row.notion_target_id as ReviewSource['notionTargetId'],
    notionTargetUrl: row.notion_target_url as string | null,
    notionTargetType: row.notion_target_type as ReviewSource['notionTargetType'],
    enabled: row.enabled === 1,
    collectionMode: row.collection_mode as ReviewSource['collectionMode'],
    titlePropertyName: row.title_property_name as string,
    urlPropertyName: row.url_property_name as string | null,
    categoryPropertyName: row.category_property_name as string | null,
    tagPropertyName: row.tag_property_name as string | null,
    sourcePropertyName: row.source_property_name as string | null,
    reviewCheckboxPropertyName: row.review_checkbox_property_name as string | null,
    lastEditedPropertyName: row.last_edited_property_name as string | null,
    filterPropertyName: row.filter_property_name as string | null,
    filterOperator: row.filter_operator as ReviewSource['filterOperator'],
    filterValue: row.filter_value as string | null,
    lastSyncedAt: row.last_synced_at as ReviewSource['lastSyncedAt'],
    createdAt: row.created_at as ReviewSource['createdAt'],
    updatedAt: row.updated_at as ReviewSource['updatedAt']
  }
}

function mapItem(row: Record<string, unknown>): ReviewItem {
  return {
    id: row.id as ReviewItem['id'],
    notionPageId: row.notion_page_id as ReviewItem['notionPageId'],
    notionUrl: row.notion_url as string,
    title: row.title as string,
    primarySourceId: row.primary_source_id as ReviewItem['primarySourceId'],
    sourceIds: parse<ReviewItem['sourceIds']>(row.source_ids_json as string),
    dueAt: row.due_at as ReviewItem['dueAt'],
    fsrsState: parse<ReviewItem['fsrsState']>(row.fsrs_state_json as string),
    status: row.status as ReviewItem['status'],
    category: row.category as string | null,
    tags: parse<string[]>(row.tags_json as string),
    originLabel: row.origin_label as string | null,
    lastReviewedAt: row.last_reviewed_at as ReviewItem['lastReviewedAt'],
    notionLastEditedAt: row.notion_last_edited_at as ReviewItem['notionLastEditedAt'],
    lastSyncedAt: row.last_synced_at as ReviewItem['lastSyncedAt'],
    missingDetectedAt: row.missing_detected_at as ReviewItem['missingDetectedAt'],
    deletedDetectedAt: row.deleted_detected_at as ReviewItem['deletedDetectedAt'],
    createdAt: row.created_at as ReviewItem['createdAt'],
    updatedAt: row.updated_at as ReviewItem['updatedAt']
  }
}

function mapLog(row: Record<string, unknown>): ReviewLog {
  return {
    id: row.id as ReviewLog['id'],
    reviewItemId: row.review_item_id as ReviewLog['reviewItemId'],
    rating: row.rating as ReviewLog['rating'],
    reviewedAt: row.reviewed_at as ReviewLog['reviewedAt'],
    previousDueAt: row.previous_due_at as ReviewLog['previousDueAt'],
    nextDueAt: row.next_due_at as ReviewLog['nextDueAt'],
    previousFsrsState: parse<ReviewLog['previousFsrsState']>(
      row.previous_fsrs_state_json as string
    ),
    nextFsrsState: parse<ReviewLog['nextFsrsState']>(row.next_fsrs_state_json as string),
    sourceId: row.source_id as ReviewLog['sourceId'],
    category: row.category as string | null,
    createdAt: row.created_at as ReviewLog['createdAt']
  }
}

function mapSyncEvent(row: Record<string, unknown>): SyncEvent {
  return {
    id: row.id as SyncEvent['id'],
    sourceId: row.source_id as SyncEvent['sourceId'],
    reviewItemId: row.review_item_id as SyncEvent['reviewItemId'],
    eventType: row.event_type as SyncEvent['eventType'],
    severity: row.severity as SyncEvent['severity'],
    message: row.message as string,
    technicalMessage: row.technical_message as string | null,
    occurredAt: row.occurred_at as SyncEvent['occurredAt']
  }
}
