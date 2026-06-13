import { describe, expect, it, vi } from 'vitest'
import {
  useNotionConnection,
  type NotionConnectionRendererApi,
  type NotionConnectionStatus
} from '../useNotionConnection'

function setup(initialStatus: NotionConnectionStatus = 'not_configured') {
  const api: NotionConnectionRendererApi = {
    getStatus: vi.fn().mockResolvedValue(initialStatus),
    saveToken: vi.fn().mockResolvedValue('configured'),
    deleteToken: vi.fn().mockResolvedValue('not_configured'),
    verify: vi.fn().mockResolvedValue('connected')
  }
  return {
    api,
    model: useNotionConnection(api)
  }
}

describe('Notion connection renderer model', () => {
  it('TC-NOTION-CONN-UI-001/002: saves a token without keeping it in renderer state', async () => {
    const { api, model } = setup()
    model.tokenInput.value = 'secret_token'

    await model.save()

    expect(api.saveToken).toHaveBeenCalledWith({ token: 'secret_token' })
    expect(model.status.value).toBe('configured')
    expect(model.tokenInput.value).toBe('')
    expect(model.message.value).not.toContain('secret_token')
  })

  it('TC-NOTION-CONN-UI-003: blocks empty or whitespace-only token input', async () => {
    const { api, model } = setup()
    model.tokenInput.value = '   '

    await model.save()

    expect(api.saveToken).not.toHaveBeenCalled()
    expect(model.message.value).toBe('토큰을 입력하세요.')
  })

  it('TC-NOTION-CONN-UI-004/007: maps save failures to sanitized user messages', async () => {
    const { api, model } = setup()
    api.saveToken = vi.fn().mockRejectedValue(new Error('OS_ENCRYPTION_UNAVAILABLE'))
    model.tokenInput.value = 'secret_token'

    await model.save()

    expect(model.message.value).toBe('운영체제 보안 저장소를 사용할 수 없습니다.')
    expect(model.message.value).not.toContain('secret_token')
  })

  it('TC-NOTION-CONN-UI-005: replacing a token requires an explicit save action', async () => {
    const { api, model } = setup('configured')
    model.tokenInput.value = 'new_secret'

    expect(api.saveToken).not.toHaveBeenCalled()

    await model.save()

    expect(api.saveToken).toHaveBeenCalledWith({ token: 'new_secret' })
  })

  it('TC-NOTION-CONN-UI-006: token deletion requires confirmation', async () => {
    const { api, model } = setup('configured')
    await model.loadStatus()

    await model.deleteToken(() => false)
    expect(api.deleteToken).not.toHaveBeenCalled()

    await model.deleteToken(() => true)
    expect(api.deleteToken).toHaveBeenCalledOnce()
    expect(model.status.value).toBe('not_configured')
  })

  it.each([
    ['connected', 'Notion 연결이 확인되었습니다.'],
    ['unauthorized', '인증 실패: 토큰을 확인하세요.'],
    ['forbidden', '권한 부족: Notion 공유 권한을 확인하세요.'],
    ['rate_limited', '요청 한도 초과: 잠시 후 다시 시도하세요.'],
    ['network_error', '네트워크 오류: 연결 상태를 확인하세요.']
  ] as const)('TC-NOTION-CONN-UI-008: displays %s verification result', async (status, message) => {
    const { api, model } = setup('configured')
    api.verify = vi.fn().mockResolvedValue(status)
    await model.loadStatus()

    await model.verify()

    expect(model.status.value).toBe(status)
    expect(model.message.value).toBe(message)
  })

  it('TC-NOTION-CONN-UI-009: verification pending state prevents duplicate requests', async () => {
    const { api, model } = setup('configured')
    await model.loadStatus()
    api.verify = vi.fn(
      () =>
        new Promise<NotionConnectionStatus>((resolve) => {
          setTimeout(() => resolve('connected'), 10)
        })
    )

    const first = model.verify()
    await model.verify()
    await first

    expect(api.verify).toHaveBeenCalledOnce()
  })

  it('TC-NOTION-CONN-UI-010: missing token disables verification', async () => {
    const { api, model } = setup('not_configured')
    await model.loadStatus()

    await model.verify()

    expect(api.verify).not.toHaveBeenCalled()
    expect(model.message.value).toBe('먼저 Notion 토큰을 저장하세요.')
  })
})
