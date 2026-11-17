'use strict'

const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = require('electron')
const path = require('path')

// Fix GPU cache issues in sandboxed/agent environments
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors')
const { initDatabase } = require('./db/database')

// IPC Handlers
const { registerProjectHandlers } = require('./ipc/projects')
const { registerPdfHandlers } = require('./ipc/pdf')
const { registerExportHandlers } = require('./ipc/export')
const { registerFindReplaceHandlers } = require('./ipc/findReplace')
const { registerDataImportHandlers } = require('./ipc/dataImport')
const { registerSettingsHandlers } = require('./ipc/settings')
const { registerLicenseHandlers } = require('./ipc/license')
const { registerAirlinesHandlers } = require('./ipc/airlines')

let mainWindow = null

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
    titleBarStyle: 'default',
    show: false,
    backgroundColor: '#f8fafc',
  })

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
    mainWindow.maximize()
    // Press Ctrl+Shift+I in app to open DevTools manually
  })

  // Log renderer errors
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2) console.error(`[Renderer] ${message} (${sourceId}:${line})`)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Window] Page loaded successfully!')
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`[Window] Failed to load: ${errorCode} ${errorDescription}`)
    // Retry after 2 seconds if Vite server not ready
    if (errorCode === -102 || errorCode === -106) {
      setTimeout(() => {
        console.log('[Window] Retrying load...')
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
      }, 2000)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  await initDatabase()

  registerProjectHandlers(ipcMain)
  registerPdfHandlers(ipcMain)
  registerExportHandlers(ipcMain)
  registerFindReplaceHandlers(ipcMain)
  registerDataImportHandlers(ipcMain)
  registerSettingsHandlers(ipcMain)
  registerLicenseHandlers(ipcMain)
  registerAirlinesHandlers(ipcMain)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

module.exports = { getMainWindow: () => mainWindow }
