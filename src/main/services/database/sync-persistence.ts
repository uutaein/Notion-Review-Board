import { randomUUID } from 'node:crypto'
import type { ReviewItem } from '../../../shared/domain/item'
import { normalizeNotionPageId } from '../../../shared/domain/item'
import type { SyncEvent } from '../../../shared/domain/sync'
import type { ReviewSourceId, SyncEventId } from '../../../shared/domain/types'
import type {
  SourceSyncCommitInput,
  SourceSyncCounts,
  SyncFailureCode,
  SyncPersistence
} from '../synchronization'
import type { DatabaseService } from '.'

function createSyncEvent(input: Omit<SyncEvent, 'id'>): SyncEvent {
  return {
    id: `sync_${randomUUID()}` as SyncEventId,
    ...input
  }
}

function sourceIdsWithout(sourceIds: ReviewSourceId[], sourceId: ReviewSourceId): ReviewSourceId[] {
  return sourceIds.filter((id) => id !== sourceId)
}

export function createDatabaseSyncPersistence(database: DatabaseService): SyncPersistence {
  const applyTransaction = database.connection.transaction(
    ({
      source,
      pages,
      syncedAt,
      createReviewItemId,
      scheduler
    }: SourceSyncCommitInput): SourceSyncCounts => {
      const counts: SourceSyncCounts = {
        created: 0,
        updated: 0,
        changed: 0,
        missing: 0,
        errors: 0
      }
      const seenPageIds = new Set<string>()

      for (const page of pages) {
        const normalizedPageId = normalizeNotionPageId(page.notionPageId)
        if (seenPageIds.has(normalizedPageId)) continue
        seenPageIds.add(normalizedPageId)

        const existing = database.reviewItems.findByNotionPageId(normalizedPageId)
        if (!existing) {
          const initial = scheduler.createInitialState(syncedAt)
          const created: ReviewItem = {
            id: createReviewItemId(),
            notionPageId: normalizedPageId as ReviewItem['notionPageId'],
            notionUrl: page.notionUrl,
            title: page.title,
            primarySourceId: source.id,
            sourceIds: [source.id],
            dueAt: initial.dueAt,
            fsrsState: structuredClone(initial.state),
            status: 'active',
            category: page.category,
            tags: [...page.tags],
            originLabel: page.originLabel,
            lastReviewedAt: null,
            notionLastEditedAt: page.notionLastEditedAt,
            lastSyncedAt: syncedAt,
            missingDetectedAt: null,
            deletedDetectedAt: null,
            createdAt: syncedAt,
            updatedAt: syncedAt
          }
          database.reviewItems.save(created)
          database.syncEvents.save(
            createSyncEvent({
              sourceId: source.id,
              reviewItemId: created.id,
              eventType: 'created',
              severity: 'info',
              message: 'Review item created',
              technicalMessage: null,
              occurredAt: syncedAt
            })
          )
          counts.created++
          continue
        }

        const sourceIds = existing.sourceIds.includes(source.id)
          ? existing.sourceIds
          : [...existing.sourceIds, source.id]
        const changed =
          existing.status === 'active' &&
          existing.notionLastEditedAt !== null &&
          page.notionLastEditedAt !== null &&
          page.notionLastEditedAt > existing.notionLastEditedAt
        const recovered = existing.status === 'missing' || existing.status === 'sync_error'
        const status = changed ? 'changed' : recovered ? 'active' : existing.status
        const updated: ReviewItem = {
          ...existing,
          notionPageId: normalizedPageId as ReviewItem['notionPageId'],
          notionUrl: page.notionUrl,
          title: page.title,
          sourceIds,
          status,
          category: page.category,
          tags: [...page.tags],
          originLabel: page.originLabel,
          notionLastEditedAt: page.notionLastEditedAt,
          lastSyncedAt: syncedAt,
          missingDetectedAt: recovered ? null : existing.missingDetectedAt,
          updatedAt: syncedAt
        }
        database.reviewItems.save(updated)
        database.syncEvents.save(
          createSyncEvent({
            sourceId: source.id,
            reviewItemId: updated.id,
            eventType: changed ? 'changed_detected' : 'updated',
            severity: changed ? 'warning' : 'info',
            message: changed ? 'Notion page change detected' : 'Review item updated',
            technicalMessage: null,
            occurredAt: syncedAt
          })
        )
        counts.updated++
        if (changed) counts.changed++
      }

      const sourceRows = database.connection
        .prepare(
          `
          SELECT id, notion_page_id
          FROM review_items
          WHERE EXISTS (
            SELECT 1
            FROM json_each(review_items.source_ids_json)
            WHERE json_each.value = ?
          )
        `
        )
        .all(source.id) as { id: string; notion_page_id: string }[]

      for (const row of sourceRows) {
        if (seenPageIds.has(row.notion_page_id)) continue
        const existing = database.reviewItems.findById(row.id)
        if (!existing) continue

        const remainingSourceIds = sourceIdsWithout(existing.sourceIds, source.id)
        if (remainingSourceIds.length > 0) {
          database.reviewItems.save({
            ...existing,
            primarySourceId:
              existing.primarySourceId === source.id
                ? remainingSourceIds[0]
                : existing.primarySourceId,
            sourceIds: remainingSourceIds,
            updatedAt: syncedAt
          })
          continue
        }

        if (
          existing.status === 'deleted' ||
          existing.status === 'archived' ||
          existing.status === 'orphaned' ||
          existing.status === 'missing'
        ) {
          continue
        }

        const missing: ReviewItem = {
          ...existing,
          status: 'missing',
          missingDetectedAt: syncedAt,
          updatedAt: syncedAt
        }
        database.reviewItems.save(missing)
        database.syncEvents.save(
          createSyncEvent({
            sourceId: source.id,
            reviewItemId: missing.id,
            eventType: 'missing_detected',
            severity: 'warning',
            message: 'Review item missing from completed Source synchronization',
            technicalMessage: null,
            occurredAt: syncedAt
          })
        )
        counts.missing++
      }

      database.reviewSources.update({
        ...source,
        lastSyncedAt: syncedAt,
        updatedAt: syncedAt
      })

      return counts
    }
  )

  return {
    applySourceResult(input): SourceSyncCounts {
      return applyTransaction(input)
    },
    recordSourceFailure({ sourceId, code, occurredAt }): void {
      const messages: Record<SyncFailureCode, string> = {
        unauthorized: 'Notion authentication failed',
        forbidden: 'Notion permission denied',
        not_found: 'Notion Source not found',
        rate_limit: 'Notion rate limit exceeded',
        network_error: 'Notion network request failed',
        schema_mismatch: 'Notion Source schema mismatch',
        internal_error: 'Synchronization failed'
      }
      database.syncEvents.save(
        createSyncEvent({
          sourceId,
          reviewItemId: null,
          eventType: 'sync_error',
          severity: 'error',
          message: messages[code],
          technicalMessage: null,
          occurredAt
        })
      )
    }
  }
}
