const { BrowserWindow, app } = require('electron')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const { getDb } = require('../db/database')

// Active render workers & batch state
const activeWorkers = new Map()
let cancelFlags = new Map()

function getProjectOutputDir(projectId) {
  const userDataPath = app.getPath('userData')
  const dir = path.join(userDataPath, 'projects', projectId, 'output')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function buildHtmlDocument(contentJson, settings, rowData = null) {
  // Parse Tiptap JSON to HTML
  const html = tiptapJsonToHtml(contentJson, rowData)
  const { pageSize, orientation, marginTop, marginRight, marginBottom, marginLeft,
    fontFamily, fontSize, headerText, footerText, showPageNumbers } = settings

  const pageCss = orientation === 'landscape'
    ? '@page { size: A4 landscape; }'
    : `@page { size: ${pageSize || 'A4'}; }`

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  ${pageCss}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ${fontFamily || 'Arial'}, sans-serif;
    font-size: ${fontSize || 12}pt;
    margin: ${marginTop || 20}mm ${marginRight || 20}mm ${marginBottom || 20}mm ${marginLeft || 20}mm;
    color: #000;
    line-height: 1.5;
  }
  h1 { font-size: 2em; margin-bottom: 0.5em; }
  h2 { font-size: 1.5em; margin-bottom: 0.4em; }
  h3 { font-size: 1.25em; margin-bottom: 0.3em; }
  p { margin-bottom: 0.6em; }
  ul, ol { padding-left: 1.5em; margin-bottom: 0.6em; }
  li { margin-bottom: 0.2em; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 0.8em; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
  th { background: #f5f5f5; font-weight: bold; }
  img { max-width: 100%; height: auto; }
  strong { font-weight: bold; }
  em { font-style: italic; }
  u { text-decoration: underline; }
  s { text-decoration: line-through; }
  code { font-family: monospace; background: #f0f0f0; padding: 2px 4px; border-radius: 2px; }
  blockquote { border-left: 3px solid #ccc; padding-left: 1em; color: #555; margin-bottom: 0.6em; }
  .text-left { text-align: left; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .text-justify { text-align: justify; }
  ${showPageNumbers ? `
  @page { margin-bottom: 25mm; }
  body::after {
    content: "Page " counter(page) " of " counter(pages);
    position: fixed;
    bottom: 10mm;
    right: ${marginRight || 20}mm;
    font-size: 10pt;
    color: #666;
  }` : ''}
  ${headerText ? `.page-header { position: fixed; top: 5mm; left: ${marginLeft || 20}mm; right: ${marginRight || 20}mm; font-size: 10pt; color: #666; border-bottom: 1px solid #eee; padding-bottom: 3mm; }` : ''}
  ${footerText ? `.page-footer { position: fixed; bottom: 5mm; left: ${marginLeft || 20}mm; right: ${marginRight || 20}mm; font-size: 10pt; color: #666; border-top: 1px solid #eee; padding-top: 3mm; }` : ''}
</style>
</head>
<body>
  ${headerText ? `<div class="page-header">${escapeHtml(headerText)}</div>` : ''}
  <div class="content">${html}</div>
  ${footerText ? `<div class="page-footer">${escapeHtml(footerText)}</div>` : ''}
</body>
</html>`
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Convert Tiptap JSON to HTML (supports main node types)
function tiptapJsonToHtml(contentJson, rowData = null) {
  let json
  try {
    json = typeof contentJson === 'string' ? JSON.parse(contentJson) : contentJson
  } catch {
    return '<p></p>'
  }
  return renderNode(json, rowData)
}

function renderNode(node, rowData) {
  if (!node) return ''
  if (node.type === 'doc') {
    return (node.content || []).map(n => renderNode(n, rowData)).join('')
  }
  if (node.type === 'paragraph') {
    const align = node.attrs?.textAlign ? ` class="text-${node.attrs.textAlign}"` : ''
    const inner = (node.content || []).map(n => renderNode(n, rowData)).join('') || '<br>'
    return `<p${align}>${inner}</p>`
  }
  if (node.type === 'text') {
    let text = node.text || ''
    // Replace placeholders with row data
    if (rowData) {
      text = text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const val = rowData[key] || rowData[key.toLowerCase()] || ''
        return escapeHtml(String(val))
      })
    } else {
      text = escapeHtml(text)
    }
    // Apply marks
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'bold') text = `<strong>${text}</strong>`
        else if (mark.type === 'italic') text = `<em>${text}</em>`
        else if (mark.type === 'underline') text = `<u>${text}</u>`
        else if (mark.type === 'strike') text = `<s>${text}</s>`
        else if (mark.type === 'code') text = `<code>${text}</code>`
        else if (mark.type === 'textStyle') {
          const style = []
          if (mark.attrs?.color) style.push(`color: ${mark.attrs.color}`)
          if (mark.attrs?.fontFamily) style.push(`font-family: ${mark.attrs.fontFamily}`)
          if (mark.attrs?.fontSize) style.push(`font-size: ${mark.attrs.fontSize}`)
          if (style.length) text = `<span style="${style.join(';')}">${text}</span>`
        }
        else if (mark.type === 'highlight') text = `<mark>${text}</mark>`
        else if (mark.type === 'link') text = `<a href="${escapeHtml(mark.attrs?.href || '')}">${text}</a>`
      }
    }
    return text
  }
  if (node.type === 'heading') {
    const level = node.attrs?.level || 1
    const inner = (node.content || []).map(n => renderNode(n, rowData)).join('')
    return `<h${level}>${inner}</h${level}>`
  }
  if (node.type === 'bulletList') {
    const inner = (node.content || []).map(n => renderNode(n, rowData)).join('')
    return `<ul>${inner}</ul>`
  }
  if (node.type === 'orderedList') {
    const inner = (node.content || []).map(n => renderNode(n, rowData)).join('')
    return `<ol>${inner}</ol>`
  }
  if (node.type === 'listItem') {
    const inner = (node.content || []).map(n => renderNode(n, rowData)).join('')
    return `<li>${inner}</li>`
  }
  if (node.type === 'blockquote') {
    const inner = (node.content || []).map(n => renderNode(n, rowData)).join('')
    return `<blockquote>${inner}</blockquote>`
  }
  if (node.type === 'horizontalRule') return '<hr>'
  if (node.type === 'hardBreak') return '<br>'
  if (node.type === 'image') {
    const { src, alt, title } = node.attrs || {}
    return `<img src="${src || ''}" alt="${alt || ''}" title="${title || ''}">`
  }
  if (node.type === 'table') {
    const inner = (node.content || []).map(n => renderNode(n, rowData)).join('')
    return `<table>${inner}</table>`
  }
  if (node.type === 'tableRow') {
    const inner = (node.content || []).map(n => renderNode(n, rowData)).join('')
    return `<tr>${inner}</tr>`
  }
  if (node.type === 'tableCell') {
    const inner = (node.content || []).map(n => renderNode(n, rowData)).join('')
    return `<td>${inner}</td>`
  }
  if (node.type === 'tableHeader') {
    const inner = (node.content || []).map(n => renderNode(n, rowData)).join('')
    return `<th>${inner}</th>`
  }
  // Fallback: render children
  return (node.content || []).map(n => renderNode(n, rowData)).join('')
}

async function renderSinglePDF(contentJson, settings, rowData, outputPath) {
  return new Promise((resolve, reject) => {
    const html = buildHtmlDocument(contentJson, settings, rowData)

    const win = new BrowserWindow({
      show: false,
      width: 800,
      height: 1100,
      webPreferences: {
        javascript: false,
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    const tmpHtmlPath = outputPath + '.render.html'
    fs.writeFileSync(tmpHtmlPath, html, 'utf-8')

    win.loadFile(tmpHtmlPath)

    win.webContents.once('did-finish-load', async () => {
      try {
        const pdfBuffer = await win.webContents.printToPDF({
          pageSize: settings.pageSize || 'A4',
          landscape: settings.orientation === 'landscape',
          printBackground: true,
          margins: { top: 0, right: 0, bottom: 0, left: 0 },
        })

        const tmpPath = outputPath + '.part'
        fs.writeFileSync(tmpPath, pdfBuffer)
        fs.renameSync(tmpPath, outputPath)
        try { fs.unlinkSync(tmpHtmlPath) } catch {}

        win.destroy()
        resolve({ success: true, outputPath })
      } catch (err) {
        try { fs.unlinkSync(tmpHtmlPath) } catch {}
        win.destroy()
        reject(err)
      }
    })

    win.webContents.once('did-fail-load', (_, code, desc) => {
      try { fs.unlinkSync(tmpHtmlPath) } catch {}
      win.destroy()
      reject(new Error(`Page failed to load: ${desc}`))
    })

    // Timeout
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.destroy()
        try { fs.unlinkSync(tmpHtmlPath) } catch {}
        reject(new Error('Render timeout'))
      }
    }, 30000)
  })
}

function buildFilename(pattern, index, rowData) {
  let name = pattern
    .replace(/{number}/gi, String(index + 1).padStart(3, '0'))
    .replace(/{index}/gi, String(index))

  if (rowData) {
    name = name.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = rowData[key] || rowData[key.toLowerCase()] || ''
      return String(val).replace(/[<>:"/\\|?*]/g, '_').trim()
    })
  }

  // Windows path safety
  name = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim()
  if (!name.toLowerCase().endsWith('.pdf')) name += '.pdf'
  return name
}

function registerPdfHandlers(ipcMain) {
  ipcMain.handle('pdf:generateBatch', async (event, batchConfig) => {
    const db = getDb()
    const {
      projectId, mode, quantity, filenamePattern,
      sourceRevisionId, datasetId, selectedRows, placeholderMap,
      pageSettings
    } = batchConfig

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId)
    if (!project) return { success: false, error: 'Project not found' }

    const revision = db.prepare('SELECT * FROM source_revisions WHERE id = ?').get(sourceRevisionId)
    if (!revision) return { success: false, error: 'Source revision not found' }

    const settings = { ...JSON.parse(project.settings_json || '{}'), ...pageSettings }
    const outputDir = getProjectOutputDir(projectId)

    // Create batch record
    const batchId = uuidv4()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO batches (id, project_id, dataset_id, mode, quantity, status,
        source_revision_id, settings_json, filename_pattern, placeholder_map_json,
        created_at, started_at, total_count)
      VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?, ?, ?, ?, ?)
    `).run(batchId, projectId, datasetId || null, mode, quantity, sourceRevisionId,
      JSON.stringify(settings), filenamePattern || 'Document_{number}.pdf',
      placeholderMap ? JSON.stringify(placeholderMap) : null,
      now, now, quantity)

    // Update project status
    db.prepare('UPDATE projects SET last_batch_status = ?, last_batch_at = ?, updated_at = ? WHERE id = ?')
      .run('running', now, now, projectId)

    // Create pdf_items records
    let rowsData = []
    if (mode === 'personalized' && selectedRows) {
      rowsData = selectedRows
    } else {
      rowsData = Array.from({ length: quantity }, (_, i) => ({ _index: i }))
    }

    const insertItem = db.prepare(`
      INSERT INTO pdf_items (id, batch_id, project_id, item_index, filename, status,
        source_revision_id, row_data_json, row_index)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `)

    for (let i = 0; i < rowsData.length; i++) {
      const rowData = rowsData[i]
      const filename = buildFilename(filenamePattern || 'Document_{number}.pdf', i, rowData)
      insertItem.run(uuidv4(), batchId, projectId, i, filename, sourceRevisionId,
        JSON.stringify(rowData), rowData._rowIndex || i)
    }

    // Start async processing
    cancelFlags.set(batchId, false)
    processBatch(batchId, revision.content_json, settings, outputDir, event.sender)
      .catch(err => {
        console.error('[PDF] Batch error:', err)
        db.prepare("UPDATE batches SET status = 'failed', completed_at = ? WHERE id = ?")
          .run(new Date().toISOString(), batchId)
      })

    return { success: true, batchId }
  })

  ipcMain.handle('pdf:cancelBatch', (_event, batchId) => {
    cancelFlags.set(batchId, true)
    const db = getDb()
    db.prepare("UPDATE batches SET status = 'canceled', completed_at = ? WHERE id = ?")
      .run(new Date().toISOString(), batchId)
    db.prepare("UPDATE pdf_items SET status = 'canceled' WHERE batch_id = ? AND status = 'pending'")
      .run(batchId)
    return { success: true }
  })

  ipcMain.handle('pdf:retryFailed', async (event, batchId) => {
    const db = getDb()
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId)
    if (!batch) return { success: false, error: 'Batch not found' }

    const revision = db.prepare('SELECT * FROM source_revisions WHERE id = ?').get(batch.source_revision_id)
    const settings = JSON.parse(batch.settings_json || '{}')
    const outputDir = getProjectOutputDir(batch.project_id)

    // Reset failed items to pending
    db.prepare("UPDATE pdf_items SET status = 'pending', error_message = NULL WHERE batch_id = ? AND status = 'failed'")
      .run(batchId)
    db.prepare("UPDATE batches SET status = 'running' WHERE id = ?").run(batchId)

    cancelFlags.set(batchId, false)
    processBatch(batchId, revision.content_json, settings, outputDir, event.sender)
    return { success: true }
  })

  ipcMain.handle('pdf:getBatches', (_event, projectId) => {
    const db = getDb()
    const batches = db.prepare(`
      SELECT * FROM batches WHERE project_id = ? ORDER BY created_at DESC LIMIT 20
    `).all(projectId)
    return { success: true, batches }
  })

  ipcMain.handle('pdf:getBatchItems', (_event, batchId) => {
    const db = getDb()
    const items = db.prepare('SELECT * FROM pdf_items WHERE batch_id = ? ORDER BY item_index').all(batchId)
    return { success: true, items }
  })

  ipcMain.handle('pdf:getPreviewData', (_event, projectId, rowData) => {
    const db = getDb()
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId)
    if (!project) return { success: false, error: 'Project not found' }

    const revision = db.prepare(`
      SELECT * FROM source_revisions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(projectId)
    if (!revision) return { success: false, error: 'No content found' }

    const settings = JSON.parse(project.settings_json || '{}')
    const html = buildHtmlDocument(revision.content_json, settings, rowData)
    return { success: true, html, contentJson: revision.content_json, settings }
  })
}

async function processBatch(batchId, contentJson, settings, outputDir, sender) {
  const db = getDb()
  // Reduce concurrent workers to 1 on normal mode to prevent system hang
  // User can increase in Settings > Low Memory Mode
  const maxWorkers = (settings.lowMemoryMode || settings.low_memory_mode) ? 1 : (settings.maxConcurrentWorkers || settings.max_concurrent_workers || 1)

  const pendingItems = db.prepare(`
    SELECT * FROM pdf_items WHERE batch_id = ? AND status = 'pending' ORDER BY item_index
  `).all(batchId)

  let idx = 0
  let activeCount = 0
  let doneCount = 0
  let failedCount = 0

  const totalItems = pendingItems.length

  function sendProgress() {
    try {
      sender.send('batch:progress', {
        batchId, total: totalItems, done: doneCount, failed: failedCount,
        active: activeCount, pending: totalItems - doneCount - failedCount - activeCount
      })
    } catch {}
  }

  return new Promise((resolve) => {
    function processNext() {
      if (cancelFlags.get(batchId)) {
        if (activeCount === 0) {
          db.prepare("UPDATE batches SET status = 'canceled', completed_at = ? WHERE id = ?")
            .run(new Date().toISOString(), batchId)
          try { sender.send('batch:canceled', { batchId }) } catch {}
          resolve()
        }
        return
      }

      while (activeCount < maxWorkers && idx < pendingItems.length) {
        const item = pendingItems[idx++]
        activeCount++

        const rowData = item.row_data_json ? JSON.parse(item.row_data_json) : null
        const outputPath = path.join(outputDir, item.filename)

        db.prepare("UPDATE pdf_items SET status = 'processing' WHERE id = ?").run(item.id)
        sendProgress()

        // Small stagger delay (200ms) between starting each render
        // to prevent simultaneous BrowserWindow creation from hanging the system
        const staggerDelay = (activeCount - 1) * 200

        new Promise(res => setTimeout(res, staggerDelay))
          .then(() => renderSinglePDF(contentJson, settings, rowData, outputPath))
          .then(() => {
            const now = new Date().toISOString()
            db.prepare(`
              UPDATE pdf_items SET status = 'done', file_path = ?, generated_at = ? WHERE id = ?
            `).run(outputPath, now, item.id)
            doneCount++
            activeCount--

            db.prepare('UPDATE batches SET done_count = ? WHERE id = ?').run(doneCount, batchId)
            try { sender.send('batch:itemDone', { batchId, itemId: item.id, filename: item.filename }) } catch {}
            sendProgress()

            if (doneCount + failedCount >= totalItems) {
              finishBatch()
            } else {
              processNext()
            }
          })
          .catch((err) => {
            db.prepare(`
              UPDATE pdf_items SET status = 'failed', error_message = ? WHERE id = ?
            `).run(err.message, item.id)
            failedCount++
            activeCount--

            db.prepare('UPDATE batches SET failed_count = ? WHERE id = ?').run(failedCount, batchId)
            try { sender.send('batch:itemFailed', { batchId, itemId: item.id, filename: item.filename, error: err.message }) } catch {}
            sendProgress()

            if (doneCount + failedCount >= totalItems) {
              finishBatch()
            } else {
              processNext()
            }
          })
      }
    }

    function finishBatch() {
      const status = failedCount === totalItems ? 'failed' : (failedCount > 0 ? 'done' : 'done')
      const now = new Date().toISOString()
      db.prepare("UPDATE batches SET status = ?, completed_at = ?, done_count = ?, failed_count = ? WHERE id = ?")
        .run(status, now, doneCount, failedCount, batchId)
      db.prepare('UPDATE projects SET last_batch_status = ?, last_batch_at = ? WHERE id = (SELECT project_id FROM batches WHERE id = ?)')
        .run(status, now, batchId)
      cancelFlags.delete(batchId)

      try {
        sender.send('batch:complete', { batchId, total: totalItems, done: doneCount, failed: failedCount })
      } catch {}
      resolve()
    }

    processNext()
  })
}

module.exports = { registerPdfHandlers, buildHtmlDocument, tiptapJsonToHtml }

