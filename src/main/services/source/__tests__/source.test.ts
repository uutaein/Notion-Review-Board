/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * @file source.test.ts
 * @description Review Source 생성, 수정, 삭제(영향 계산 포함), 활성화 정책 및 유효성 검사 규칙을
 * 철저하게 검증하는 비즈니스 서비스 단위 테스트 파일입니다.
 * 한국어 JSDoc 및 주석을 충실하게 작성하였습니다. (SRS-FR-010 ~ SRS-FR-013)
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { createDatabaseService, type DatabaseService } from '../../database'
import { createReviewSourceService, normalizeNotionTargetId } from '../index'
import type { ReviewSource, CollectionMode } from '../../../../shared/domain/source'
import type {
  ReviewSourceId,
  NotionTargetId,
  DateTimeString
} from '../../../../shared/domain/types'

describe('Review Source Service', () => {
  let database: DatabaseService
  let service: any
  let mockResolver: any

  beforeEach(() => {
    database = createDatabaseService(':memory:')
    mockResolver = {
      resolve: async (target: string) => {
        if (target.includes('invalid') || target.length !== 32) {
          throw new Error('INVALID_TARGET')
        }
        return { targetId: target, targetType: 'data_source' as const }
      }
    }
    service = createReviewSourceService({ database, resolver: mockResolver })
  })

  afterEach(() => {
    database?.close()
  })

  describe('Notion Target ID 정형화 (normalizeNotionTargetId)', () => {
    it('TC-SOURCE-004/010: Notion URL 및 UUID 대시 제거 대소문자 검증이 정상 작동합니다.', () => {
      const url = 'https://www.notion.so/workspace/a8aec8ae9b7e411cb3a8e9e1c1234567?v=abc'
      expect(normalizeNotionTargetId(url)).toBe('a8aec8ae9b7e411cb3a8e9e1c1234567')

      const uuid = 'a8aec8ae-9b7e-411c-b3a8-e9e1c1234567'
      expect(normalizeNotionTargetId(uuid)).toBe('a8aec8ae9b7e411cb3a8e9e1c1234567')

      const empty = ''
      expect(normalizeNotionTargetId(empty)).toBe('')
    })
  })

  describe('Source 생성 (createSource)', () => {
    it('TC-SOURCE-001/002: 유효한 정보를 기입하면 자동으로 ID와 UTC 생성 시각이 부여된 소스가 생성됩니다.', async () => {
      const result = await service.createSource({
        name: '수학 복습',
        target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
        enabled: true,
        collectionMode: 'all',
        titlePropertyName: 'Name'
      })

      expect(result.id).toBeDefined()
      expect(result.name).toBe('수학 복습')
      expect(result.notionTargetId).toBe('a8aec8ae9b7e411cb3a8e9e1c1234567')
      expect(result.collectionMode).toBe('all')
      expect(result.createdAt).toBeDefined()
      expect(result.updatedAt).toBeDefined()
    })

    it('TC-SOURCE-003: 이름이 누락되었거나 공백인 경우 생성이 거부됩니다.', async () => {
      await expect(
        service.createSource({
          name: '   ',
          target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
          enabled: true,
          collectionMode: 'all',
          titlePropertyName: 'Name'
        })
      ).rejects.toThrow('INVALID_NAME')
    })

    it('TC-SOURCE-006: Title 매핑 프로퍼티가 누락되었을 경우 거부됩니다.', async () => {
      await expect(
        service.createSource({
          name: '공부',
          target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
          enabled: true,
          collectionMode: 'all',
          titlePropertyName: '   '
        })
      ).rejects.toThrow('INVALID_TITLE_MAPPING')
    })

    it('TC-SOURCE-007: tag 모드인 경우 filter 속성과 연산자 및 값 유효성 체크를 진행합니다.', async () => {
      // 필터 속성 누락 시 거부
      await expect(
        service.createSource({
          name: '공부',
          target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
          enabled: true,
          collectionMode: 'tag',
          titlePropertyName: 'Name',
          filterPropertyName: ''
        })
      ).rejects.toThrow('INVALID_TAG_FILTER')

      // 연산자 불일치 시 거부
      await expect(
        service.createSource({
          name: '공부',
          target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
          enabled: true,
          collectionMode: 'tag',
          titlePropertyName: 'Name',
          filterPropertyName: 'Status',
          filterOperator: 'checked' as any,
          filterValue: 'Done'
        })
      ).rejects.toThrow('INVALID_TAG_FILTER')
    })

    it('TC-SOURCE-008: checkbox 모드인 경우 checkbox property mapping이 누락되면 거부됩니다.', async () => {
      await expect(
        service.createSource({
          name: '공부',
          target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
          enabled: true,
          collectionMode: 'checkbox',
          titlePropertyName: 'Name',
          reviewCheckboxPropertyName: ''
        })
      ).rejects.toThrow('INVALID_CHECKBOX_MAPPING')
    })

    it('TC-SOURCE-009: all 모드 시 불필요한 태그 및 체크박스 필터 설정값들은 안전하게 무시/정리됩니다.', async () => {
      const result = await service.createSource({
        name: '전체 수집공부',
        target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
        enabled: true,
        collectionMode: 'all',
        titlePropertyName: 'Name',
        filterPropertyName: 'Status',
        filterOperator: 'equals',
        filterValue: 'Done',
        reviewCheckboxPropertyName: 'IsReview'
      })

      expect(result.filterPropertyName).toBeNull()
      expect(result.filterOperator).toBeNull()
      expect(result.filterValue).toBeNull()
      expect(result.reviewCheckboxPropertyName).toBeNull()
    })

    it('TC-SOURCE-011: 중복된 Notion Target ID를 가진 소스가 이미 존재한다면 생성이 차단됩니다.', async () => {
      await service.createSource({
        name: '첫번째 소스',
        target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
        enabled: true,
        collectionMode: 'all',
        titlePropertyName: 'Name'
      })

      await expect(
        service.createSource({
          name: '두번째 소스(중복 target)',
          target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
          enabled: true,
          collectionMode: 'all',
          titlePropertyName: 'Name'
        })
      ).rejects.toThrow('DUPLICATE_TARGET')
    })
  })

  describe('Source 수정 (updateSource)', () => {
    let createdId: string

    beforeEach(async () => {
      const source = await service.createSource({
        name: '원본 소스',
        target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
        enabled: true,
        collectionMode: 'all',
        titlePropertyName: 'Name'
      })
      createdId = source.id
    })

    it('TC-SOURCE-013/014: 소스 설정 수정 시 수정 가능 필드만 갱신되고 생성시각 및 타겟 정보 등은 보존됩니다.', () => {
      const original = service.getSource({ sourceId: createdId })

      const updated = service.updateSource({
        id: createdId,
        name: '수정된 소스 이름',
        enabled: false,
        collectionMode: 'all',
        titlePropertyName: 'Name'
      })

      expect(updated.name).toBe('수정된 소스 이름')
      expect(updated.enabled).toBe(false)
      expect(updated.createdAt).toBe(original.createdAt)
      expect(updated.notionTargetId).toBe(original.notionTargetId)
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(original.updatedAt).getTime()
      )
    })

    it('TC-SOURCE-015: 소스 수정을 통한 모드 변경 시 해당 모드의 필수 필터 설정들이 재검증 및 정형화됩니다.', () => {
      // tag 모드로 변경 시 필터값 누락되면 예외 발생
      expect(() => {
        service.updateSource({
          id: createdId,
          name: '모드 변경 소스',
          enabled: true,
          collectionMode: 'tag',
          titlePropertyName: 'Name',
          filterPropertyName: ''
        })
      }).toThrow('INVALID_TAG_FILTER')
    })

    it('TC-SOURCE-016: 존재하지 않는 소스 수정 시 SOURCE_NOT_FOUND 에러를 발생시킵니다.', () => {
      expect(() => {
        service.updateSource({
          id: 'src_non_existent',
          name: '유령 소스',
          enabled: true,
          collectionMode: 'all',
          titlePropertyName: 'Name'
        })
      }).toThrow('SOURCE_NOT_FOUND')
    })
  })

  describe('Source 삭제 및 영향 분석 (getDeleteImpact / deleteSource)', () => {
    let sourceIdA: string
    let sourceIdB: string

    beforeEach(async () => {
      // 2개의 소스 등록
      const srcA = await service.createSource({
        name: '소스 A',
        target: 'a8aec8ae9b7e411cb3a8e9e1c1234561',
        enabled: true,
        collectionMode: 'all',
        titlePropertyName: 'Name'
      })
      sourceIdA = srcA.id

      const srcB = await service.createSource({
        name: '소스 B',
        target: 'a8aec8ae9b7e411cb3a8e9e1c1234562',
        enabled: true,
        collectionMode: 'all',
        titlePropertyName: 'Name'
      })
      sourceIdB = srcB.id

      // 1. 단독 소스 A만 참조하는 아이템 생성
      database.reviewItems.save({
        id: 'item-sole-a' as any,
        notionPageId: 'pagea',
        notionUrl: 'https://notion.so/pagea',
        title: '단독 아이템 A',
        primarySourceId: sourceIdA as any,
        sourceIds: [sourceIdA],
        dueAt: '2026-06-11T00:00:00Z',
        fsrsState: { version: '1', payload: {} },
        status: 'active',
        category: null,
        tags: [],
        originLabel: null,
        lastReviewedAt: null,
        notionLastEditedAt: null,
        lastSyncedAt: '2026-06-11T00:00:00Z',
        missingDetectedAt: null,
        deletedDetectedAt: null,
        createdAt: '2026-06-11T00:00:00Z',
        updatedAt: '2026-06-11T00:00:00Z'
      } as any)

      // 2. 소스 A와 소스 B를 둘 다 공유 참조하고 소스 A가 primary인 아이템 생성
      database.reviewItems.save({
        id: 'item-shared-ab' as any,
        notionPageId: 'pageab',
        notionUrl: 'https://notion.so/pageab',
        title: '공유 아이템 AB',
        primarySourceId: sourceIdA as any,
        sourceIds: [sourceIdA, sourceIdB],
        dueAt: '2026-06-11T00:00:00Z',
        fsrsState: { version: '1', payload: {} },
        status: 'active',
        category: null,
        tags: [],
        originLabel: null,
        lastReviewedAt: null,
        notionLastEditedAt: null,
        lastSyncedAt: '2026-06-11T00:00:00Z',
        missingDetectedAt: null,
        deletedDetectedAt: null,
        createdAt: '2026-06-11T00:00:00Z',
        updatedAt: '2026-06-11T00:00:00Z'
      } as any)

      // 3. 복습 로그(Review Log) 연결
      database.reviewLogs.save({
        id: 'log-sole-a' as any,
        reviewItemId: 'item-sole-a' as any,
        rating: 'good',
        reviewedAt: '2026-06-11T00:00:00Z',
        previousDueAt: '2026-06-11T00:00:00Z',
        nextDueAt: '2026-06-18T00:00:00Z',
        previousFsrsState: { version: '1', payload: {} },
        nextFsrsState: { version: '1', payload: {} },
        sourceId: sourceIdA,
        category: null,
        createdAt: '2026-06-11T00:00:00Z'
      } as any)
    })

    it('TC-SOURCE-018: 소스 삭제 전 고아 및 공유 복습 항목의 카운트가 정상적으로 파악됩니다.', () => {
      const impact = service.getDeleteImpact({ sourceId: sourceIdA })
      expect(impact.soleReferencedItemCount).toBe(1) // item-sole-a
      expect(impact.sharedReferencedItemCount).toBe(1) // item-shared-ab
    })

    it('TC-SOURCE-019: 소스 삭제 시 아이템 처리 정책이 유효하지 않으면 예외가 발생합니다.', () => {
      expect(() => {
        service.deleteSource({ sourceId: sourceIdA, itemPolicy: 'invalid_policy' as any })
      }).toThrow('INVALID_ITEM_POLICY')
    })

    it('TC-SOURCE-020/021: 공유 복습 항목이 묶인 소스 삭제 시, 해당 소스 ID가 제거되며 삭제된 소스가 primary였다면 남은 소스가 primary로 대체됩니다.', () => {
      // 소스 A 삭제 실행 (아이템 정책은 archive로)
      service.deleteSource({ sourceId: sourceIdA, itemPolicy: 'archive' })

      const sharedItem = database.reviewItems.findById('item-shared-ab')
      expect(sharedItem).toBeDefined()
      expect(sharedItem?.sourceIds).toEqual([sourceIdB]) // 소스 A가 잘려나감
      expect(sharedItem?.primarySourceId).toBe(sourceIdB) // B가 새로운 기본 소스가 됨
    })

    it('TC-SOURCE-022 (delete 정책): 단독 참조 복습 항목이 물리적으로 삭제되지 않고 status가 deleted로 soft-delete 처리됩니다.', () => {
      service.deleteSource({ sourceId: sourceIdA, itemPolicy: 'delete' })

      const soleItem = database.reviewItems.findById('item-sole-a')
      expect(soleItem).toBeDefined()
      expect(soleItem?.status).toBe('deleted')
      expect(soleItem?.primarySourceId).toBe('system-deleted')
    })

    it('TC-SOURCE-022 (archive 정책): 단독 참조 복습 항목이 archived 상태로 변경되고 primarySourceId가 system-deleted가 됩니다.', () => {
      service.deleteSource({ sourceId: sourceIdA, itemPolicy: 'archive' })

      const soleItem = database.reviewItems.findById('item-sole-a')
      expect(soleItem).toBeDefined()
      expect(soleItem?.status).toBe('archived')
      expect(soleItem?.primarySourceId).toBe('system-deleted')
    })

    it('TC-SOURCE-022 (keep-history 정책): 단독 참조 복습 항목의 히스토리가 유지되며 primarySourceId가 system-deleted로 대피됩니다.', () => {
      service.deleteSource({ sourceId: sourceIdA, itemPolicy: 'keep-history' })

      const soleItem = database.reviewItems.findById('item-sole-a')
      expect(soleItem).toBeDefined()
      expect(soleItem?.status).toBe('active') // 원래 active 유지
      expect(soleItem?.primarySourceId).toBe('system-deleted')
    })

    it('TC-SOURCE-023: 어떤 소스 삭제 처리 하에서도 기존 복습 로그(Review Log)는 절대 훼손 또는 삭제되지 않으며, sourceId가 system-deleted로 변경됩니다.', () => {
      service.deleteSource({ sourceId: sourceIdA, itemPolicy: 'delete' })

      const logs = database.reviewLogs.findByItemId('item-sole-a' as any)
      expect(logs.length).toBe(1) // 로그는 안전하게 보존됨
      expect(logs[0].id).toBe('log-sole-a')
      expect(logs[0].sourceId).toBe('system-deleted')
    })

    it('TC-SOURCE-022 (keep-history 정책) 시, 복습 항목 상태는 active로 유지되지만 findDue 조회 시에는 system-deleted 필터에 의해 배제됩니다.', () => {
      service.deleteSource({ sourceId: sourceIdA, itemPolicy: 'keep-history' })

      const soleItem = database.reviewItems.findById('item-sole-a')
      expect(soleItem).toBeDefined()
      expect(soleItem?.status).toBe('active')

      const dueItems = database.reviewItems.findDue('2026-06-12T00:00:00Z')
      expect(dueItems.some((item) => item.id === 'item-sole-a')).toBe(false)
    })
  })

  describe('Source 활성화 정책 (setSourceEnabled)', () => {
    let sourceId: string

    beforeEach(async () => {
      const source = await service.createSource({
        name: '활성 소스',
        target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
        enabled: true,
        collectionMode: 'all',
        titlePropertyName: 'Name'
      })
      sourceId = source.id
    })

    it('TC-SOURCE-025/026/027: 소스 비활성화 시 설정은 변경되나 기존 항목의 일정/상태에는 영향이 없으며 재활성화 시 동기화 대상에 복귀합니다.', () => {
      const originalItem = {
        id: 'item-test' as any,
        notionPageId: 'page_test',
        notionUrl: 'https://notion.so/page_test',
        title: '항목',
        primarySourceId: sourceId as any,
        sourceIds: [sourceId],
        dueAt: '2026-06-11T00:00:00Z',
        fsrsState: { version: '1', payload: {} },
        status: 'active',
        category: null,
        tags: [],
        originLabel: null,
        lastReviewedAt: null,
        notionLastEditedAt: null,
        lastSyncedAt: '2026-06-11T00:00:00Z',
        missingDetectedAt: null,
        deletedDetectedAt: null,
        createdAt: '2026-06-11T00:00:00Z',
        updatedAt: '2026-06-11T00:00:00Z'
      }
      database.reviewItems.save(originalItem as any)

      // 비활성화
      const disabledSource = service.setSourceEnabled({ sourceId, enabled: false })
      expect(disabledSource.enabled).toBe(false)

      // 비활성 처리되어도 기존 Review Item의 status, dueAt 은 온전히 유지되어야 함
      const item = database.reviewItems.findById('item-test')
      expect(item?.status).toBe('active')
      expect(item?.dueAt).toBe('2026-06-11T00:00:00Z')

      // 재활성화
      const enabledSource = service.setSourceEnabled({ sourceId, enabled: true })
      expect(enabledSource.enabled).toBe(true)
    })
  })

  describe('System Source Protection', () => {
    it('system-deleted 소스는 listSources 목록에 포함되지 않습니다.', () => {
      const list = service.listSources()
      expect(list.some((s: any) => s.id === 'system-deleted')).toBe(false)
    })

    it('system-deleted 소스는 getSource 상세 조회 결과 null을 반환합니다.', () => {
      const src = service.getSource({ sourceId: 'system-deleted' })
      expect(src).toBeNull()
    })

    it('system-deleted 소스 변경, 삭제, 활성화 시도 시 SYSTEM_SOURCE_PROTECTED 에러가 발생합니다.', () => {
      expect(() => {
        service.updateSource({
          id: 'system-deleted',
          name: '수정 시도',
          enabled: true,
          collectionMode: 'all',
          titlePropertyName: 'Name'
        })
      }).toThrow('SYSTEM_SOURCE_PROTECTED')

      expect(() => {
        service.deleteSource({ sourceId: 'system-deleted', itemPolicy: 'delete' })
      }).toThrow('SYSTEM_SOURCE_PROTECTED')

      expect(() => {
        service.setSourceEnabled({ sourceId: 'system-deleted', enabled: true })
      }).toThrow('SYSTEM_SOURCE_PROTECTED')

      expect(() => {
        service.getDeleteImpact({ sourceId: 'system-deleted' })
      }).toThrow('SYSTEM_SOURCE_PROTECTED')
    })
  })
})
