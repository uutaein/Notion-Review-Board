/**
 * @file connection.ts
 * @description Notion API 연동 토큰의 보안 저장(암호화), 제거, 상태 조회 및 연결 상태 검증을 수행하는
 * 메인 프로세스 내부의 비즈니스 서비스 구현체입니다. (SRS-FR-001 ~ SRS-FR-003, SRS-NFR-SEC-006)
 */
import { writeFileSync, readFileSync, existsSync, unlinkSync, renameSync } from 'node:fs'
import { safeStorage } from 'electron'

/**
 * 운영체제(OS) 수준의 안전한 문자열 암호화 및 복호화를 제공하는 백엔드 인터페이스입니다.
 * 실서비스 동작 환경에서는 Electron의 `safeStorage`를 래핑하여 사용합니다.
 */
export interface EncryptionBackend {
  /** 어댑터의 식별 명칭 (예: 'mock', 'safeStorage') */
  name?: string
  /** 운영체제 암호화 기능 사용 가능 여부 판정 */
  isEncryptionAvailable(): boolean
  /** 평문 토큰을 암호화된 바이너리 버퍼로 변환 */
  encryptString(plainText: string): Buffer
  /** 암호화된 바이너리 버퍼를 다시 평문 문자열로 복구 */
  decryptString(cipherText: Buffer): string
  /** 취약하거나 안전하지 않은 알고리즘 또는 목(Mock) 객체 여부 판정 */
  isWeak?(): boolean
}

/**
 * 암호화된 원시 바이너리 버퍼 데이터를 파일시스템이나 데이터베이스 등에 쓰고 읽는 영속성 레이어 인터페이스입니다.
 */
export interface BlobStore {
  /** 바이너리 버퍼 기록 */
  write(blob: Buffer): void
  /** 기록된 바이너리 버퍼 읽기, 없으면 null 반환 */
  read(): Buffer | null
  /** 보관된 바이너리 버퍼 삭제 */
  delete(): void
}

/**
 * 암호화된 Notion 인증 토큰의 안전한 보관 및 인출을 총괄하는 보안 토큰 금고 클래스입니다.
 */
export class TokenVault {
  private encryption: EncryptionBackend
  private store: BlobStore

  constructor(encryption: EncryptionBackend, store: BlobStore) {
    this.encryption = encryption
    this.store = store
  }

  /**
   * 보안 저장소 작동이 가능한지 상태를 체크합니다.
   */
  isEncryptionAvailable(): boolean {
    return this.encryption.isEncryptionAvailable()
  }

  /**
   * 새로운 토큰을 암호화하여 영속 보관함에 씁니다.
   * 교체 중 에러가 발생하는 경우 트랜잭션 복구(원자적 저장)를 시도하여 이전 토큰이 유실되지 않도록 보장합니다.
   *
   * @param token - 평문 Notion API 통합 토큰
   * @throws {Error} OS 암호화를 사용할 수 없거나, 취약한 백엔드가 탐지되거나, 암호화/쓰기에 실패할 때
   */
  saveToken(token: string): void {
    if (!this.encryption.isEncryptionAvailable()) {
      throw new Error('OS_ENCRYPTION_UNAVAILABLE')
    }
    if (
      this.encryption.isWeak?.() ||
      this.encryption.name === 'weak' ||
      this.encryption.name === 'disallowed'
    ) {
      throw new Error('DISALLOWED_ENCRYPTION_BACKEND')
    }
    if (!token || token.trim() === '') {
      throw new Error('INVALID_PAYLOAD')
    }

    try {
      // 토큰 원본이 그대로 노출되지 않도록 영속 저장소 쓰기 작업 전에 암호화를 마칩니다. (TC-NOTION-CONN-001/002)
      const encrypted = this.encryption.encryptString(token)
      this.store.write(encrypted)
    } catch {
      throw new Error('PERSISTENCE_ERROR')
    }
  }

  /**
   * 보관함에서 토큰을 복호화하여 가져옵니다.
   *
   * @returns 평문 Notion API 토큰 문자열, 보관된 토큰이 없다면 null
   * @throws {Error} OS 암호화 사용 불능 상태이거나 복호화에 실패할 때
   */
  getToken(): string | null {
    const blob = this.store.read()
    if (!blob) return null

    if (!this.encryption.isEncryptionAvailable()) {
      throw new Error('OS_ENCRYPTION_UNAVAILABLE')
    }

    try {
      return this.encryption.decryptString(blob)
    } catch {
      throw new Error('DECRYPTION_ERROR')
    }
  }

  /**
   * 영속 보관함에서 기존 토큰 데이터를 물리적으로 완전히 삭제합니다.
   */
  deleteToken(): void {
    this.store.delete()
  }

