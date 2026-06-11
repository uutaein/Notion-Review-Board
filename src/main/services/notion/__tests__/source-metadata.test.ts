/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * @file source-metadata.test.ts
 * @description Notion 데이터베이스 메타데이터 조회, 속성 필드 매핑 검증, 예외 상황에 대한 에러 마스킹,
 * 그리고 매핑 프리뷰의 Fallback 동작을 철저히 검증하는 단위 테스트 파일입니다.
 * 한국어 JSDoc 및 주석을 충실하게 작성하였습니다. (SRS-FR-020 ~ SRS-FR-022, SRS-NFR-SEC-010)
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createNotionSourceMetadataService, NotionPropertyInfo } from '../source-metadata'
import { TokenVault } from '../connection'

describe('Notion Source Metadata Service', () => {
  let mockVault: any
  let mockResolver: any
  let mockClient: any
  let service: any

  beforeEach(() => {
    // 1. TokenVault 모킹
    mockVault = {
      getToken: vi.fn().mockReturnValue('mock-token-xyz')
    }

    // 2. NotionTargetResolver 모킹
    mockResolver = {
      resolve: vi.fn().mockImplementation(async (target: string) => {
        if (target.includes('ffffffffffffffffffffffffffffffff')) {
          throw { status: 404, message: 'Not found' }
        }
        if (target.includes('00000000000000000000000000000dbd')) {
          return { targetId: 'resolved-target-32', targetType: 'data_source' }
        }
        if (target.includes('00000000000000000000000000000db2')) {
          throw { status: 400, message: 'MULTIPLE_DATA_SOURCES_FOUND' }
        }
        return { targetId: target, targetType: 'data_source' }
      })
    }

    // 3. NotionMetadataClient 모킹
    mockClient = {
      listProperties: vi.fn().mockImplementation(async (targetId: string) => {
        if (targetId.includes('401')) {
          throw { status: 401, message: 'Unauthorized' }
        }
        if (targetId.includes('403')) {
          throw { status: 403, message: 'Forbidden' }
        }
        if (targetId.includes('429')) {
          throw { status: 429, message: 'Rate limited' }
        }
        if (targetId.includes('bee')) {
          throw new Error('Socket timeout')
        }

        // 기본 제공 속성 스키마
        return [
          { id: 't1', name: 'Name', type: 'title' },
          { id: 'u1', name: 'Link', type: 'url' },
          { id: 's1', name: 'Category', type: 'select' },
          { id: 'm1', name: 'Tags', type: 'multi_select' },
          { id: 'c1', name: 'IsReview', type: 'checkbox' },
          { id: 'd1', name: 'DueDate', type: 'date' },
          { id: 'le1', name: 'EditedTime', type: 'last_edited_time' }
        ] as NotionPropertyInfo[]
      }),

      fetchSamplePage: vi.fn().mockImplementation(async (targetId: string) => {
        if (targetId.includes('bad')) {
          return null // 데이터베이스에 아무 페이지도 없는 경우
        }

        // 기본 샘플 데이터 반환
        return {
          id: 'page-123',
          url: 'https://notion.so/page-123-canonical-url',
          last_edited_time: '2026-06-11T12:00:00Z',
          properties: {
            Name: { type: 'title', title: [{ plain_text: '테스트 복습 카드' }] },
            Link: { type: 'url', url: 'https://notion.so/custom-link' },
            Category: { type: 'select', select: { name: '컴퓨터 사이언스' } },
            Tags: { type: 'multi_select', multi_select: [{ name: 'OS' }, { name: 'CS' }] },
            IsReview: { type: 'checkbox', checkbox: true },
            DueDate: { type: 'date', date: { start: '2026-06-15T00:00:00Z' } },
            EditedTime: { type: 'last_edited_time', last_edited_time: '2026-06-11T12:00:00Z' }
          }
        }
      })
    }

    service = createNotionSourceMetadataService({
      resolver: mockResolver,
      client: mockClient
    })
  })

  describe('Notion 대상 URL/ID 식별 (resolveTarget)', () => {
    it('TC-MAPPING-006: Notion 토큰 검증 단계가 포함되며, 식별이 성공하면 정상적인 ID와 타입을 제공합니다.', async () => {
      const result = await service.resolveTarget({ target: 'a8aec8ae9b7e411cb3a8e9e1c1234567' })
      expect(result.targetId).toBe('a8aec8ae9b7e411cb3a8e9e1c1234567')
      expect(result.targetType).toBe('data_source')
    })

    it('Database ID가 입력되는 경우 data_source 타입의 타겟 정보로 해석됩니다.', async () => {
      const result = await service.resolveTarget({ target: '00000000000000000000000000000dbd' })
      expect(result.targetId).toBe('resolved-target-32')
      expect(result.targetType).toBe('data_source')
    })

    it('여러 개의 데이터 소스가 감지되면 MULTIPLE_DATA_SOURCES_FOUND 에러를 반환합니다.', async () => {
      await expect(
        service.resolveTarget({ target: '00000000000000000000000000000db2' })
      ).rejects.toThrow('MULTIPLE_DATA_SOURCES_FOUND')
    })
  })

  describe('에러 마스킹 규칙 (TC-MAPPING-007 / SEC-010)', () => {
    it('Notion API 401 에러는 UNAUTHORIZED 에러로 가공됩니다.', async () => {
      await expect(
        service.listProperties({ target: '00000000000000000000000000000401' })
      ).rejects.toThrow('UNAUTHORIZED')
    })

    it('Notion API 403 에러는 FORBIDDEN 에러로 가공됩니다.', async () => {
      await expect(
        service.listProperties({ target: '00000000000000000000000000000403' })
      ).rejects.toThrow('FORBIDDEN')
    })

    it('Notion API 429 에러는 RATE_LIMITED 에러로 가공됩니다.', async () => {
      await expect(
        service.listProperties({ target: '00000000000000000000000000000429' })
      ).rejects.toThrow('RATE_LIMITED')
    })

    it('네트워크 시간초과 및 일반 소켓 에러는 NETWORK_ERROR 에러로 가공됩니다.', async () => {
      await expect(
        service.listProperties({ target: '00000000000000000000000000000bee' })
      ).rejects.toThrow('NETWORK_ERROR')
    })
  })

  describe('속성 매핑 유효성 검사 (validateMapping)', () => {
    it('TC-MAPPING-008: Notion 스키마에 존재하지 않는 필드를 매핑하려 할 경우 오류가 감지됩니다.', async () => {
      const result = await service.validateMapping({
        target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
        collectionMode: 'all',
        titlePropertyName: 'NonExistentTitle'
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some((e: string) => e.includes('does not exist'))).toBe(true)
    })

    it('TC-MAPPING-009: Title 매핑 프로퍼티 타입이 title이 아닌 경우 거부합니다.', async () => {
      const result = await service.validateMapping({
        target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
        collectionMode: 'all',
        titlePropertyName: 'Link' // url type
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some((e: string) => e.includes("must be of type 'title'"))).toBe(true)
    })

    it('TC-MAPPING-010: URL 매핑 프로퍼티 타입이 url이 아닌 경우 거부합니다.', async () => {
      const result = await service.validateMapping({
        target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
        collectionMode: 'all',
        titlePropertyName: 'Name',
        urlPropertyName: 'Category' // select type
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some((e: string) => e.includes("must be of type 'url'"))).toBe(true)
    })

    it('TC-MAPPING-011: Checkbox 수집 모드 지정 시 매핑 체크박스가 checkbox 타입이 아닐 경우 거부합니다.', async () => {
      const result = await service.validateMapping({
        target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
        collectionMode: 'checkbox',
        titlePropertyName: 'Name',
        reviewCheckboxPropertyName: 'Tags' // multi_select type
      })

      expect(result.valid).toBe(false)
      expect(result.errors.some((e: string) => e.includes("must be of type 'checkbox'"))).toBe(true)
    })

    it('TC-MAPPING-012: tag 수집 모드의 필터 연산자가 속성 타입과 일치하지 않는 경우 거부합니다.', async () => {
      const result = await service.validateMapping({
        target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
        collectionMode: 'tag',
        titlePropertyName: 'Name',
        filterPropertyName: 'Category', // select
        filterOperator: 'contains' // contains 연산자는 select 타입에 호환되지 않음
      })

      expect(result.valid).toBe(false)
      expect(
        result.errors.some((e: string) => e.includes("Operator 'contains' is incompatible"))
      ).toBe(true)
    })
  })

  describe('매핑 데이터 프리뷰 (previewMapping)', () => {
    it('TC-MAPPING-013: 정상 매핑 설정 시 샘플 1개 로드에 기초한 매핑 필드 파싱 결과를 제공합니다.', async () => {
      const result = await service.previewMapping({
        target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
        titlePropertyName: 'Name',
        urlPropertyName: 'Link',
        categoryPropertyName: 'Category',
        tagPropertyName: 'Tags',
        reviewCheckboxPropertyName: 'IsReview',
        lastEditedPropertyName: 'EditedTime'
      })

      expect(result.hasSample).toBe(true)
      expect(result.title).toBe('테스트 복습 카드')
      expect(result.url).toBe('https://notion.so/custom-link')
      expect(result.category).toBe('컴퓨터 사이언스')
      expect(result.tags).toEqual(['OS', 'CS'])
      expect(result.reviewCheckbox).toBe(true)
      expect(result.lastEditedAt).toBe('2026-06-11T12:00:00Z')
    })

    it('TC-MAPPING-014: 대상 데이터베이스가 비어있을 경우 sample 없음 상태를 올바르게 명시합니다.', async () => {
      const result = await service.previewMapping({
        target: '00000000000000000000000000000bad',
        titlePropertyName: 'Name'
      })

      expect(result.hasSample).toBe(false)
      expect(result.title).toBeNull()
      expect(result.url).toBeNull()
      expect(result.category).toBeNull()
      expect(result.tags).toEqual([])
    })

    it('TC-MAPPING-002: 선택한 URL 매핑이 비어있거나 누락되었을 시 Notion page 고유 URL을 대체(Fallback)로 할당합니다.', async () => {
      const result = await service.previewMapping({
        target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
        titlePropertyName: 'Name',
        urlPropertyName: '' // 누락
      })

      expect(result.url).toBe('https://notion.so/page-123-canonical-url')
    })

    it("TC-MAPPING-003: 분류 및 태그 매핑 누락 시 각각 문자열 및 리스트 형태의 '미분류' 로 강제 대체합니다.", async () => {
      const result = await service.previewMapping({
        target: 'a8aec8ae9b7e411cb3a8e9e1c1234567',
        titlePropertyName: 'Name',
        categoryPropertyName: '', // 누락
        tagPropertyName: '' // 누락
      })

      expect(result.category).toBe('미분류')
      expect(result.tags).toEqual(['미분류'])
    })

    it('Database ID를 입력으로 전달할 경우, target을 올바르게 resolve하여 속성 조회가 정상 동작합니다.', async () => {
      const properties = await service.listProperties({
        target: '00000000000000000000000000000dbd'
      })
      expect(properties).toBeDefined()
      expect(properties.length).toBeGreaterThan(0)
      expect(properties[0].name).toBe('Name')
    })

    it('Database ID를 입력으로 전달할 경우, target을 올바르게 resolve하여 매핑 프리뷰가 정상 동작합니다.', async () => {
      const result = await service.previewMapping({
        target: '00000000000000000000000000000dbd',
        titlePropertyName: 'Name'
      })
      expect(result.hasSample).toBe(true)
      expect(result.title).toBe('테스트 복습 카드')
    })
  })
})
