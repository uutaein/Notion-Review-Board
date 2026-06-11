/**
 * @file index.ts
 * @description Review Source 설정의 생성, 수정, 삭제, 활성화 및 삭제 시 영향성 계산을 관리하는 서비스입니다.
 * 한국어 JSDoc 및 주석 규칙을 준수하여 작성되었습니다. (SRS-FR-010 ~ SRS-FR-013)
 */

import type {
  ReviewSource,
  CollectionMode,
  NotionTargetType,
  FilterOperator
} from '../../../shared/domain/source'
import type { ReviewSourceId, NotionTargetId, DateTimeString } from '../../../shared/domain/types'
import type { DatabaseService } from '../database'
import type { NotionTargetResolver } from '../notion/source-metadata'

/**
 * Source 삭제 시 영향을 받는 복습 항목의 통계 구조체입니다.
 */
export interface SourceDeleteImpact {
  /** 해당 Source만 단독으로 참조하고 있어 소스 삭제 시 고아가 되는 항목 수 */
  soleReferencedItemCount: number
  /** 해당 Source 외에 다른 소스도 함께 참조하고 있는 공유 항목 수 */
  sharedReferencedItemCount: number
}

/**
 * Review Source 설정을 관리하는 서비스 인터페이스입니다.
 */
export interface ReviewSourceService {
  /** 등록된 모든 복습 소스 목록을 생성일 순으로 조회합니다. */
  listSources(): ReviewSource[]
  /** 특정 복습 소스의 상세 설정을 조회합니다. */
  getSource(params: { sourceId: string }): ReviewSource | null
  /** 새로운 복습 소스를 유효성 검사 후 저장소에 등록합니다. */
  createSource(input: {
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
  }): Promise<ReviewSource>
  /** 기존 복습 소스의 설정을 변경하고 갱신합니다. */
  updateSource(input: {
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
  }): ReviewSource
  /** 특정 소스 삭제 시 고아가 되거나 영향을 받는 복습 항목 수를 산출합니다. */
  getDeleteImpact(params: { sourceId: string }): SourceDeleteImpact
  /** 특정 소스를 삭제하며, 선택한 항목 처리 정책에 따라 복습 항목을 정리합니다. */
  deleteSource(params: {
    sourceId: string
    itemPolicy: 'archive' | 'delete' | 'keep-history'
  }): void
  /** 특정 소스의 활성화/비활성화 상태를 토글합니다. */
  setSourceEnabled(params: { sourceId: string; enabled: boolean }): ReviewSource
}

/**
 * Notion Target ID를 추출하고 정형화하는 순수 함수 헬퍼입니다.
 * URL이나 UUID 형식 모두에서 32자리 hex string을 추출하여 대시를 제거하고 소문자화합니다.
 */
export function normalizeNotionTargetId(input: string): string {
  if (!input) return ''
  const trimmed = input.trim()

  // URL 형태인 경우 패스 추출
  let uuidPart = trimmed
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed)
      const pathParts = url.pathname.split('/')
      // 경로의 마지막 부분 또는 뒤에서 두 번째 부분에서 32자리 UUID를 찾습니다.
      const match = pathParts.find((p) => p.replace(/-/g, '').length === 32)
      if (match) {
        uuidPart = match
      } else {
        // v= query parameter 등에서 추출 시도
        const vParam = url.searchParams.get('v')
        if (vParam && vParam.length === 32) {
          uuidPart = vParam
        } else {
          // 마지막 슬래시 뒤 전체
          uuidPart = pathParts[pathParts.length - 1]
        }
      }
    } catch {
      // 파싱 실패 시 원본 문자열 유지
    }
  }

  // 대시 제거 및 32자리 16진수 검사
  const cleaned = uuidPart.replace(/-/g, '').toLowerCase()
  const hex32Regex = /^[0-9a-f]{32}$/
  if (hex32Regex.test(cleaned)) {
    return cleaned
  }

  // 정규화 실패 시 빈 문자열 반환
  return ''
}

/**
 * Review Source 서비스를 생성하는 팩토리 함수입니다.
 */
