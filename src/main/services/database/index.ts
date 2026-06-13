import Database from 'better-sqlite3'
import type { ReviewItem } from '../../../shared/domain/item'
import type { ReviewLog } from '../../../shared/domain/log'
import { runMigrations } from './migrations'
import {
  ReviewItemRepository,
  ReviewLogRepository,
  ReviewSourceRepository,
  SyncEventRepository
} from './repositories'
export { createDatabaseSyncPersistence } from './sync-persistence'

export interface DatabaseService {
  connection: Database.Database
  reviewSources: ReviewSourceRepository
  reviewItems: ReviewItemRepository
  reviewLogs: ReviewLogRepository
  syncEvents: SyncEventRepository
  recordReview(item: ReviewItem, log: ReviewLog): void
  close(): void
}

export function createDatabaseService(path: string): DatabaseService {
  const connection = new Database(path)
  connection.pragma('foreign_keys = ON')
  connection.pragma('busy_timeout = 5000')
  if (path !== ':memory:') {
    connection.pragma('journal_mode = WAL')
  }
  runMigrations(connection)

  // 시스템 기본 삭제 대피용 소스를 생성하여 삭제 시 외래 키 무결성을 지킵니다.
  connection
    .prepare(
      `
    INSERT OR IGNORE INTO review_sources (
      id, name, notion_target_id, notion_target_url, notion_target_type, enabled,
      collection_mode, title_property_name, url_property_name, category_property_name,
      tag_property_name, source_property_name, review_checkbox_property_name, last_edited_property_name,
      filter_property_name, filter_operator, filter_value, last_synced_at, created_at, updated_at
    ) VALUES (
      'system-deleted', '삭제된 소스 보관함', 'system-deleted-target', null, 'unknown', 0,
      'all', 'Name', null, null, null, null, null, null, null, null, null, null,
      '2026-06-11T00:00:00.000Z', '2026-06-11T00:00:00.000Z'
    )
  `
    )
    .run()

  const reviewSources = new ReviewSourceRepository(connection)
  const reviewItems = new ReviewItemRepository(connection)
  const reviewLogs = new ReviewLogRepository(connection)
  const syncEvents = new SyncEventRepository(connection)
  const recordReviewTransaction = connection.transaction((item: ReviewItem, log: ReviewLog) => {
    if (item.id !== log.reviewItemId) {
      throw new Error('Review item and log IDs do not match')
    }
    reviewLogs.save(log)
    reviewItems.save(item)
  })

  return {
    connection,
    reviewSources,
    reviewItems,
    reviewLogs,
    syncEvents,
    recordReview: (item, log) => recordReviewTransaction(item, log),
    close: () => connection.close()
  }
}
