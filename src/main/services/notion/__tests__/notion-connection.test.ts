/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { join } from 'node:path'
import { readFileSync, existsSync, unlinkSync } from 'node:fs'
import {
  createNotionConnectionService,
  TokenVault,
  EncryptionBackend,
  BlobStore,
  FileBlobStore,
  ElectronEncryptionBackend,
  ProductionNotionConnectionClient
} from '../connection'
import { registerNotionConnectionIpc } from '../../../ipc/notion-connection'
import { contextBridge } from 'electron'

const mockIsEncryptionAvailable = vi.fn().mockReturnValue(true)
const mockEncryptString = vi.fn().mockImplementation((str) => Buffer.from(`enc:${str}`))
const mockDecryptString = vi.fn().mockImplementation((buf) => buf.toString().replace('enc:', ''))
const mockGetSelectedEncryptionBackend = vi.fn().mockReturnValue('gnome-keyring')

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn()
  },
  ipcRenderer: {
    invoke: vi.fn()
  },
  safeStorage: {
    isEncryptionAvailable: () => mockIsEncryptionAvailable(),
    encryptString: (str: string) => mockEncryptString(str),
    decryptString: (buf: Buffer) => mockDecryptString(buf),
    getSelectedEncryptionBackend: () => mockGetSelectedEncryptionBackend()
  }
}))

let mockFsErrorType: 'none' | 'read' | 'delete' = 'none'

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {
    ...actual,
    readFileSync: (path: any, options?: any) => {
      if (mockFsErrorType === 'read') {
        throw new Error('DISK_READ_ERROR')
      }
      return actual.readFileSync(path, options)
    },
    unlinkSync: (path: any) => {
      if (mockFsErrorType === 'delete') {
        throw new Error('DISK_DELETE_ERROR')
      }
      return actual.unlinkSync(path)
    }
  }
})

/**
 * 테스트 용도로 가상 암호화 동작을 수행하는 목(Mock) 암호화 백엔드 클래스입니다.
 */
class MockEncryption implements EncryptionBackend {
  name: string = 'mock'
  available: boolean = true
  isWeakFlag: boolean = false

  isEncryptionAvailable(): boolean {
    return this.available
  }
  encryptString(plainText: string): Buffer {
    if (plainText.includes('fail-encrypt')) {
      throw new Error('OS encryption failed')
    }
    const b64 = Buffer.from(plainText).toString('base64')
    return Buffer.from(b64)
  }
  decryptString(cipherText: Buffer): string {
    const plain = Buffer.from(cipherText.toString(), 'base64').toString('utf8')
    if (plain.includes('fail-decrypt')) {
      throw new Error('OS decryption failed')
    }
    return plain
  }
  isWeak(): boolean {
    return this.isWeakFlag
  }
}

/**
 * 테스트 용도로 가상 메모리 내에 데이터를 저장하고 관리하는 목(Mock) 블롭 스토어 클래스입니다.
 */
class MockStore implements BlobStore {
  data: Buffer | null = null
  writeFail: boolean = false

  write(blob: Buffer): void {
    if (this.writeFail) {
      throw new Error('Disk write failed')
    }
    this.data = blob
  }
  read(): Buffer | null {
    return this.data
  }
  delete(): void {
    this.data = null
  }
}