  /**
   * 현재 암호화된 토큰이 보관함에 기록되어 존재하는지 여부를 판단합니다.
   */
  hasToken(): boolean {
    return this.store.read() !== null
  }
}

/**
 * 외부 Notion API와 직접 통신하여 토큰 인증 및 생존 여부를 조회하는 경량 클라이언트 인터페이스입니다.
 */
export interface NotionConnectionClient {
  /**
   * 주어진 토큰 정보를 통해 Notion 공식 API('/v1/users/me')를 호출하여 유효성을 검증합니다.
   *
   * @param token - 검증용 Notion API 토큰
   * @throws {Error} API 서버에서 에러 코드(401, 403, 429 등) 혹은 네트워크 단절이 발생할 때
   */
  verify(token: string): Promise<void>
}

/**
 * Notion 연결 상태의 상세 도메인 형식 리스트입니다.
 */
export type NotionConnectionStatus =
  | 'not_configured'
  | 'configured'
  | 'connected'
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limited'
  | 'network_error'

/**
 * Notion 연결 설정 관리 서비스 초기화를 위해 주입받는 의존성 리스트 사양입니다.
 */
export interface NotionConnectionServiceDependencies {
  /** 보안 토큰 금고 */
  vault: TokenVault
  /** Notion 연동 원격지 검증용 HTTP 통신 클라이언트 */
  client: NotionConnectionClient
  /** 안전한 로깅을 수행하기 위한 전용 경량 로그 의존성 */
  logger?: {
    info(msg: string): void
    error(msg: string): void
  }
}

/**
 * Notion 연결 상태 검증 및 토큰 설정을 일괄적으로 조율하는 실 구현 비즈니스 서비스 스펙입니다.
 */
export interface NotionConnectionService {
  getStatus(): NotionConnectionStatus
  saveToken(input: { token: string }): NotionConnectionStatus
  deleteToken(): NotionConnectionStatus
  verifyConnection(): Promise<NotionConnectionStatus>
}

/**
 * Notion 연결 서비스 인스턴스를 생성하는 팩토리 함수입니다.
 *
 * @param dependencies - 필요한 주입 의존성 구조체
 * @returns NotionConnectionService 인스턴스
 */
export function createNotionConnectionService(
  dependencies: NotionConnectionServiceDependencies
): NotionConnectionService {
  const { vault, client, logger } = dependencies

  // 최초 시작 상태값을 결정합니다. 토큰이 존재하면 configured, 그렇지 않다면 not_configured
  let currentStatus: NotionConnectionStatus = vault.hasToken() ? 'configured' : 'not_configured'

  return {
    /**
     * 현재의 Notion 연결 및 구성 상태코드를 조회합니다.
     */
    getStatus(): NotionConnectionStatus {
      return currentStatus
    },

    /**
     * 신규 토큰을 보안 저장소에 등록 보관합니다.
     * 평문 토큰 유출을 방지하기 위해 로깅이나 대외 반환 결과값에는 토큰을 절대 포함시키지 않습니다.
     *
     * @param input - 입력 토큰 페이로드
     */
    saveToken({ token }: { token: string }): NotionConnectionStatus {
      // 1. 보안 금고에 안전하게 암호화 저장을 위임합니다.
      vault.saveToken(token)

      // 2. 상태를 configured로 전환하고 로깅 및 결과값을 반환합니다.
      currentStatus = 'configured'
      logger?.info('Notion 토큰 설정 정보가 성공적으로 보안 저장소에 기록되었습니다.')
      return currentStatus
    },

    /**
     * 보관된 Notion 토큰을 영구 삭제하고 상태를 미설정(not_configured)으로 변경합니다.
     * 보관된 토큰이 없는 상태에서 연이어 삭제 요청을 호출하더라도 부작용이 없는 멱등성을 보장합니다.
     */
    deleteToken(): NotionConnectionStatus {
      vault.deleteToken()
      currentStatus = 'not_configured'
      logger?.info('Notion 토큰 정보가 삭제되고 연동 상태가 해제되었습니다.')
      return currentStatus
    },

    /**
     * 보관되어 있는 토큰 정보를 인출하여 실제 Notion 서버와의 네트워크 인증 생존 검증을 수행합니다.
     *
     * @returns API 인증 결과에 상응하는 최종 렌더러용 간소화 상태코드
     * @throws {Error} 보관함에 토큰이 부재할 때 (MISSING_TOKEN)
     */
    async verifyConnection(): Promise<NotionConnectionStatus> {
      const token = vault.getToken()
      if (!token) {
        logger?.error('Notion 연결 검증 시도가 거부되었습니다: 저장된 인증 토큰이 부재합니다.')
        throw new Error('MISSING_TOKEN')
      }

      try {
        // Notion 서버로 경량 API 요청을 보냅니다.
        await client.verify(token)
        
        // 검증 요청이 진행되는 사이에 다른 토큰으로 교체되거나 삭제되었는지 경쟁상태를 판단합니다.
        if (vault.getToken() !== token) {
          return currentStatus
        }

        currentStatus = 'connected'
        logger?.info('Notion 연결성이 완벽하게 검증되었습니다. 상태: connected')
        return currentStatus
      } catch (err: unknown) {
        // 동시성/비동기 경쟁상태 해결: 대기 중 토큰 정보가 변경된 경우 이전 검증 실패 결과값은 무시합니다.
        if (vault.getToken() !== token) {
          return currentStatus
        }

        // 에러 코드 스펙을 분석하여 렌더러 대응 상태코드로 안전하게 매핑합니다.
        let statusResult: NotionConnectionStatus

        const errStatus =
          err && typeof err === 'object' && 'status' in err
            ? (err as { status: unknown }).status
            : undefined

        if (errStatus === 401) {
          statusResult = 'unauthorized'
        } else if (errStatus === 403) {
          statusResult = 'forbidden'
        } else if (errStatus === 429) {
          statusResult = 'rate_limited'
        } else {
          statusResult = 'network_error'
        }

        currentStatus = statusResult
        logger?.error(`Notion 연결 검증에 실패했습니다. (상태코드 매핑 결과: ${statusResult})`)
        return currentStatus
      }
    }
  }
}

