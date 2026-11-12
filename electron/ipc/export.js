const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const { dialog, shell } = require('electron')
const { getDb } = require('../db/database')

function registerExportHandlers(ipcMain) {
  ipcMain.handle('export:downloadZip', async (event, batchId) => {
    const db = getDb()

    // Show save dialog for ZIP file
    const result = await dialog.showSaveDialog({
      title: 'Save ZIP file',
      defaultPath: `PDFs_Batch_${batchId.slice(0, 8)}.zip`,
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    })
    if (result.canceled || !result.filePath) return { success: false, canceled: true }

    const zipPath = result.filePath

    const items = db.prepare(`
      SELECT * FROM pdf_items WHERE batch_id = ? AND status = 'done' ORDER BY item_index
    `).all(batchId)

    if (items.length === 0) return { success: false, error: 'No completed PDFs to export' }

    // Build a simple ZIP using raw ZIP format (no external deps)
    try {
      const zipBuffer = buildZip(items)
      fs.writeFileSync(zipPath, zipBuffer)
      return { success: true, zipPath, count: items.length }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('export:chooseFolder', async (event) => {
    const result = await dialog.showOpenDialog({
      title: 'Choose Export Folder',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    return { success: true, folderPath: result.filePaths[0] }
  })

  ipcMain.handle('export:openFolder', async (_event, folderPath) => {
    shell.openPath(folderPath)
    return { success: true }
  })

  ipcMain.handle('export:downloadBatch', async (event, batchId, destFolder) => {
    const db = getDb()

    // If no folder provided, show picker
    let targetFolder = destFolder
    if (!targetFolder) {
      const result = await dialog.showOpenDialog({
        title: 'Choose Export Folder for PDFs',
        properties: ['openDirectory', 'createDirectory'],
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true }
      }
      targetFolder = result.filePaths[0]
    }

    // Save default export folder
    db.prepare(`INSERT OR REPLACE INTO app_settings (key, value, updated_at)
      VALUES ('default_export_folder', ?, datetime('now'))`)
      .run(targetFolder)

    // Get completed items
    const items = db.prepare(`
      SELECT * FROM pdf_items WHERE batch_id = ? AND status = 'done' ORDER BY item_index
    `).all(batchId)

    if (items.length === 0) {
      return { success: false, error: 'No completed PDFs to export' }
    }

    const startTime = Date.now()
    let exported = 0
    let skipped = 0
    let failed = 0
    const errors = []

    for (const item of items) {
      if (!item.file_path || !fs.existsSync(item.file_path)) {
        failed++
        errors.push({ filename: item.filename, error: 'Source file not found' })
        continue
      }

      let destPath = path.join(targetFolder, item.filename)

      // Handle collision
      if (fs.existsSync(destPath)) {
        const ext = path.extname(item.filename)
        const base = path.basename(item.filename, ext)
        let counter = 1
        while (fs.existsSync(destPath)) {
          destPath = path.join(targetFolder, `${base}_${counter}${ext}`)
          counter++
        }
      }

      try {
        fs.copyFileSync(item.file_path, destPath)
        db.prepare('UPDATE pdf_items SET exported_at = ?, export_path = ? WHERE id = ?')
          .run(new Date().toISOString(), destPath, item.id)
        exported++

        try {
          event.sender.send('export:progress', {
            batchId, exported, total: items.length, currentFile: item.filename
          })
        } catch {}
      } catch (err) {
        failed++
        errors.push({ filename: item.filename, error: err.message })
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000)

    try {
      event.sender.send('export:complete', { batchId, exported, skipped, failed, destFolder: targetFolder, elapsed })
    } catch {}

    return { success: true, exported, skipped, failed, errors, destFolder: targetFolder, elapsed }
  })

  ipcMain.handle('export:retryFailed', async (event, batchId, destFolder) => {
    // Re-use the downloadBatch logic by calling it directly (not via ipcMain.handle)
    const db = getDb()
    let targetFolder = destFolder
    if (!targetFolder) {
      const result = await dialog.showOpenDialog({
        title: 'Choose Export Folder for PDFs',
        properties: ['openDirectory', 'createDirectory'],
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true }
      }
      targetFolder = result.filePaths[0]
    }

    // Only retry failed items
    const items = db.prepare(
      `SELECT * FROM pdf_items WHERE batch_id = ? AND status = 'failed'`
    ).all(batchId)

    if (items.length === 0) return { success: true, exported: 0, message: 'No failed items to retry' }

    let exported = 0
    let failed = 0
    const errors = []

    for (const item of items) {
      try {
        const dest = path.join(targetFolder, item.filename)
        if (item.file_path && fs.existsSync(item.file_path)) {
          fs.copyFileSync(item.file_path, dest)
          db.prepare(`UPDATE pdf_items SET exported_at = ?, export_path = ? WHERE id = ?`).run(new Date().toISOString(), dest, item.id)
          exported++
        } else {
          throw new Error('Source PDF not found')
        }
      } catch (err) {
        failed++
        errors.push({ filename: item.filename, error: err.message })
      }
    }

    return { success: true, exported, failed, errors, destFolder: targetFolder }
  })
}

module.exports = { registerExportHandlers }

// ── Minimal ZIP builder (no external deps) ──────────────────────────────────
function buildZip(items) {
  const localHeaders = []
  const centralDir = []
  let offset = 0

  for (const item of items) {
    if (!item.file_path || !fs.existsSync(item.file_path)) continue

    const fileData = fs.readFileSync(item.file_path)
    const compressed = zlib.deflateRawSync(fileData, { level: 6 })
    const useName = Buffer.from(item.filename, 'utf8')
    const crc = crc32(fileData)
    const dosTime = toDosTime(new Date())

    // Local file header
    const lhSize = 30 + useName.length
    const lh = Buffer.alloc(lhSize)
    lh.writeUInt32LE(0x04034b50, 0)   // signature
    lh.writeUInt16LE(20, 4)            // version needed
    lh.writeUInt16LE(0, 6)             // flags
    lh.writeUInt16LE(8, 8)             // compression (deflate)
    lh.writeUInt32LE(dosTime, 10)      // mod time+date
    lh.writeUInt32LE(crc >>> 0, 14)   // crc32
    lh.writeUInt32LE(compressed.length, 18) // compressed size
    lh.writeUInt32LE(fileData.length, 22)   // uncompressed size
    lh.writeUInt16LE(useName.length, 26)    // filename length
    lh.writeUInt16LE(0, 28)                 // extra length
    useName.copy(lh, 30)

    localHeaders.push(lh, compressed)

    // Central directory entry
    const cd = Buffer.alloc(46 + useName.length)
    cd.writeUInt32LE(0x02014b50, 0)   // signature
    cd.writeUInt16LE(20, 4)            // version made by
    cd.writeUInt16LE(20, 6)            // version needed
    cd.writeUInt16LE(0, 8)             // flags
    cd.writeUInt16LE(8, 10)            // compression
    cd.writeUInt32LE(dosTime, 12)      // mod time+date
    cd.writeUInt32LE(crc >>> 0, 16)   // crc32
    cd.writeUInt32LE(compressed.length, 20) // compressed size
    cd.writeUInt32LE(fileData.length, 24)   // uncompressed size
    cd.writeUInt16LE(useName.length, 28)    // filename length
    cd.writeUInt16LE(0, 30)                 // extra length
    cd.writeUInt16LE(0, 32)                 // comment length
    cd.writeUInt16LE(0, 34)                 // disk start
    cd.writeUInt16LE(0, 36)                 // internal attr
    cd.writeUInt32LE(0, 38)                 // external attr
    cd.writeUInt32LE(offset, 42)            // local header offset
    useName.copy(cd, 46)

    centralDir.push(cd)
    offset += lhSize + compressed.length
  }

  const cdBuf = Buffer.concat(centralDir)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)          // signature
  eocd.writeUInt16LE(0, 4)                   // disk number
  eocd.writeUInt16LE(0, 6)                   // disk with cd
  eocd.writeUInt16LE(centralDir.length, 8)   // entries on disk
  eocd.writeUInt16LE(centralDir.length, 10)  // total entries
  eocd.writeUInt32LE(cdBuf.length, 12)       // cd size
  eocd.writeUInt32LE(offset, 16)             // cd offset
  eocd.writeUInt16LE(0, 20)                  // comment length

  return Buffer.concat([...localHeaders, cdBuf, eocd])
}

function toDosTime(d) {
  const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1))
  const date = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate())
  return ((date << 16) | time) >>> 0
}

function crc32(buf) {
  let crc = 0xFFFFFFFF
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
      t[i] = c
    }
    return t
  })())
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF)
}

