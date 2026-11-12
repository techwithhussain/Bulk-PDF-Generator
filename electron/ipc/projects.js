const { v4: uuidv4 } = require('uuid')
const { getDb } = require('../db/database')

function registerProjectHandlers(ipcMain) {
  // Create a new project
  ipcMain.handle('projects:create', (_event, data) => {
    const db = getDb()
    const id = uuidv4()
    const now = new Date().toISOString()
    const defaultSettings = {
      pageSize: data.pageSize || 'A4',
      orientation: data.orientation || 'portrait',
      marginTop: 20, marginRight: 20, marginBottom: 20, marginLeft: 20,
      fontFamily: 'Arial', fontSize: 12,
      headerText: '', footerText: '', showPageNumbers: false,
    }
    db.prepare(`
      INSERT INTO projects (id, name, mode, created_at, updated_at, settings_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.mode, now, now, JSON.stringify(defaultSettings))

    // Create initial empty revision
    const revId = uuidv4()
    const emptyContent = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }]
    })
    db.prepare(`
      INSERT INTO source_revisions (id, project_id, content_json, created_at, label)
      VALUES (?, ?, ?, ?, ?)
    `).run(revId, id, emptyContent, now, 'initial')

    return { success: true, project: db.prepare('SELECT * FROM projects WHERE id = ?').get(id) }
  })

  // Get single project
  ipcMain.handle('projects:get', (_event, id) => {
    const db = getDb()
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
    if (!project) return { success: false, error: 'Project not found' }

    // Get latest revision
    const revision = db.prepare(`
      SELECT * FROM source_revisions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(id)

    // Get latest dataset if personalized
    const dataset = project.mode === 'personalized'
      ? db.prepare('SELECT * FROM datasets WHERE project_id = ? ORDER BY imported_at DESC LIMIT 1').get(id)
      : null

    return { success: true, project, revision, dataset }
  })

  // List all projects
  ipcMain.handle('projects:list', (_event) => {
    const db = getDb()
    const projects = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM batches b WHERE b.project_id = p.id) as batch_count,
        (SELECT COUNT(*) FROM pdf_items pi WHERE pi.project_id = p.id AND pi.status = 'done') as pdf_count
      FROM projects p
      ORDER BY p.updated_at DESC
      LIMIT 50
    `).all()
    return { success: true, projects }
  })

  // Update project settings
  ipcMain.handle('projects:update', (_event, id, data) => {
    const db = getDb()
    const now = new Date().toISOString()
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
    if (!project) return { success: false, error: 'Project not found' }

    if (data.name !== undefined) {
      db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?').run(data.name, now, id)
    }
    if (data.settings !== undefined) {
      const existing = JSON.parse(project.settings_json || '{}')
      const merged = { ...existing, ...data.settings }
      db.prepare('UPDATE projects SET settings_json = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(merged), now, id)
    }
    return { success: true }
  })

  // Delete project
  ipcMain.handle('projects:delete', (_event, id) => {
    const db = getDb()
    db.prepare('DELETE FROM projects WHERE id = ?').run(id)
    return { success: true }
  })

  // Save editor content (autosave / manual snapshot)
  ipcMain.handle('projects:saveContent', (_event, projectId, contentJson, label = 'autosave') => {
    const db = getDb()
    const now = new Date().toISOString()
    const revId = uuidv4()

    db.prepare(`
      INSERT INTO source_revisions (id, project_id, content_json, created_at, label)
      VALUES (?, ?, ?, ?, ?)
    `).run(revId, projectId, contentJson, now, label)

    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, projectId)

    // Keep max 20 autosave revisions per project (keep all manual ones)
    const autosaves = db.prepare(`
      SELECT id FROM source_revisions
      WHERE project_id = ? AND label = 'autosave'
      ORDER BY created_at DESC
    `).all(projectId)

    if (autosaves.length > 20) {
      const toDelete = autosaves.slice(20).map(r => r.id)
      const placeholders = toDelete.map(() => '?').join(',')
      db.prepare(`DELETE FROM source_revisions WHERE id IN (${placeholders})`).run(...toDelete)
    }

    return { success: true, revisionId: revId }
  })

  // Get revision history
  ipcMain.handle('projects:getRevisions', (_event, projectId) => {
    const db = getDb()
    const revisions = db.prepare(`
      SELECT id, project_id, created_at, label, description
      FROM source_revisions
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(projectId)
    return { success: true, revisions }
  })

  // Restore a revision
  ipcMain.handle('projects:restoreRevision', (_event, revisionId) => {
    const db = getDb()
    const revision = db.prepare('SELECT * FROM source_revisions WHERE id = ?').get(revisionId)
    if (!revision) return { success: false, error: 'Revision not found' }

    // Create a new revision with label 'restored'
    const now = new Date().toISOString()
    const newRevId = uuidv4()
    db.prepare(`
      INSERT INTO source_revisions (id, project_id, content_json, created_at, label, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(newRevId, revision.project_id, revision.content_json, now, 'restored',
      `Restored from revision ${revisionId}`)

    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, revision.project_id)
    return { success: true, revisionId: newRevId, contentJson: revision.content_json }
  })

  // Library handlers
  ipcMain.handle('library:getItems', (_event, projectId) => {
    const db = getDb()
    const items = db.prepare(`
      SELECT pi.*, b.filename_pattern
      FROM pdf_items pi
      JOIN batches b ON b.id = pi.batch_id
      WHERE pi.project_id = ?
      ORDER BY pi.generated_at DESC
    `).all(projectId)
    return { success: true, items }
  })

  ipcMain.handle('library:getAllItems', (_event) => {
    const db = getDb()
    const items = db.prepare(`
      SELECT pi.*, p.name as project_name, b.mode as batch_mode
      FROM pdf_items pi
      JOIN batches b ON b.id = pi.batch_id
      JOIN projects p ON p.id = pi.project_id
      WHERE pi.status = 'done'
      ORDER BY pi.generated_at DESC
      LIMIT 500
    `).all()
    return { success: true, items }
  })

  ipcMain.handle('library:renameItem', (_event, itemId, newFilename) => {
    const db = getDb()
    db.prepare('UPDATE pdf_items SET filename = ? WHERE id = ?').run(newFilename, itemId)
    return { success: true }
  })

  ipcMain.handle('library:deleteItem', (_event, itemId) => {
    const db = getDb()
    const item = db.prepare('SELECT * FROM pdf_items WHERE id = ?').get(itemId)
    if (item && item.file_path) {
      const fs = require('fs')
      try { fs.unlinkSync(item.file_path) } catch {}
    }
    db.prepare('DELETE FROM pdf_items WHERE id = ?').run(itemId)
    return { success: true }
  })

  ipcMain.handle('library:openContainingFolder', (_event, itemId) => {
    const db = getDb()
    const { shell } = require('electron')
    const item = db.prepare('SELECT * FROM pdf_items WHERE id = ?').get(itemId)
    if (item && item.file_path) {
      shell.showItemInFolder(item.file_path)
    }
    return { success: true }
  })
}

module.exports = { registerProjectHandlers }

