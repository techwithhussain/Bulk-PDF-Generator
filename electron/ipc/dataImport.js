const { dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const Papa = require('papaparse')
const XLSX = require('xlsx')
const { v4: uuidv4 } = require('uuid')
const { getDb } = require('../db/database')

function registerDataImportHandlers(ipcMain) {
  ipcMain.handle('dataImport:chooseFile', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Data File',
      filters: [
        { name: 'Data Files', extensions: ['csv', 'xlsx', 'xls'] },
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'Excel Files', extensions: ['xlsx'] },
      ],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }
    return { success: true, filePath: result.filePaths[0] }
  })

  ipcMain.handle('dataImport:parseFile', (_event, filePath) => {
    const ext = path.extname(filePath).toLowerCase()

    try {
      if (ext === '.csv') {
        return parseCSV(filePath)
      } else if (ext === '.xlsx' || ext === '.xls') {
        return parseXLSX(filePath)
      } else {
        return { success: false, error: 'Unsupported file type. Use CSV or XLSX.' }
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('dataImport:saveDataset', (_event, projectId, datasetMeta) => {
    const db = getDb()
    const id = uuidv4()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO datasets (id, project_id, file_name, file_path, columns_json,
        row_count, sheet_name, header_row, delimiter, encoding, imported_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, projectId,
      datasetMeta.fileName, datasetMeta.filePath,
      JSON.stringify(datasetMeta.columns),
      datasetMeta.rows.length,
      datasetMeta.sheetName || null,
      datasetMeta.headerRow || 0,
      datasetMeta.delimiter || null,
      datasetMeta.encoding || 'UTF-8',
      now)

    // Save rows
    const insertRow = db.prepare(`
      INSERT INTO dataset_rows (id, dataset_id, row_index, data_json, is_excluded)
      VALUES (?, ?, ?, ?, 0)
    `)
    const insertMany = db.transaction((rows) => {
      rows.forEach((row, idx) => {
        insertRow.run(uuidv4(), id, idx, JSON.stringify(row))
      })
    })
    insertMany(datasetMeta.rows)

    return { success: true, datasetId: id, rowCount: datasetMeta.rows.length }
  })

  ipcMain.handle('dataImport:getDataset', (_event, datasetId) => {
    const db = getDb()
    const dataset = db.prepare('SELECT * FROM datasets WHERE id = ?').get(datasetId)
    if (!dataset) return { success: false, error: 'Dataset not found' }
    return { success: true, dataset }
  })

  ipcMain.handle('dataImport:getRows', (_event, datasetId, limit = 50, offset = 0) => {
    const db = getDb()
    const rows = db.prepare(`
      SELECT * FROM dataset_rows WHERE dataset_id = ? AND is_excluded = 0
      ORDER BY row_index LIMIT ? OFFSET ?
    `).all(datasetId, limit, offset)

    const total = db.prepare('SELECT COUNT(*) as cnt FROM dataset_rows WHERE dataset_id = ? AND is_excluded = 0')
      .get(datasetId)?.cnt || 0

    return {
      success: true,
      rows: rows.map(r => ({ id: r.id, rowIndex: r.row_index, data: JSON.parse(r.data_json) })),
      total,
    }
  })
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  })

  if (result.errors.length > 0 && result.data.length === 0) {
    return { success: false, error: result.errors[0].message }
  }

  const columns = result.meta.fields || []
  const duplicates = findDuplicates(columns)

  return {
    success: true,
    fileType: 'csv',
    fileName: path.basename(filePath),
    filePath,
    columns,
    rows: result.data,
    rowCount: result.data.length,
    delimiter: result.meta.delimiter,
    encoding: 'UTF-8',
    duplicateColumns: duplicates,
    errors: result.errors,
  }
}

function parseXLSX(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true, raw: false })
  const sheetNames = workbook.SheetNames

  if (sheetNames.length === 0) {
    return { success: false, error: 'No sheets found in workbook' }
  }

  // Parse first sheet by default
  const sheetName = sheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  if (rawData.length === 0) return { success: false, error: 'Sheet is empty' }

  const headerRow = rawData[0].map(h => String(h || '').trim())
  const columns = headerRow
  const rows = rawData.slice(1).map(row => {
    const obj = {}
    columns.forEach((col, i) => { obj[col] = String(row[i] || '') })
    return obj
  }).filter(row => Object.values(row).some(v => v !== ''))

  const duplicates = findDuplicates(columns)

  return {
    success: true,
    fileType: 'xlsx',
    fileName: path.basename(filePath),
    filePath,
    columns,
    rows,
    rowCount: rows.length,
    sheetNames,
    sheetName,
    duplicateColumns: duplicates,
  }
}

function findDuplicates(arr) {
  const seen = new Set()
  const dupes = []
  for (const item of arr) {
    if (seen.has(item)) dupes.push(item)
    else seen.add(item)
  }
  return dupes
}

module.exports = { registerDataImportHandlers }

