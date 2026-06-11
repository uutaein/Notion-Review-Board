/**
 * @file source-mapping.ts
 * @description Electron 메인 프로세스 내부에서 Review Source 및 Notion 필드 매핑 관련 IPC 이벤트를 안전하게 처리하고
 * 외부 렌더러 프로세스로부터의 비정상적인 호출을 예방 및 차단하는 보안 레이어입니다.
 * (SRS-NFR-SEC-008, SRS-NFR-SEC-010)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { ReviewSourceService } from '../services/source'
import { NotionSourceMetadataService } from '../services/notion/source-metadata'
import type { ReviewSource } from '../../shared/domain/source'

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

export function mapSourceToDto(source: ReviewSource): ReviewSourceDto {
  return {
    id: source.id,
    name: source.name,
    notionTargetId: source.notionTargetId,
    notionTargetUrl: source.notionTargetUrl,
    notionTargetType: source.notionTargetType,
    enabled: source.enabled,
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


/**
 * IPC 채널 등록 시 주입받아야 하는 의존성 사양입니다.
 */
export interface SourceMappingIpcDependencies {
  /** 복습 소스 서비스 */
  sourceService: ReviewSourceService
  /** Notion 메타데이터 서비스 */
  metadataService: NotionSourceMetadataService
  /** ipcMain 객체 */
  ipcMain: {
    handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void
  }
  /** IPC를 트리거한 렌더러 송신처(Sender) 프레임의 권한 및 신뢰성을 체크하는 검증 유틸리티 함수 */
  isValidSender: (event: unknown) => boolean
}

/**
 * 비정상적이거나 예외가 발생한 모든 IPC 호출 오류를 표준화된 에러 응답형식으로 포장하고 내부 디버그 스택 트레이스를 정제합니다. (SEC-010)
 */
function sanitizeIpcError(err: unknown): Error {
  const publicCodes = [
    'UNAUTHORIZED_SENDER',
    'INVALID_PAYLOAD',
    'SOURCE_NOT_FOUND',
    'DUPLICATE_TARGET',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'RATE_LIMITED',
    'NETWORK_ERROR',
    'INVALID_ITEM_POLICY',
    'INVALID_NAME',
    'INVALID_TITLE_MAPPING',
    'INVALID_TAG_FILTER',
    'INVALID_CHECKBOX_MAPPING',
    'INVALID_TARGET',
    'SYSTEM_SOURCE_PROTECTED',
    'MULTIPLE_DATA_SOURCES_FOUND'
  ]

  const originalMessage =
    err instanceof Error
      ? err.message
      : err && typeof err === 'object' && 'message' in err
        ? String((err as any).message)
        : String(err)
  const cleanMessage = publicCodes.includes(originalMessage) ? originalMessage : 'INTERNAL_ERROR'

  const cleanError = new Error(cleanMessage)
  cleanError.stack = ''
  return cleanError
}

/**
 * 소스 및 필드 매핑 관련 IPC 핸들러들을 등록합니다.
 */
