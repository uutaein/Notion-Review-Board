import { join } from 'node:path'
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

  // 안전한 IPC 송신처 검증 함수 정의
  const isValidSender = (event: unknown): boolean => {
    const ev = event as { senderFrame?: { url: string } }
    const senderFrame = ev.senderFrame
    if (!senderFrame) return false
    if (
      senderFrame.url.startsWith('file://') ||
      (process.env.ELECTRON_RENDERER_URL &&
        senderFrame.url.startsWith(process.env.ELECTRON_RENDERER_URL))
    ) {
      return true
    }
    return false
  }

  // Notion 연결 관련 IPC 채널 활성화 등록
  registerNotionConnectionIpc({
    service: notionConnectionService,
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
