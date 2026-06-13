import { randomUUID } from 'node:crypto'
import { join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { createDatabaseService, type DatabaseService } from './services/database'
import {
  createNotionConnectionService,
  TokenVault,
  FileBlobStore,
  ElectronEncryptionBackend,
  ProductionNotionConnectionClient
} from './services/notion/connection'
import { registerNotionConnectionIpc } from './ipc/notion-connection'
import { createReviewSourceService } from './services/source'
import {
  createNotionSourceMetadataService,
  ProductionNotionTargetResolver,
  ProductionNotionMetadataClient
} from './services/notion/source-metadata'
import { registerSourceMappingIpc } from './ipc/source-mapping'
import { registerManualSyncIpc } from './ipc/manual-sync'
import { createCollectionEngine } from './services/collection'
import { createDatabaseSyncPersistence } from './services/database'
import { ProductionNotionPageQueryClient } from './services/notion/sync-query'
import { createFsrsEngine } from './services/scheduler/fsrs-engine'
import { createManualSyncService } from './services/synchronization'
import type { DateTimeString, ReviewItemId, ReviewSourceId } from '../shared/domain/types'

let database: DatabaseService | null = null

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // 외부 도메인이나 신뢰할 수 없는 로컬 리다이렉션을 방지하기 위해 창 내에서의 불필요한 내비게이션을 전면 차단합니다.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    let allowed = false
    if (is.dev && process.env.ELECTRON_RENDERER_URL) {
      try {
        const allowedOrigin = new URL(process.env.ELECTRON_RENDERER_URL).origin
        const targetOrigin = new URL(url).origin
        if (allowedOrigin === targetOrigin) {
          allowed = true
        }
      } catch {
        allowed = false
      }
    } else {
      try {
        const targetPath = normalize(fileURLToPath(url)).toLowerCase()
        const expectedPath = normalize(join(__dirname, '../renderer/index.html')).toLowerCase()
        if (targetPath === expectedPath) {
          allowed = true
        }
      } catch {
        allowed = false
      }
    }
    if (!allowed) {
      event.preventDefault()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.notion-review-board.app')
  database = createDatabaseService(join(app.getPath('userData'), 'notion-review-board.sqlite'))

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('shell:open-external', (_, url: string) => {
    if (!url.startsWith('https://')) {
      throw new Error('Only HTTPS URLs are allowed')
    }
    return shell.openExternal(url)
  })

  // Notion 연결성 검증 및 토큰 보안 설정 서비스 초기화
  const encryption = new ElectronEncryptionBackend()
  const store = new FileBlobStore(join(app.getPath('userData'), 'notion-token.dat'))
  const vault = new TokenVault(encryption, store)
  const client = new ProductionNotionConnectionClient()
  const notionConnectionService = createNotionConnectionService({ vault, client })

  // 안전한 IPC 송신처 검증 함수 정의 (Electron 권고에 따라 URL 파서로 정확한 origin/path를 allowlist)
  const isValidSender = (event: unknown): boolean => {
    const ev = event as { senderFrame?: { url: string } }
    const senderFrame = ev.senderFrame
    if (!senderFrame?.url) return false

    try {
      const parsedUrl = new URL(senderFrame.url)

      // 개발 모드인 경우 렌더러 개발 주소(ELECTRON_RENDERER_URL)의 origin과 정확히 매칭되는지 판정합니다.
      if (is.dev && process.env.ELECTRON_RENDERER_URL) {
        const devUrl = new URL(process.env.ELECTRON_RENDERER_URL)
        return parsedUrl.origin === devUrl.origin
      }

      // 프로덕션 모드인 경우 디렉토리 내 index.html의 로컬 파일 경로와 완벽히 대소문자 없이 매칭되는지 판정합니다.
      if (parsedUrl.protocol === 'file:') {
        const filePath = normalize(fileURLToPath(senderFrame.url)).toLowerCase()
        const expectedPath = normalize(join(__dirname, '../renderer/index.html')).toLowerCase()
        return filePath === expectedPath
      }
    } catch {
      return false
    }

    return false
  }

  // Notion 연결 관련 IPC 채널 활성화 등록
  registerNotionConnectionIpc({
    service: notionConnectionService,
    ipcMain,
    isValidSender
  })

  // Review Source 및 Notion 메타데이터 서비스 초기화
  const metadataResolver = new ProductionNotionTargetResolver(vault)
  const sourceService = createReviewSourceService({
    database: database!,
    resolver: metadataResolver
  })
  const metadataClient = new ProductionNotionMetadataClient(vault)
  const metadataService = createNotionSourceMetadataService({
    resolver: metadataResolver,
    client: metadataClient
  })

  // Review Source 및 필드 매핑 관련 IPC 채널 활성화 등록
  registerSourceMappingIpc({
    sourceService,
    metadataService,
    ipcMain,
    isValidSender
  })

  const fsrsEngine = createFsrsEngine()
  const manualSyncService = createManualSyncService({
    sources: {
      listEnabledSources: () =>
        database!.reviewSources.findAll().filter((source) => source.enabled),
      findSourceById: (sourceId: ReviewSourceId) => database!.reviewSources.findById(sourceId)
    },
    notion: new ProductionNotionPageQueryClient({ vault }),
    collection: createCollectionEngine(),
    persistence: createDatabaseSyncPersistence(database!),
    scheduler: {
      createInitialState: (now) => ({
        dueAt: now,
        state: fsrsEngine.createInitialState(now)
      })
    },
    retry: {
      maxRetries: 2,
      maxTotalWaitMs: 30_000,
      fallbackDelayMs: 1_000,
      sleep: (delayMs, signal) =>
        new Promise<void>((resolve, reject) => {
          if (signal?.aborted) {
            reject(new Error('SYNC_CANCELLED'))
            return
          }

          const timer = setTimeout(resolve, delayMs)
          signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer)
              reject(new Error('SYNC_CANCELLED'))
            },
            { once: true }
          )
        })
    },
    now: () => new Date().toISOString() as DateTimeString,
    createReviewItemId: () => `item_${randomUUID()}` as ReviewItemId
  })

  registerManualSyncIpc({
    service: manualSyncService,
    ipcMain,
    isValidSender
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  database?.close()
  database = null
})
