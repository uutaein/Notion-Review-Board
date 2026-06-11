/**
 * @file notion-connection.ts
 * @description Electron 메인 프로세스 내부에서 Notion 연결과 관련된 IPC 이벤트를 안전하게 처리하고
 * 외부 렌더러 프로세스로부터의 비정상적인 호출(타임 피싱, 잘못된 페이로드 요청 등)을 예방 및 차단하는 방어막 레이어입니다.
 * (SRS-NFR-SEC-008, SRS-NFR-SEC-010)
 */

import { NotionConnectionService } from '../services/notion/connection'

/**
 * IPC 채널 등록 시 주입받아야 하는 의존성 스펙입니다.
 */
export interface IpcRegistrationDependencies {
  /** 실제 비즈니스 로직 연산을 대행하는 Notion 연결 설정 서비스 */
  service: NotionConnectionService
  /** Electron의 ipcMain 객체 또는 이를 가상 대행하는 핸들러 레지스트리 */
  ipcMain: {
    handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void
  }
  /** IPC를 트리거한 렌더러 송신처(Sender) 프레임의 권한 및 신뢰성을 체크하는 검증 유틸리티 함수 */
  isValidSender: (event: unknown) => boolean
}

/**
 * 비정상적이거나 예외가 발생한 모든 IPC 호출 오류를 표준화된 에러 응답형식으로 포장하고 내부 디버그 스택 트레이스를 정제합니다.
 *
 * @param err - 원시 오류 객체
 * @returns 디버그 스택이 제거되고 사전에 약속된 문자열 에러 코드를 제공하는 에러 인스턴스
 */
function sanitizeIpcError(err: unknown): Error {
  const publicCodes = [
    'UNAUTHORIZED_SENDER',
    'INVALID_PAYLOAD',
    'MISSING_TOKEN',
    'DECRYPTION_ERROR',
    'PERSISTENCE_ERROR',
    'OS_ENCRYPTION_UNAVAILABLE',
    'DISALLOWED_ENCRYPTION_BACKEND'
  ]

  const originalMessage = err instanceof Error ? err.message : ''
  // 예외 메시지가 사전에 승인된 보안 안전한 공개 오류 코드 목록에 들어 있는지 대조합니다.
  const cleanMessage = publicCodes.includes(originalMessage) ? originalMessage : 'INTERNAL_ERROR'

  const cleanError = new Error(cleanMessage)
  // 클라이언트에 백엔드의 예민한 경로 및 스택 트레이스가 누출되지 않도록 강제적으로 제거합니다. (TC-NOTION-CONN-025)
  cleanError.stack = ''
  return cleanError
}

/**
 * Notion 연결 관련 IPC 핸들러들을 등록합니다.
 * 모든 핸들러는 호출 직후 송신처(Sender) 신뢰성 여부를 검사하고 페이로드 엄격 유효성 규칙을 검사합니다.
 *
 * @param dependencies - 의존성 주입 규격
 */
export function registerNotionConnectionIpc(dependencies: IpcRegistrationDependencies): void {
  const { service, ipcMain, isValidSender } = dependencies

  /**
   * 유효성 검증 데코레이터를 적용한 공용 보안 래퍼 헬퍼 함수입니다.
   * 송신처 권한을 먼저 판단하고 서비스 내부 연산을 구동하여 발생한 예외 스택들을 안전하게 마스킹 처리합니다.
   *
   * @param handler - 실제 작동할 세부 채널 핸들러 함수
   */
  function secureHandle(
    handler: (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown
  ) {
    return async (event: unknown, ...args: unknown[]) => {
      try {
        // 송신처가 신뢰할 수 있는지 먼저 엄격히 판단하여 차단합니다. (TC-NOTION-CONN-019 / SRS-NFR-SEC-008)
        if (!isValidSender(event)) {
          throw new Error('UNAUTHORIZED_SENDER')
        }
        return await handler(event, ...args)
      } catch (err) {
        throw sanitizeIpcError(err)
      }
    }
  }

  // 1. 현재의 연동/인증 상태 조회 채널 등록
  ipcMain.handle(
    'notion:get-status',
    secureHandle((_event, ...args) => {
      // 전달될 필요가 없는 불필요한 보조 인자가 포함된 비정상적인 호출 요청은 선제적으로 거부합니다. (TC-NOTION-CONN-023)
      if (args.length !== 0) {
        throw new Error('INVALID_PAYLOAD')
      }
      return service.getStatus()
    })
  )

  // 2. 신규 Notion 토큰 설정 저장 채널 등록
  ipcMain.handle(
    'notion:save-token',
    secureHandle((_event, ...args) => {
      // 인자 리스트 개수가 정확히 1개(save payload 개체)인지 점검합니다.
      if (args.length !== 1) {
        throw new Error('INVALID_PAYLOAD')
      }

      const payload = args[0]

      // 페이로드가 누락되었거나, null이거나, 배열이거나, 기본 원시값 형태라면 비정상 객체이므로 요청을 거부합니다. (TC-NOTION-CONN-020)
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('INVALID_PAYLOAD')
      }

      // 허용되지 않은 예상 밖의 초과 프로퍼티 속성이 payload 안에 주입되어 있는지 감시합니다. (TC-NOTION-CONN-022)
      const keys = Object.keys(payload)
      if (keys.length !== 1 || keys[0] !== 'token') {
        throw new Error('INVALID_PAYLOAD')
      }

      const token = (payload as { token: unknown }).token

      // 전달받은 토큰값이 문자열이 아니거나, 공백 또는 비어있거나, 비정상적으로 크기가 너무 큰(2048글자 초과) 경우 검증 탈락시킵니다. (TC-NOTION-CONN-021)
      if (typeof token !== 'string' || token.trim() === '' || token.length > 2048) {
        throw new Error('INVALID_PAYLOAD')
      }

      return service.saveToken({ token })
    })
  )

  // 3. 기존 Notion 토큰 정보 해제/삭제 채널 등록
  ipcMain.handle(
    'notion:delete-token',
    secureHandle((_event, ...args) => {
      if (args.length !== 0) {
        throw new Error('INVALID_PAYLOAD')
      }
      return service.deleteToken()
    })
  )

  // 4. Notion 공식 원격 서버 연동 상태 인증성 검증 채널 등록
  ipcMain.handle(
    'notion:verify',
    secureHandle(async (_event, ...args) => {
      if (args.length !== 0) {
        throw new Error('INVALID_PAYLOAD')
      }
      return await service.verifyConnection()
    })
  )
}
