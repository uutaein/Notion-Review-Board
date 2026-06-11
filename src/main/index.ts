import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { createDatabaseService, type DatabaseService } from './services/database'

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
