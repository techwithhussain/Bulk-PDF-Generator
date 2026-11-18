'use strict'

const { autoUpdater } = require('electron-updater')
const { ipcMain, app } = require('electron')
const path = require('path')
const { getConfig } = require('./remoteConfig')

// ── Auto Updater Configuration ───────────────────────────────────────────────
autoUpdater.autoDownload = false        // User clicks download — we control it
autoUpdater.autoInstallOnAppQuit = true // Install when user quits normally
autoUpdater.allowPrerelease = false
autoUpdater.allowDowngrade = false

// In dev mode, skip updater
const isDev = !app.isPackaged

let mainWindow = null
let updateInfo = null
let isChecking = false

function setMainWindow(win) {
  mainWindow = win
}

function send(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

// ── Updater Events ───────────────────────────────────────────────────────────
autoUpdater.on('checking-for-update', () => {
  isChecking = true
  send('updater:checking', null)
})

autoUpdater.on('update-available', (info) => {
  isChecking = false
  updateInfo = info
  send('updater:available', {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes || '',
  })
})

autoUpdater.on('update-not-available', () => {
  isChecking = false
  send('updater:not-available', null)
})

autoUpdater.on('download-progress', (progress) => {
  send('updater:progress', {
    percent: Math.round(progress.percent),
    transferred: progress.transferred,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond,
  })
})

autoUpdater.on('update-downloaded', (info) => {
  send('updater:downloaded', {
    version: info.version,
  })
})

autoUpdater.on('error', (err) => {
  isChecking = false
  send('updater:error', err.message)
  console.error('[Updater] Error:', err.message)
})

// ── IPC Handlers ─────────────────────────────────────────────────────────────
function registerUpdaterHandlers(ipcMain) {
  // Check for updates
  ipcMain.handle('updater:check', async () => {
    if (isDev) return { isDev: true }
    try {
      await autoUpdater.checkForUpdates()
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Start download
  ipcMain.handle('updater:download', async () => {
    try {
      autoUpdater.downloadUpdate()
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Quit and install
  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  // Get current status
  ipcMain.handle('updater:status', async () => {
    // Get force_update from remote config
    let forceUpdate = false
    try {
      const config = await getConfig()
      forceUpdate = config?.force_update === true || config?.force_update === 'true'
    } catch {}
    
    return {
      isDev,
      updateInfo,
      isChecking,
      forceUpdate,
      currentVersion: app.getVersion(),
    }
  })
}

// ── Auto-check on startup (after 5 seconds) ──────────────────────────────────
function initUpdater(win) {
  mainWindow = win
  if (isDev) {
    console.log('[Updater] Dev mode — skipping auto-update check')
    return
  }
  // Check after 5 seconds (let app load first)
  setTimeout(async () => {
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      console.log('[Updater] Check failed:', err.message)
    }
  }, 5000)
}

module.exports = { registerUpdaterHandlers, initUpdater, setMainWindow }

