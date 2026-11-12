const { app, shell } = require('electron')
const path = require('path')
const { getDb } = require('../db/database')

function registerSettingsHandlers(ipcMain) {
  ipcMain.handle('settings:get', (_event) => {
    const db = getDb()
    const rows = db.prepare('SELECT key, value FROM app_settings').all()
    const settings = {}
    rows.forEach(row => { settings[row.key] = row.value })
    return { success: true, settings }
  })

  ipcMain.handle('settings:set', (_event, newSettings) => {
    const db = getDb()
    const now = new Date().toISOString()
    const upsert = db.prepare(`
      INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
    `)
    const updateMany = db.transaction((s) => {
      for (const [key, value] of Object.entries(s)) {
        upsert.run(key, String(value), now)
      }
    })
    updateMany(newSettings)
    return { success: true }
  })

  ipcMain.handle('settings:openLogsFolder', (_event) => {
    const logsDir = path.join(app.getPath('userData'), 'logs')
    shell.openPath(logsDir)
    return { success: true }
  })

  ipcMain.handle('settings:getAppVersion', (_event) => {
    return { success: true, version: app.getVersion() }
  })
}

module.exports = { registerSettingsHandlers }

