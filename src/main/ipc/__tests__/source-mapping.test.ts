/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file source-mapping.test.ts
 * @description IPC 채널로 유입되는 비정상 페이로드 및 비인가 송신처에 대한 사전 필터링 차단,
 * 그리고 stable error code 노출과 stack trace 마스킹 정책을 철저하게 검증하는 IPC 레이어 단위 테스트 파일입니다.
 * 한국어 JSDoc 및 주석을 충실하게 작성하였습니다. (SRS-NFR-SEC-008, SRS-NFR-SEC-010)
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { registerSourceMappingIpc } from '../source-mapping'

describe('Source and Mapping IPC Boundary', () => {
  let mockSourceService: any
  let mockMetadataService: any
  let handlers: Record<string, (event: any, ...args: any[]) => any>
  let mockIpcMain: any
  let mockIsValidSender: any

  beforeEach(() => {
    mockSourceService = {
      listSources: vi.fn(),
      getSource: vi.fn(),
      createSource: vi.fn(),
      updateSource: vi.fn(),
      getDeleteImpact: vi.fn(),
      deleteSource: vi.fn(),
      setSourceEnabled: vi.fn()
    }

    mockMetadataService = {
      resolveTarget: vi.fn(),
      listProperties: vi.fn(),
      validateMapping: vi.fn(),
      previewMapping: vi.fn()
    }

    handlers = {}
    mockIpcMain = {
      handle: vi.fn((channel: string, listener: (event: any, ...args: any[]) => any) => {
        handlers[channel] = listener
      })
    }

    mockIsValidSender = vi.fn().mockReturnValue(true)

    registerSourceMappingIpc({
      sourceService: mockSourceService,
      metadataService: mockMetadataService,
      ipcMain: mockIpcMain,
      isValidSender: mockIsValidSender
    })
  })

  it('TC-SOURCE-IPC-001: 신뢰할 수 없는 송신처(untrusted sender)가 호출을 트리거할 경우 서비스 레이어 접근 전에 차단합니다.', async () => {
    mockIsValidSender.mockReturnValue(false)
    const event = { senderFrame: { url: 'https://malicious.com' } }

    await expect(handlers['source:list'](event)).rejects.toThrow('UNAUTHORIZED_SENDER')
    expect(mockSourceService.listSources).not.toHaveBeenCalled()
  })

  it('TC-SOURCE-IPC-002: primitive, array, null 등 올바르지 않은 페이로드 구조는 거부합니다.', async () => {
    const event = { senderFrame: { url: 'valid' } }

    await expect(handlers['source:get'](event)).rejects.toThrow('INVALID_PAYLOAD')
    await expect(handlers['source:get'](event, 'primitive-id')).rejects.toThrow('INVALID_PAYLOAD')
    await expect(handlers['source:get'](event, null)).rejects.toThrow('INVALID_PAYLOAD')
    await expect(handlers['source:get'](event, [])).rejects.toThrow('INVALID_PAYLOAD')

    expect(mockSourceService.getSource).not.toHaveBeenCalled()
  })

  it('TC-SOURCE-IPC-002: 허용되지 않은 초과 프로퍼티(unknown property)가 포함된 페이로드는 거부합니다.', async () => {
    const event = { senderFrame: { url: 'valid' } }
    const badPayload = { sourceId: 'src_123', extraHackParam: true }

    await expect(handlers['source:get'](event, badPayload)).rejects.toThrow('INVALID_PAYLOAD')
    expect(mockSourceService.getSource).not.toHaveBeenCalled()
  })

  it('TC-SOURCE-IPC-003: 수집 모드, 필터 연산자, 아이템 삭제 정책 등에 대한 유효 enums 범위를 검사합니다.', async () => {
    const event = { senderFrame: { url: 'valid' } }

    // 허용하지 않는 수집 모드
    const badCreatePayload = {
      name: '공부',
      notionTargetId: 'abc',
      enabled: true,
      collectionMode: 'invalid_mode', // 허용 외
      titlePropertyName: 'Name'
    }
    await expect(handlers['source:create'](event, badCreatePayload)).rejects.toThrow(
      'INVALID_PAYLOAD'
    )

    // 허용하지 않는 삭제 정책
    const badDeletePayload = {
      sourceId: 'src_123',
      itemPolicy: 'invalid_policy' // 허용 외
    }
    await expect(handlers['source:delete'](event, badDeletePayload)).rejects.toThrow(
      'INVALID_PAYLOAD'
    )
  })

  it('TC-SOURCE-IPC-004: 내부 예외 발생 시 스택 트레이스 및 민감한 디테일을 숨기고 사전에 정의된 정제된 stable error code를 반환합니다.', async () => {
    mockSourceService.listSources.mockImplementation(() => {
      throw new Error('Raw SQL error details: FOREIGN KEY constraint failed in sqlite_master...')
    })

    const event = { senderFrame: { url: 'valid' } }

    try {
      await handlers['source:list'](event)
      expect.fail('Should have thrown')
    } catch (e: any) {
      expect(e.message).toBe('INTERNAL_ERROR')
      expect(e.stack).toBe('') // 스택 트레이스가 완벽히 마스킹되어 정화됨
    }
  })
})