export function createReviewSourceService(dependencies: {
  database: DatabaseService
  resolver: NotionTargetResolver
  logger?: {
    info(msg: string): void
    error(msg: string): void
  }
}): ReviewSourceService {
  const { database, resolver, logger } = dependencies

  /**
   * 입력 필드 스펙에 따른 공통 유효성 검증을 수행합니다.
   */
  function validateSourceInput(input: {
    name: string
    collectionMode: CollectionMode
    titlePropertyName: string
    filterPropertyName?: string | null
    filterOperator?: FilterOperator | null
    filterValue?: string | null
    reviewCheckboxPropertyName?: string | null
  }) {
    if (!input.name || input.name.trim() === '') {
      throw new Error('INVALID_NAME')
    }
    if (!input.titlePropertyName || input.titlePropertyName.trim() === '') {
      throw new Error('INVALID_TITLE_MAPPING')
    }

    if (input.collectionMode === 'tag') {
      if (!input.filterPropertyName || input.filterPropertyName.trim() === '') {
        throw new Error('INVALID_TAG_FILTER')
      }
      if (!input.filterOperator || !['equals', 'contains'].includes(input.filterOperator)) {
        throw new Error('INVALID_TAG_FILTER')
      }
      if (!input.filterValue || input.filterValue.trim() === '') {
        throw new Error('INVALID_TAG_FILTER')
      }
    } else if (input.collectionMode === 'checkbox') {
      if (!input.reviewCheckboxPropertyName || input.reviewCheckboxPropertyName.trim() === '') {
        throw new Error('INVALID_CHECKBOX_MAPPING')
      }
    }
  }

  return {
    listSources(): ReviewSource[] {
      return database.reviewSources.findAll().filter((s) => s.id !== 'system-deleted')
    },

    getSource({ sourceId }): ReviewSource | null {
      if (sourceId === 'system-deleted') return null
      return database.reviewSources.findById(sourceId)
    },

    async createSource(input): Promise<ReviewSource> {
      // 1. Target ID 정규화
      const normalizedTargetId = normalizeNotionTargetId(input.target)
      if (!normalizedTargetId) {
        throw new Error('INVALID_TARGET')
      }

      // 실시간으로 Notion Target Resolver를 호출하여 실제 Target의 유효성과 타입을 검증합니다.
      const resolveResult = await resolver.resolve(normalizedTargetId)
      const resolvedType = resolveResult.targetType as NotionTargetType

      // 동일 Notion Target ID 중복 등록 차단 (해석된 실제 ID 기준)
      const allSources = database.reviewSources.findAll()
      const isDuplicate = allSources.some((s) => s.notionTargetId === resolveResult.targetId)
      if (isDuplicate) {
        throw new Error('DUPLICATE_TARGET')
      }

      // 2. 유효성 검증
      validateSourceInput(input)

      // 3. 모드별 필드 정리
      let filterProp: string | null = input.filterPropertyName || null
      let filterOp: FilterOperator | null = input.filterOperator || null
      let filterVal: string | null = input.filterValue || null
      let chkProp: string | null = input.reviewCheckboxPropertyName || null

      if (input.collectionMode === 'all') {
        filterProp = null
        filterOp = null
        filterVal = null
        chkProp = null
      } else if (input.collectionMode === 'checkbox') {
        filterProp = null
        filterOp = 'checked'
        filterVal = null
      } else if (input.collectionMode === 'tag') {
        chkProp = null
      }

      const now = new Date().toISOString()
      const sourceId = `src_${Math.random().toString(36).substr(2, 9)}` as ReviewSourceId

      const newSource: ReviewSource = {
        id: sourceId,
        name: input.name.trim(),
        notionTargetId: resolveResult.targetId as NotionTargetId,
        notionTargetUrl: input.target.startsWith('http') ? input.target : null,
        notionTargetType: resolvedType,
        enabled: input.enabled ?? true,
        collectionMode: input.collectionMode,
        titlePropertyName: input.titlePropertyName.trim(),
        urlPropertyName: input.urlPropertyName || null,
        categoryPropertyName: input.categoryPropertyName || null,
        tagPropertyName: input.tagPropertyName || null,
        sourcePropertyName: input.sourcePropertyName || null,
        reviewCheckboxPropertyName: chkProp,
        lastEditedPropertyName: input.lastEditedPropertyName || null,
        filterPropertyName: filterProp,
        filterOperator: filterOp,
        filterValue: filterVal,
        lastSyncedAt: null,
        createdAt: now as DateTimeString,
        updatedAt: now as DateTimeString
      }

      database.reviewSources.save(newSource)
      logger?.info(
        `새로운 Review Source가 생성되었습니다: ID: ${sourceId}, Target: ${normalizedTargetId}`
      )
      return newSource
    },

    updateSource(input): ReviewSource {
      if (input.id === 'system-deleted') {
        throw new Error('SYSTEM_SOURCE_PROTECTED')
      }
      const existing = database.reviewSources.findById(input.id)
      if (!existing) {
        throw new Error('SOURCE_NOT_FOUND')
      }

      // 유효성 검증
      validateSourceInput(input)

      // 모드별 필드 정리 및 normalization
      let filterProp: string | null = input.filterPropertyName || null
      let filterOp: FilterOperator | null = input.filterOperator || null
      let filterVal: string | null = input.filterValue || null
      let chkProp: string | null = input.reviewCheckboxPropertyName || null

      if (input.collectionMode === 'all') {
        filterProp = null
        filterOp = null
        filterVal = null
        chkProp = null
      } else if (input.collectionMode === 'checkbox') {
        filterProp = null
        filterOp = 'checked'
        filterVal = null
      } else if (input.collectionMode === 'tag') {
        chkProp = null
      }

      const updatedSource: ReviewSource = {
        ...existing,
        name: input.name.trim(),
        enabled: input.enabled,
        collectionMode: input.collectionMode,
        titlePropertyName: input.titlePropertyName.trim(),
        urlPropertyName: input.urlPropertyName || null,
        categoryPropertyName: input.categoryPropertyName || null,
        tagPropertyName: input.tagPropertyName || null,
        sourcePropertyName: input.sourcePropertyName || null,
        reviewCheckboxPropertyName: chkProp,
        lastEditedPropertyName: input.lastEditedPropertyName || null,
        filterPropertyName: filterProp,
        filterOperator: filterOp,
        filterValue: filterVal,
        updatedAt: new Date().toISOString() as DateTimeString
      }

      database.reviewSources.save(updatedSource)
      logger?.info(`Review Source 설정이 갱신되었습니다: ID: ${input.id}`)
      return updatedSource
    },

    getDeleteImpact({ sourceId }): SourceDeleteImpact {
      if (sourceId === 'system-deleted') {
        throw new Error('SYSTEM_SOURCE_PROTECTED')
      }
      const existing = database.reviewSources.findById(sourceId)
      if (!existing) {
        throw new Error('SOURCE_NOT_FOUND')
      }

      // DB 커넥션을 직접 이용해 참조 개수를 계산합니다.
      const items = database.connection
        .prepare(
          `
        SELECT id, source_ids_json FROM review_items
      `
        )
        .all() as { id: string; source_ids_json: string }[]

      let soleCount = 0
      let sharedCount = 0

      for (const item of items) {
        const sourceIds = JSON.parse(item.source_ids_json) as string[]
        if (sourceIds.includes(sourceId)) {
          if (sourceIds.length === 1) {
            soleCount++
          } else {
            sharedCount++
          }
        }
      }

      return {
        soleReferencedItemCount: soleCount,
        sharedReferencedItemCount: sharedCount
      }
    },

    deleteSource({ sourceId, itemPolicy }): void {
      if (sourceId === 'system-deleted') {
        throw new Error('SYSTEM_SOURCE_PROTECTED')
      }
      const existing = database.reviewSources.findById(sourceId)
      if (!existing) {
        throw new Error('SOURCE_NOT_FOUND')
      }
      if (!itemPolicy || !['archive', 'delete', 'keep-history'].includes(itemPolicy)) {
        throw new Error('INVALID_ITEM_POLICY')
      }

      const deleteTransaction = database.connection.transaction(() => {
        // 1. review_logs 테이블의 source_id를 'system-deleted'로 일괄 변경하여 외래 키 제약 조건 준수
        database.connection
          .prepare(
            `
          UPDATE review_logs
          SET source_id = 'system-deleted'
          WHERE source_id = ?
        `
          )
          .run(sourceId)

        // 2. sync_events 테이블의 source_id를 'system-deleted'로 일괄 변경
        database.connection
          .prepare(
            `
          UPDATE sync_events
          SET source_id = 'system-deleted'
          WHERE source_id = ?
        `
          )
          .run(sourceId)

        // 3. 영향 받는 복습 항목들 처리
        interface ReviewItemRow {
          id: string
          primary_source_id: string
          source_ids_json: string
        }
        const items = database.connection
          .prepare('SELECT * FROM review_items')
          .all() as ReviewItemRow[]

        for (const itemRow of items) {
          const sourceIds = JSON.parse(itemRow.source_ids_json) as string[]
          if (!sourceIds.includes(sourceId)) continue

          const newSourceIds = sourceIds.filter((id) => id !== sourceId)

          if (newSourceIds.length === 0) {
            // 단독 참조 복습 항목인 경우 정책에 따름
            if (itemPolicy === 'delete') {
              // 물리 삭제는 review_logs 테이블 등의 외래 키를 깨뜨리므로 'deleted' 상태로 soft-delete 처리하고 기본 소스를 안전망으로 이동
              database.connection
                .prepare(
                  `
                UPDATE review_items
                SET status = 'deleted', primary_source_id = 'system-deleted', source_ids_json = ?, updated_at = ?, deleted_detected_at = ?
                WHERE id = ?
              `
                )
                .run(
                  JSON.stringify([]),
                  new Date().toISOString(),
                  new Date().toISOString(),
                  itemRow.id
                )
            } else if (itemPolicy === 'archive') {
              // 아카이브 처리
              database.connection
                .prepare(
                  `
                UPDATE review_items
                SET status = 'archived', primary_source_id = 'system-deleted', source_ids_json = ?, updated_at = ?
                WHERE id = ?
              `
                )
                .run(JSON.stringify([]), new Date().toISOString(), itemRow.id)
            } else if (itemPolicy === 'keep-history') {
              // 상태 유지하며 basic metadata만 안전망으로 대피하여 히스토리 유지
              database.connection
                .prepare(
                  `
                UPDATE review_items
                SET primary_source_id = 'system-deleted', source_ids_json = ?, updated_at = ?
                WHERE id = ?
              `
                )
                .run(JSON.stringify([]), new Date().toISOString(), itemRow.id)
            }
          } else {
            // 여러 소스에서 공유 중인 복습 항목인 경우
            let newPrimary = itemRow.primary_source_id
            if (itemRow.primary_source_id === sourceId) {
              // 기본 소스가 지워진 소스인 경우 남은 소스 중 첫 번째를 기본 소스로 지정
              newPrimary = newSourceIds[0]
            }

            database.connection
              .prepare(
                `
              UPDATE review_items
              SET primary_source_id = ?, source_ids_json = ?, updated_at = ?
              WHERE id = ?
            `
              )
              .run(newPrimary, JSON.stringify(newSourceIds), new Date().toISOString(), itemRow.id)
          }
        }

        // 4. 소스 삭제 (외래 키가 모두 정리되었으므로 문제없이 정상 동작함)
        database.connection.prepare('DELETE FROM review_sources WHERE id = ?').run(sourceId)
      })

      deleteTransaction()
      logger?.info(`Review Source가 삭제되었습니다: ID: ${sourceId}, 정책: ${itemPolicy}`)
    },

    setSourceEnabled({ sourceId, enabled }): ReviewSource {
      if (sourceId === 'system-deleted') {
        throw new Error('SYSTEM_SOURCE_PROTECTED')
      }
      const existing = database.reviewSources.findById(sourceId)
      if (!existing) {
        throw new Error('SOURCE_NOT_FOUND')
      }

      const updated: ReviewSource = {
        ...existing,
        enabled,
        updatedAt: new Date().toISOString() as DateTimeString
      }

      database.reviewSources.save(updated)
      logger?.info(`Review Source 활성화 상태가 변경되었습니다: ID: ${sourceId}, 상태: ${enabled}`)
      return updated
    }
  }
}