export function registerSourceMappingIpc(dependencies: SourceMappingIpcDependencies): void {
  const { sourceService, metadataService, ipcMain, isValidSender } = dependencies

  /**
   * 유효성 검증 데코레이터를 적용한 공용 보안 래퍼 헬퍼 함수입니다.
   */
  function secureHandle(
    handler: (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown
  ) {
    return async (event: unknown, ...args: unknown[]) => {
      try {
        if (!isValidSender(event)) {
          throw new Error('UNAUTHORIZED_SENDER')
        }
        return await handler(event, ...args)
      } catch (err) {
        throw sanitizeIpcError(err)
      }
    }
  }

  /**
   * 페이로드가 객체 형식이고 지정된 허용 Key들을 초과하지 않는지 철저히 대조 검증합니다.
   */
  function validatePayloadKeys(payload: any, allowedKeys: string[]): void {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('INVALID_PAYLOAD')
    }
    const keys = Object.keys(payload)
    for (const key of keys) {
      if (!allowedKeys.includes(key)) {
        throw new Error('INVALID_PAYLOAD')
      }
    }
  }

  /**
   * 문자열 필드를 검증합니다. optional이 true일 경우 null 또는 undefined를 허용합니다.
   */
  function validateStringField(value: unknown, maxLength: number, optional = false): void {
    if (value === undefined || value === null) {
      if (optional) return
      throw new Error('INVALID_PAYLOAD')
    }
    if (typeof value !== 'string') {
      throw new Error('INVALID_PAYLOAD')
    }
    if (value.length > maxLength) {
      throw new Error('INVALID_PAYLOAD')
    }
  }

  /**
   * enum 형식의 필드를 검증합니다.
   */
  function validateEnumField<T>(value: unknown, allowedValues: T[], optional = false): void {
    if (value === undefined || value === null) {
      if (optional) return
      throw new Error('INVALID_PAYLOAD')
    }
    if (!allowedValues.includes(value as T)) {
      throw new Error('INVALID_PAYLOAD')
    }
  }

  // 1. 등록된 모든 복습 소스 목록 조회
  ipcMain.handle(
    'source:list',
    secureHandle((_event, ...args) => {
      if (args.length !== 0) {
        throw new Error('INVALID_PAYLOAD')
      }
      const sources = sourceService.listSources()
      return sources.map(mapSourceToDto)
    })
  )

  // 2. 특정 복습 소스 상세 조회
  ipcMain.handle(
    'source:get',
    secureHandle((_event, ...args) => {
      if (args.length !== 1) {
        throw new Error('INVALID_PAYLOAD')
      }
      const payload = args[0] as any
      validatePayloadKeys(payload, ['sourceId'])
      validateStringField(payload.sourceId, 64, false)
      const source = sourceService.getSource({ sourceId: payload.sourceId })
      return source ? mapSourceToDto(source) : null
    })
  )

  // 3. 신규 복습 소스 생성
  ipcMain.handle(
    'source:create',
    secureHandle(async (_event, ...args) => {
      if (args.length !== 1) {
        throw new Error('INVALID_PAYLOAD')
      }
      const payload = args[0] as any
      validatePayloadKeys(payload, [
        'name',
        'target',
        'enabled',
        'collectionMode',
        'titlePropertyName',
        'urlPropertyName',
        'categoryPropertyName',
        'tagPropertyName',
        'sourcePropertyName',
        'reviewCheckboxPropertyName',
        'lastEditedPropertyName',
        'filterPropertyName',
        'filterOperator',
        'filterValue'
      ])

      validateStringField(payload.name, 256, false)
      validateStringField(payload.target, 2048, false)

      if (typeof payload.enabled !== 'boolean') {
        throw new Error('INVALID_PAYLOAD')
      }

      validateEnumField(payload.collectionMode, ['tag', 'checkbox', 'all'], false)

      validateStringField(payload.titlePropertyName, 256, false)
      validateStringField(payload.urlPropertyName, 256, true)
      validateStringField(payload.categoryPropertyName, 256, true)
      validateStringField(payload.tagPropertyName, 256, true)
      validateStringField(payload.sourcePropertyName, 256, true)
      validateStringField(payload.reviewCheckboxPropertyName, 256, true)
      validateStringField(payload.lastEditedPropertyName, 256, true)
      validateStringField(payload.filterPropertyName, 256, true)
      validateEnumField(payload.filterOperator, ['equals', 'contains', 'checked'], true)
      validateStringField(payload.filterValue, 256, true)

      const created = await sourceService.createSource(payload)
      return mapSourceToDto(created)
    })
  )

  // 4. 기존 복습 소스 수정
  ipcMain.handle(
    'source:update',
    secureHandle((_event, ...args) => {
      if (args.length !== 1) {
        throw new Error('INVALID_PAYLOAD')
      }
      const payload = args[0] as any
      validatePayloadKeys(payload, [
        'id',
        'name',
        'enabled',
        'collectionMode',
        'titlePropertyName',
        'urlPropertyName',
        'categoryPropertyName',
        'tagPropertyName',
        'sourcePropertyName',
        'reviewCheckboxPropertyName',
        'lastEditedPropertyName',
        'filterPropertyName',
        'filterOperator',
        'filterValue'
      ])

      validateStringField(payload.id, 64, false)
      validateStringField(payload.name, 256, false)

      if (typeof payload.enabled !== 'boolean') {
        throw new Error('INVALID_PAYLOAD')
      }

      validateEnumField(payload.collectionMode, ['tag', 'checkbox', 'all'], false)

      validateStringField(payload.titlePropertyName, 256, false)
      validateStringField(payload.urlPropertyName, 256, true)
      validateStringField(payload.categoryPropertyName, 256, true)
      validateStringField(payload.tagPropertyName, 256, true)
      validateStringField(payload.sourcePropertyName, 256, true)
      validateStringField(payload.reviewCheckboxPropertyName, 256, true)
      validateStringField(payload.lastEditedPropertyName, 256, true)
      validateStringField(payload.filterPropertyName, 256, true)
      validateEnumField(payload.filterOperator, ['equals', 'contains', 'checked'], true)
      validateStringField(payload.filterValue, 256, true)

      const updated = sourceService.updateSource(payload)
      return mapSourceToDto(updated)
    })
  )

  // 5. 소스 삭제 시 고아 항목 통계 조회
  ipcMain.handle(
    'source:get-delete-impact',
    secureHandle((_event, ...args) => {
      if (args.length !== 1) {
        throw new Error('INVALID_PAYLOAD')
      }
      const payload = args[0] as any
      validatePayloadKeys(payload, ['sourceId'])
      validateStringField(payload.sourceId, 64, false)
      return sourceService.getDeleteImpact({ sourceId: payload.sourceId })
    })
  )

  // 6. 복습 소스 삭제
  ipcMain.handle(
    'source:delete',
    secureHandle((_event, ...args) => {
      if (args.length !== 1) {
        throw new Error('INVALID_PAYLOAD')
      }
      const payload = args[0] as any
      validatePayloadKeys(payload, ['sourceId', 'itemPolicy'])
      validateStringField(payload.sourceId, 64, false)
      validateEnumField(payload.itemPolicy, ['archive', 'delete', 'keep-history'], false)

      sourceService.deleteSource({
        sourceId: payload.sourceId,
        itemPolicy: payload.itemPolicy
      })
      return { success: true }
    })
  )

  // 7. 소스 활성/비활성화 토글
  ipcMain.handle(
    'source:set-enabled',
    secureHandle((_event, ...args) => {
      if (args.length !== 1) {
        throw new Error('INVALID_PAYLOAD')
      }
      const payload = args[0] as any
      validatePayloadKeys(payload, ['sourceId', 'enabled'])
      validateStringField(payload.sourceId, 64, false)
      if (typeof payload.enabled !== 'boolean') {
        throw new Error('INVALID_PAYLOAD')
      }
      const enabled = sourceService.setSourceEnabled({
        sourceId: payload.sourceId,
        enabled: payload.enabled
      })
      return mapSourceToDto(enabled)
    })
  )

  // 8. Notion 대상 URL/ID 식별
  ipcMain.handle(
    'notion:resolve-target',
    secureHandle(async (_event, ...args) => {
      if (args.length !== 1) {
        throw new Error('INVALID_PAYLOAD')
      }
      const payload = args[0] as any
      validatePayloadKeys(payload, ['target'])
      validateStringField(payload.target, 2048, false)
      return await metadataService.resolveTarget({ target: payload.target })
    })
  )

  // 9. Notion 속성 스키마 조회
  ipcMain.handle(
    'notion:list-properties',
    secureHandle(async (_event, ...args) => {
      if (args.length !== 1) {
        throw new Error('INVALID_PAYLOAD')
      }
      const payload = args[0] as any
      validatePayloadKeys(payload, ['target'])
      validateStringField(payload.target, 2048, false)
      return await metadataService.listProperties({ target: payload.target })
    })
  )

  // 10. 필드 매핑 규칙 검증
  ipcMain.handle(
    'notion:validate-mapping',
    secureHandle(async (_event, ...args) => {
      if (args.length !== 1) {
        throw new Error('INVALID_PAYLOAD')
      }
      const payload = args[0] as any
      validatePayloadKeys(payload, [
        'target',
        'collectionMode',
        'titlePropertyName',
        'urlPropertyName',
        'categoryPropertyName',
        'tagPropertyName',
        'sourcePropertyName',
        'reviewCheckboxPropertyName',
        'lastEditedPropertyName',
        'filterPropertyName',
        'filterOperator'
      ])

      validateStringField(payload.target, 2048, false)
      validateEnumField(payload.collectionMode, ['tag', 'checkbox', 'all'], false)
      validateStringField(payload.titlePropertyName, 256, false)
      validateStringField(payload.urlPropertyName, 256, true)
      validateStringField(payload.categoryPropertyName, 256, true)
      validateStringField(payload.tagPropertyName, 256, true)
      validateStringField(payload.sourcePropertyName, 256, true)
      validateStringField(payload.reviewCheckboxPropertyName, 256, true)
      validateStringField(payload.lastEditedPropertyName, 256, true)
      validateStringField(payload.filterPropertyName, 256, true)
      validateEnumField(payload.filterOperator, ['equals', 'contains', 'checked'], true)

      return await metadataService.validateMapping(payload)
    })
  )

  // 11. 필드 매핑 프리뷰 조회
  ipcMain.handle(
    'notion:preview-mapping',
    secureHandle(async (_event, ...args) => {
      if (args.length !== 1) {
        throw new Error('INVALID_PAYLOAD')
      }
      const payload = args[0] as any
      validatePayloadKeys(payload, [
        'target',
        'titlePropertyName',
        'urlPropertyName',
        'categoryPropertyName',
        'tagPropertyName',
        'sourcePropertyName',
        'reviewCheckboxPropertyName',
        'lastEditedPropertyName'
      ])

      validateStringField(payload.target, 2048, false)
      validateStringField(payload.titlePropertyName, 256, false)
      validateStringField(payload.urlPropertyName, 256, true)
      validateStringField(payload.categoryPropertyName, 256, true)
      validateStringField(payload.tagPropertyName, 256, true)
      validateStringField(payload.sourcePropertyName, 256, true)
      validateStringField(payload.reviewCheckboxPropertyName, 256, true)
      validateStringField(payload.lastEditedPropertyName, 256, true)

      return await metadataService.previewMapping(payload)
    })
  )
}