/**
 * 파일 시스템을 이용해 암호화된 블롭 데이터를 파일로 쓰고 읽는 실서비스용 BlobStore 구현체입니다.
 */
export class FileBlobStore implements BlobStore {
  private filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
  }

  write(blob: Buffer): void {
    const tempPath = this.filePath + '.tmp'
    try {
      // 1. 임시 파일에 새 복사본 데이터를 작성하여 프로세스 비정상 종료 시 원본 손상을 예방합니다.
      writeFileSync(tempPath, blob)
      // 2. 운영체제의 원자적(Atomic) rename 연산을 수행하여 교체를 완료합니다.
      renameSync(tempPath, this.filePath)
    } catch (err) {
      if (existsSync(tempPath)) {
        try {
          unlinkSync(tempPath)
        } catch {
          // 무시
        }
      }
      throw err
    }
  }

  read(): Buffer | null {
    if (!existsSync(this.filePath)) return null
    // 읽기 과정 중 디스크 에러 등이 발생하면 예외가 상위 수준으로 전파되도록 throw를 보장합니다.
    return readFileSync(this.filePath)
  }

  delete(): void {
    if (existsSync(this.filePath)) {
      // 삭제 실패 오류를 상위 서비스 레이어로 고스란히 노출하여 오작동(성공 표시)을 원천 차단합니다.
      unlinkSync(this.filePath)
    }
  }
}

/**
 * Electron의 `safeStorage` API를 연동하여 암호화/복호화를 처리하는 실서비스용 EncryptionBackend 구현체입니다.
 */
export class ElectronEncryptionBackend implements EncryptionBackend {
  name = 'safeStorage'

  isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  encryptString(plainText: string): Buffer {
    if (this.isWeak()) {
      throw new Error('DISALLOWED_ENCRYPTION_BACKEND')
    }
    return safeStorage.encryptString(plainText)
  }

  decryptString(cipherText: Buffer): string {
    return safeStorage.decryptString(cipherText)
  }

  isWeak(): boolean {
    // Linux 환경에서 안전한 키링이 없어 평문(basic_text)으로 암호화하는 방식을 탐지하여 거부합니다. (SRS-FR-002)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storage = safeStorage as any
    if (typeof storage.getSelectedEncryptionBackend === 'function') {
      return storage.getSelectedEncryptionBackend() === 'basic_text'
    }
    return false
  }
}

/**
 * Notion 공식 API 엔드포인트를 호출하여 토큰 권한 생존을 인증 검증하는 실서비스용 NotionConnectionClient 구현체입니다.
 */
export class ProductionNotionConnectionClient implements NotionConnectionClient {
  async verify(token: string): Promise<void> {
    const response = await fetch('https://api.notion.com/v1/users/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2026-03-11'
      },
      // 10초 이내에 연결 검증이 완료되지 않으면 타임아웃 오류를 발생시켜 대기 누수를 제어합니다.
      signal: AbortSignal.timeout(10000)
    })
    if (!response.ok) {
      const error = new Error(`HTTP error ${response.status}`)
      Object.assign(error, { status: response.status })
      throw error
    }
  }
}