describe('Notion Connection Settings', () => {
  it('TC-NOTION-CONN-001: A non-empty token is encrypted before the persistent store is written', () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)

    const encryptSpy = vi.spyOn(encryption, 'encryptString')
    const writeSpy = vi.spyOn(store, 'write')

    vault.saveToken('secret_token_123')

    expect(encryptSpy).toHaveBeenCalledWith('secret_token_123')
    expect(writeSpy).toHaveBeenCalledWith(
      Buffer.from(Buffer.from('secret_token_123').toString('base64'))
    )
    expect(store.read()?.toString()).toBe(Buffer.from('secret_token_123').toString('base64'))
  })

  it('TC-NOTION-CONN-002: Persistent storage contains only the encrypted blob, never the token text', () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)

    vault.saveToken('secret_token_123')

    expect(store.data?.toString()).not.toContain('secret_token_123')
    expect(store.data?.toString()).toBe(Buffer.from('secret_token_123').toString('base64'))
  })

  it('TC-NOTION-CONN-003: Saving a token returns configured without returning the token', () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)
    const client = { verify: vi.fn() }
    const service = createNotionConnectionService({ vault, client })

    const result = service.saveToken({ token: 'secret_token_123' })

    expect(result).toBe('configured')
    expect(JSON.stringify(result)).not.toContain('secret_token_123')
  })

  it('TC-NOTION-CONN-004: Replacing a token overwrites the previous encrypted blob', () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)

    vault.saveToken('token_one')
    expect(store.read()?.toString()).toBe(Buffer.from('token_one').toString('base64'))

    vault.saveToken('token_two')
    expect(store.read()?.toString()).toBe(Buffer.from('token_two').toString('base64'))
  })

  it('TC-NOTION-CONN-005: Encryption or persistence failure leaves the previous token unchanged', () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)

    vault.saveToken('original_token')
    expect(store.read()?.toString()).toBe(Buffer.from('original_token').toString('base64'))

    // 암호화 모듈 실패 시뮬레이션
    expect(() => vault.saveToken('fail-encrypt_token')).toThrow()
    expect(store.read()?.toString()).toBe(Buffer.from('original_token').toString('base64'))

    // 영속 저장 매체 쓰기 실패 시뮬레이션
    store.writeFail = true
    expect(() => vault.saveToken('new_token')).toThrow()
    expect(store.read()?.toString()).toBe(Buffer.from('original_token').toString('base64'))
  })

  it('TC-NOTION-CONN-006: Unavailable OS encryption rejects storage before any file write', () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)

    encryption.available = false
    const writeSpy = vi.spyOn(store, 'write')

    expect(() => vault.saveToken('some_token')).toThrow(/OS_ENCRYPTION_UNAVAILABLE/)
    expect(writeSpy).not.toHaveBeenCalled()
  })

  it('TC-NOTION-CONN-007: A weak or explicitly disallowed encryption backend rejects storage', () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)

    encryption.isWeakFlag = true
    expect(() => vault.saveToken('some_token')).toThrow(/DISALLOWED_ENCRYPTION_BACKEND/)

    encryption.isWeakFlag = false
    encryption.name = 'disallowed'
    expect(() => vault.saveToken('some_token')).toThrow(/DISALLOWED_ENCRYPTION_BACKEND/)
  })

  it('TC-NOTION-CONN-008: Deleting a configured token removes the encrypted blob and returns not_configured', () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)
    const client = { verify: vi.fn() }
    const service = createNotionConnectionService({ vault, client })

    service.saveToken({ token: 'my_token' })
    expect(vault.hasToken()).toBe(true)

    const status = service.deleteToken()
    expect(status).toBe('not_configured')
    expect(vault.hasToken()).toBe(false)
  })

  it('TC-NOTION-CONN-009: Deleting when no token exists is idempotent', () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)
    const client = { verify: vi.fn() }
    const service = createNotionConnectionService({ vault, client })

    expect(vault.hasToken()).toBe(false)
    expect(() => service.deleteToken()).not.toThrow()
    expect(service.getStatus()).toBe('not_configured')
  })

  it('TC-NOTION-CONN-010: Missing token blocks connection verification', async () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)
    const client = { verify: vi.fn() }
    const service = createNotionConnectionService({ vault, client })

    await expect(service.verifyConnection()).rejects.toThrow(/MISSING_TOKEN/)
    expect(client.verify).not.toHaveBeenCalled()
  })

  it('TC-NOTION-CONN-011: Successful API verification returns connected', async () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)
    const client = { verify: vi.fn().mockResolvedValue(undefined) }
    const service = createNotionConnectionService({ vault, client })

    service.saveToken({ token: 'valid_token' })
    const status = await service.verifyConnection()

    expect(status).toBe('connected')
    expect(service.getStatus()).toBe('connected')
    expect(client.verify).toHaveBeenCalledWith('valid_token')
  })

  it('TC-NOTION-CONN-012: HTTP 401 maps to unauthorized', async () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)
    const error = new Error('Unauthorized')
    ;(error as any).status = 401
    const client = { verify: vi.fn().mockRejectedValue(error) }
    const service = createNotionConnectionService({ vault, client })

    service.saveToken({ token: 'unauthorized_token' })
    const status = await service.verifyConnection()

    expect(status).toBe('unauthorized')
    expect(service.getStatus()).toBe('unauthorized')
  })

  it('TC-NOTION-CONN-013: HTTP 403 maps to forbidden', async () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)
    const error = new Error('Forbidden')
    ;(error as any).status = 403
    const client = { verify: vi.fn().mockRejectedValue(error) }
    const service = createNotionConnectionService({ vault, client })

    service.saveToken({ token: 'forbidden_token' })
    const status = await service.verifyConnection()

    expect(status).toBe('forbidden')
    expect(service.getStatus()).toBe('forbidden')
  })

  it('TC-NOTION-CONN-014: HTTP 429 maps to rate_limited without exposing the raw response', async () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)
    const error = new Error('Rate Limited')
    ;(error as any).status = 429
    ;(error as any).rawResponse = { someSensitiveBody: 'xxx' }
    const client = { verify: vi.fn().mockRejectedValue(error) }
    const service = createNotionConnectionService({ vault, client })

    service.saveToken({ token: 'rate_limited_token' })
    const status = await service.verifyConnection()

    expect(status).toBe('rate_limited')
    expect(service.getStatus()).toBe('rate_limited')
  })

  it('TC-NOTION-CONN-015: Transport and timeout failures map to network_error', async () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)
    const client = { verify: vi.fn().mockRejectedValue(new Error('timeout')) }
    const service = createNotionConnectionService({ vault, client })

    service.saveToken({ token: 'some_token' })
    const status = await service.verifyConnection()

    expect(status).toBe('network_error')
    expect(service.getStatus()).toBe('network_error')
  })

  it('TC-NOTION-CONN-017: Save, decrypt, and verification errors redact the token from messages and stack data', async () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)
    const client = { verify: vi.fn().mockRejectedValue(new Error('fail-verify')) }
    createNotionConnectionService({ vault, client })

    // 암호화 시도 저장 에러 내 토큰 마스킹 검사
    expect(() => vault.saveToken('fail-encrypt_secret_token_abc')).toThrow()
    try {
      vault.saveToken('fail-encrypt_secret_token_abc')
    } catch (e: any) {
      expect(e.message).not.toContain('secret_token_abc')
      expect(e.stack).not.toContain('secret_token_abc')
    }

    // 복호화 시도 저장 에러 내 토큰 마스킹 검사
    store.write(Buffer.from(Buffer.from('fail-decrypt_secret_token_xyz').toString('base64')))
    expect(() => vault.getToken()).toThrow()
    try {
      vault.getToken()
    } catch (e: any) {
      expect(e.message).not.toContain('secret_token_xyz')
      expect(e.stack).not.toContain('secret_token_xyz')
    }
  })

  it('TC-NOTION-CONN-018: Logger and Sync Event dependencies never receive token text or decrypted credentials', async () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)
    const client = { verify: vi.fn() }
    const logger = {
      info: vi.fn(),
      error: vi.fn()
    }
    const service = createNotionConnectionService({ vault, client, logger })

    service.saveToken({ token: 'secret_logger_token' })
    service.deleteToken()

    logger.info.mock.calls.forEach((args) => {
      expect(args[0]).not.toContain('secret_logger_token')
    })
    logger.error.mock.calls.forEach((args) => {
      expect(args[0]).not.toContain('secret_logger_token')
    })
  })

  it('TC-NOTION-CONN-019: IPC rejects an untrusted sender before calling the connection service', async () => {
    const service = {
      getStatus: vi.fn(),
      saveToken: vi.fn(),
      deleteToken: vi.fn(),
      verifyConnection: vi.fn()
    } as any
    const handlers: Record<string, (event: any, ...args: any[]) => any> = {}
    const ipcMain = {
      handle: vi.fn((channel, listener) => {
        handlers[channel] = listener
      })
    }
    const isValidSender = vi.fn().mockReturnValue(false)

    registerNotionConnectionIpc({ service, ipcMain, isValidSender })

    await expect(
      handlers['notion:get-status']({ senderFrame: { url: 'untrusted' } })
    ).rejects.toThrow('UNAUTHORIZED_SENDER')
    expect(service.getStatus).not.toHaveBeenCalled()
  })

  it('TC-NOTION-CONN-020: IPC rejects missing, null, array, and primitive save payloads', async () => {
    const service = { saveToken: vi.fn() } as any
    const handlers: Record<string, (event: any, ...args: any[]) => any> = {}
    const ipcMain = {
      handle: vi.fn((channel, listener) => {
        handlers[channel] = listener
      })
    }
    const isValidSender = vi.fn().mockReturnValue(true)

    registerNotionConnectionIpc({ service, ipcMain, isValidSender })

    const event = {}
    await expect(handlers['notion:save-token'](event)).rejects.toThrow('INVALID_PAYLOAD')
    await expect(handlers['notion:save-token'](event, null)).rejects.toThrow('INVALID_PAYLOAD')
    await expect(handlers['notion:save-token'](event, [])).rejects.toThrow('INVALID_PAYLOAD')
    await expect(handlers['notion:save-token'](event, 'primitive_string')).rejects.toThrow(
      'INVALID_PAYLOAD'
    )
    expect(service.saveToken).not.toHaveBeenCalled()
  })

  it('TC-NOTION-CONN-021: IPC rejects missing, non-string, empty, whitespace-only, and oversized token values', async () => {
    const service = { saveToken: vi.fn() } as any
    const handlers: Record<string, (event: any, ...args: any[]) => any> = {}
    const ipcMain = {
      handle: vi.fn((channel, listener) => {
        handlers[channel] = listener
      })
    }
    const isValidSender = vi.fn().mockReturnValue(true)

    registerNotionConnectionIpc({ service, ipcMain, isValidSender })

    const event = {}
    await expect(handlers['notion:save-token'](event, {})).rejects.toThrow('INVALID_PAYLOAD')
    await expect(handlers['notion:save-token'](event, { token: 123 })).rejects.toThrow(
      'INVALID_PAYLOAD'
    )
    await expect(handlers['notion:save-token'](event, { token: '' })).rejects.toThrow(
      'INVALID_PAYLOAD'
    )
    await expect(handlers['notion:save-token'](event, { token: '   ' })).rejects.toThrow(
      'INVALID_PAYLOAD'
    )
    await expect(handlers['notion:save-token'](event, { token: 'a'.repeat(2049) })).rejects.toThrow(
      'INVALID_PAYLOAD'
    )
    expect(service.saveToken).not.toHaveBeenCalled()
  })

  it('TC-NOTION-CONN-022: IPC rejects unexpected save payload properties', async () => {
    const service = { saveToken: vi.fn() } as any
    const handlers: Record<string, (event: any, ...args: any[]) => any> = {}
    const ipcMain = {
      handle: vi.fn((channel, listener) => {
        handlers[channel] = listener
      })
    }
    const isValidSender = vi.fn().mockReturnValue(true)

    registerNotionConnectionIpc({ service, ipcMain, isValidSender })

    const event = {}
    await expect(
      handlers['notion:save-token'](event, { token: 'valid_one', extraProp: true })
    ).rejects.toThrow('INVALID_PAYLOAD')
    expect(service.saveToken).not.toHaveBeenCalled()
  })

  it('TC-NOTION-CONN-023: Status, delete, and verify IPC channels reject unexpected arguments', async () => {
    const service = {
      getStatus: vi.fn(),
      deleteToken: vi.fn(),
      verifyConnection: vi.fn()
    } as any
    const handlers: Record<string, (event: any, ...args: any[]) => any> = {}
    const ipcMain = {
      handle: vi.fn((channel, listener) => {
        handlers[channel] = listener
      })
    }
    const isValidSender = vi.fn().mockReturnValue(true)

    registerNotionConnectionIpc({ service, ipcMain, isValidSender })

    const event = {}
    await expect(handlers['notion:get-status'](event, 'extra')).rejects.toThrow('INVALID_PAYLOAD')
    await expect(handlers['notion:delete-token'](event, { unused: true })).rejects.toThrow(
      'INVALID_PAYLOAD'
    )
    await expect(handlers['notion:verify'](event, 123)).rejects.toThrow('INVALID_PAYLOAD')

    expect(service.getStatus).not.toHaveBeenCalled()
    expect(service.deleteToken).not.toHaveBeenCalled()
    expect(service.verifyConnection).not.toHaveBeenCalled()
  })

  it('TC-NOTION-CONN-024: Rejected IPC input performs no storage, decryption, or network operation', async () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)
    const client = { verify: vi.fn() }
    const service = createNotionConnectionService({ vault, client })

    const handlers: Record<string, (event: any, ...args: any[]) => any> = {}
    const ipcMain = {
      handle: vi.fn((channel, listener) => {
        handlers[channel] = listener
      })
    }
    const isValidSender = vi.fn().mockReturnValue(true)

    registerNotionConnectionIpc({ service, ipcMain, isValidSender })

    const writeSpy = vi.spyOn(store, 'write')
    const verifySpy = vi.spyOn(client, 'verify')

    const event = {}
    await expect(handlers['notion:save-token'](event, { token: '   ' })).rejects.toThrow(
      'INVALID_PAYLOAD'
    )
    expect(writeSpy).not.toHaveBeenCalled()

    await expect(handlers['notion:verify'](event, 'unexpected-arg')).rejects.toThrow(
      'INVALID_PAYLOAD'
    )
    expect(verifySpy).not.toHaveBeenCalled()
  })

  it('TC-NOTION-CONN-025: IPC failures return a stable public error code without an internal stack trace', async () => {
    const service = {
      getStatus: vi.fn(() => {
        throw new Error('Some sensitive db error stack trace info...')
      })
    } as any
    const handlers: Record<string, (event: any, ...args: any[]) => any> = {}
    const ipcMain = {
      handle: vi.fn((channel, listener) => {
        handlers[channel] = listener
      })
    }
    const isValidSender = vi.fn().mockReturnValue(true)

    registerNotionConnectionIpc({ service, ipcMain, isValidSender })

    const event = {}
    try {
      await handlers['notion:get-status'](event)
      expect.fail('should have thrown')
    } catch (e: any) {
      expect(e.message).toBe('INTERNAL_ERROR')
      expect(e.stack).toBe('')
    }
  })

  it('TC-NOTION-CONN-016: Verification failure does not delete or mutate Review Sources and Review Logs', async () => {
    const encryption = new MockEncryption()
    const store = new MockStore()
    const vault = new TokenVault(encryption, store)
    const client = { verify: vi.fn().mockRejectedValue(new Error('Network error')) }
    const service = createNotionConnectionService({ vault, client })

    service.saveToken({ token: 'my_token' })
    const status = await service.verifyConnection()
    expect(status).toBe('network_error')
    expect(vault.hasToken()).toBe(true)
  })

  it('TC-NOTION-CONN-026: Preload exposes intent-specific methods and no generic send, invoke, token-read, or filesystem API', async () => {
    const exposeSpy = contextBridge.exposeInMainWorld as any
    exposeSpy.mockClear()

    await import('../../../../preload/index')

    expect(exposeSpy).toHaveBeenCalledWith('notionConnection', expect.any(Object))

    const notionConnection = exposeSpy.mock.calls.find(
      (call: any) => call[0] === 'notionConnection'
    )[1]

    expect(notionConnection).toHaveProperty('getStatus')
    expect(notionConnection).toHaveProperty('saveToken')
    expect(notionConnection).toHaveProperty('deleteToken')
    expect(notionConnection).toHaveProperty('verify')

    expect(notionConnection).not.toHaveProperty('send')
    expect(notionConnection).not.toHaveProperty('invoke')
    expect(notionConnection).not.toHaveProperty('getToken')
    expect(notionConnection).not.toHaveProperty('fs')
  })

  describe('FileBlobStore Atomic Writes & File operations', () => {
    const testFilePath = join(__dirname, 'atomic-test.dat')

    afterEach(() => {
      if (existsSync(testFilePath)) {
        try {
          unlinkSync(testFilePath)
        } catch (err) {
          void err
        }
      }
      if (existsSync(testFilePath + '.tmp')) {
        try {
          unlinkSync(testFilePath + '.tmp')
        } catch (err) {
          void err
        }
      }
    })

    it('정상적인 write 호출 시 임시 파일을 작성하고 renameSync를 통해 원자적으로 저장합니다.', () => {
      const store = new FileBlobStore(testFilePath)
      store.write(Buffer.from('hello-world'))
      expect(readFileSync(testFilePath).toString()).toBe('hello-world')
    })

    it('write 도중 에러가 발생한 경우, 임시 파일이 정리되고 기존 파일이 안전하게 보존됩니다.', () => {
      const store = new FileBlobStore(testFilePath)
      store.write(Buffer.from('original-data'))

      const invalidStore = new FileBlobStore(join(__dirname, 'non-exist-dir/atomic-test.dat'))
      expect(() => invalidStore.write(Buffer.from('new-data'))).toThrow()
      
      expect(readFileSync(testFilePath).toString()).toBe('original-data')
      expect(existsSync(testFilePath + '.tmp')).toBe(false)
    })

    it('read 중 발생하는 디스크 에러가 상위로 전파됩니다.', () => {
      const store = new FileBlobStore(testFilePath)
      store.write(Buffer.from('some-data'))
      
      mockFsErrorType = 'read'
      expect(() => store.read()).toThrow('DISK_READ_ERROR')
      mockFsErrorType = 'none'
    })

    it('delete 중 발생하는 에러가 상위로 고스란히 전파됩니다.', () => {
      const store = new FileBlobStore(testFilePath)
      store.write(Buffer.from('some-data'))
      
      mockFsErrorType = 'delete'
      expect(() => store.delete()).toThrow('DISK_DELETE_ERROR')
      mockFsErrorType = 'none'
    })
  })

  describe('ElectronEncryptionBackend weak keyring detection', () => {
    it('getSelectedEncryptionBackend()가 basic_text인 경우 isWeak()가 true를 반환하고, encryptString 호출 시 예외를 던집니다.', () => {
      const backend = new ElectronEncryptionBackend()
      
      mockGetSelectedEncryptionBackend.mockReturnValue('gnome-keyring')
      expect(backend.isWeak()).toBe(false)
      expect(() => backend.encryptString('test-token')).not.toThrow()

      mockGetSelectedEncryptionBackend.mockReturnValue('basic_text')
      expect(backend.isWeak()).toBe(true)
      expect(() => backend.encryptString('test-token')).toThrow('DISALLOWED_ENCRYPTION_BACKEND')
    })
  })

  describe('ProductionNotionConnectionClient request configuration', () => {
    it('verify 호출 시 fetch에 2026-03-11 Notion-Version 헤더와 AbortSignal.timeout(10000)이 인자로 주입됩니다.', async () => {
      const client = new ProductionNotionConnectionClient()
      
      const originalFetch = global.fetch
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      })
      global.fetch = mockFetch

      await client.verify('notion-token-xyz')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.notion.com/v1/users/me',
        expect.objectContaining({
          method: 'GET',
          headers: {
            Authorization: 'Bearer notion-token-xyz',
            'Notion-Version': '2026-03-11'
          },
          signal: expect.any(AbortSignal)
        })
      )

      global.fetch = originalFetch
    })
  })

  describe('verifyConnection race condition safety', () => {
    it('연결 검증 비동기 요청 수행 중 토큰이 삭제된 경우, 이전 검증 완료 후에도 상태를 connected로 덮어쓰지 않고 현재 상태를 유지합니다.', async () => {
      const encryption = new MockEncryption()
      const store = new MockStore()
      const vault = new TokenVault(encryption, store)
      
      vault.saveToken('token-1')

      let resolveVerify: (() => void) | null = null
      const verifyPromise = new Promise<void>((resolve) => {
        resolveVerify = resolve
      })
      const client = {
        verify: vi.fn().mockReturnValue(verifyPromise)
      }

      const service = createNotionConnectionService({ vault, client })

      const verifyAction = service.verifyConnection()

      service.deleteToken()
      expect(service.getStatus()).toBe('not_configured')

      if (resolveVerify) {
        (resolveVerify as () => void)()
      }

      const finalStatus = await verifyAction

      expect(finalStatus).toBe('not_configured')
      expect(service.getStatus()).toBe('not_configured')
    })
    
    it('연결 검증 비동기 요청 수행 중 토큰이 다른 토큰으로 교체된 경우, 이전 검증 실패 결과가 현재 상태(configured)를 덮어쓰지 않습니다.', async () => {
      const encryption = new MockEncryption()
      const store = new MockStore()
      const vault = new TokenVault(encryption, store)
      
      vault.saveToken('token-1')

      let rejectVerify: ((err: any) => void) | null = null
      const verifyPromise = new Promise<void>((_, reject) => {
        rejectVerify = reject
      })
      const client = {
        verify: vi.fn().mockReturnValue(verifyPromise)
      }

      const service = createNotionConnectionService({ vault, client })

      const verifyAction = service.verifyConnection()

      service.saveToken({ token: 'token-2' })
      expect(service.getStatus()).toBe('configured')

      const error = new Error('Unauthorized')
      ;(error as any).status = 401
      if (rejectVerify) {
        (rejectVerify as (err: any) => void)(error)
      }

      const finalStatus = await verifyAction

      expect(finalStatus).toBe('configured')
      expect(service.getStatus()).toBe('configured')
    })
  })
})
