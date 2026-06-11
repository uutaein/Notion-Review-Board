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
