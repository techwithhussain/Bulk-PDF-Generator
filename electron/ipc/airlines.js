const { getDb } = require('../db/database')
const { v4: uuidv4 } = require('uuid')

function registerAirlinesHandlers(ipcMain) {

  // Get all global airlines
  ipcMain.handle('airlines:getAll', () => {
    try {
      const db = getDb()
      const rows = db.prepare('SELECT * FROM global_airlines ORDER BY sort_order ASC, created_at ASC').all()
      return { success: true, airlines: rows }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Add airlines from a text list (one per line)
  ipcMain.handle('airlines:addFromText', (_event, text) => {
    try {
      const db = getDb()
      const lines = text.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)

      const existing = db.prepare('SELECT COUNT(*) as c FROM global_airlines').get().c
      let added = 0
      let skipped = 0

      const insert = db.prepare(`
        INSERT OR IGNORE INTO global_airlines (id, name, sort_order, created_at)
        VALUES (?, ?, ?, ?)
      `)

      const insertMany = db.transaction((lines) => {
        lines.forEach((name, i) => {
          const result = insert.run(uuidv4(), name, existing + i, new Date().toISOString())
          if (result.changes > 0) added++
          else skipped++
        })
      })

      insertMany(lines)
      return { success: true, added, skipped, total: lines.length }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Import airlines from parsed CSV data (array of names)
  ipcMain.handle('airlines:importFromCsv', (_event, names) => {
    try {
      const db = getDb()
      let added = 0, skipped = 0

      const insert = db.prepare(`
        INSERT OR IGNORE INTO global_airlines (id, name, sort_order, created_at)
        VALUES (?, ?, ?, ?)
      `)

      const insertMany = db.transaction((names) => {
        names.forEach((name, i) => {
          const trimmed = String(name).trim()
          if (!trimmed) return
          const result = insert.run(uuidv4(), trimmed, i, new Date().toISOString())
          if (result.changes > 0) added++
          else skipped++
        })
      })

      insertMany(names)
      return { success: true, added, skipped }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Delete single airline
  ipcMain.handle('airlines:delete', (_event, id) => {
    try {
      const db = getDb()
      db.prepare('DELETE FROM global_airlines WHERE id = ?').run(id)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Clear all airlines
  ipcMain.handle('airlines:clear', () => {
    try {
      const db = getDb()
      db.prepare('DELETE FROM global_airlines').run()
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Get as dataset rows format (for editor/generator use)
  ipcMain.handle('airlines:asRows', () => {
    try {
      const db = getDb()
      const airlines = db.prepare('SELECT name FROM global_airlines ORDER BY sort_order ASC, created_at ASC').all()
      const rows = airlines.map((a, i) => ({
        data: { airline: a.name },
        rowIndex: i,
      }))
      return { success: true, rows, total: rows.length }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}

module.exports = { registerAirlinesHandlers }

