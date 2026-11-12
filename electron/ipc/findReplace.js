const { v4: uuidv4 } = require('uuid')
const { getDb } = require('../db/database')

function registerFindReplaceHandlers(ipcMain) {
  /**
   * Preview Find & Replace — returns match count without modifying content
   */
  ipcMain.handle('findReplace:preview', (_event, params) => {
    const { projectId, findText, replaceText, scope, matchCase, wholeWord } = params
    const db = getDb()

    if (!findText || findText.trim() === '') {
      return { success: false, error: 'Find text cannot be empty' }
    }

    // Get the latest revision content
    const revision = db.prepare(`
      SELECT * FROM source_revisions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(projectId)

    if (!revision) return { success: false, error: 'No content found for this project' }

    let contentJson
    try {
      contentJson = JSON.parse(revision.content_json)
    } catch {
      return { success: false, error: 'Could not parse document content' }
    }

    const { count, matches } = findMatchesInJson(contentJson, findText, matchCase, wholeWord)

    if (count === 0) {
      return { success: true, count: 0, message: 'No matches found', affectedPdfs: 0 }
    }

    // Count affected PDFs based on scope
    let affectedPdfs = 0
    if (scope === 'master') {
      // All PDFs using the master content (not customized)
      affectedPdfs = db.prepare(`
        SELECT COUNT(*) as cnt FROM pdf_items
        WHERE project_id = ? AND status = 'done' AND is_customized = 0
      `).get(projectId)?.cnt || 0
    } else if (scope === 'all') {
      affectedPdfs = db.prepare(`
        SELECT COUNT(*) as cnt FROM pdf_items WHERE project_id = ? AND status = 'done'
      `).get(projectId)?.cnt || 0
    }

    return { success: true, count, affectedPdfs, matches: matches.slice(0, 20), revisionId: revision.id }
  })

  /**
   * Apply Find & Replace — modifies source content, creates snapshot, marks PDFs outdated
   */
  ipcMain.handle('findReplace:apply', (_event, params) => {
    const { projectId, findText, replaceText, scope, matchCase, wholeWord, confirmed } = params
    const db = getDb()

    if (!confirmed) {
      return { success: false, error: 'Confirmation required before applying replacement' }
    }

    const revision = db.prepare(`
      SELECT * FROM source_revisions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(projectId)

    if (!revision) return { success: false, error: 'No content found' }

    let contentJson
    try {
      contentJson = JSON.parse(revision.content_json)
    } catch {
      return { success: false, error: 'Could not parse document content' }
    }

    const { count } = findMatchesInJson(contentJson, findText, matchCase, wholeWord)
    if (count === 0) {
      return { success: true, count: 0, message: 'No matches found, no changes made' }
    }

    // Apply replacements
    const updatedContent = replaceInJson(contentJson, findText, replaceText, matchCase, wholeWord)

    // Create new revision snapshot
    const now = new Date().toISOString()
    // Use +1ms for the new revision so ORDER BY created_at DESC always picks it first
    const nowPlus1 = new Date(Date.now() + 1).toISOString()
    const newRevId = uuidv4()
    db.prepare(`
      INSERT INTO source_revisions (id, project_id, content_json, created_at, label, description)
      VALUES (?, ?, ?, ?, 'pre-replace', ?)
    `).run(uuidv4(), projectId, revision.content_json, now, `Before replacing "${findText}" with "${replaceText}"`)

    db.prepare(`
      INSERT INTO source_revisions (id, project_id, content_json, created_at, label, description)
      VALUES (?, ?, ?, ?, 'replace', ?)
    `).run(newRevId, projectId, JSON.stringify(updatedContent), nowPlus1,
      `Replaced "${findText}" with "${replaceText}" (${count} matches, scope: ${scope})`)

    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, projectId)

    // Mark affected PDFs as outdated
    let affectedPdfs = 0
    if (scope === 'master' || scope === 'all') {
      const result = db.prepare(`
        UPDATE pdf_items SET is_outdated = 1
        WHERE project_id = ? AND status = 'done'
        ${scope === 'master' ? 'AND is_customized = 0' : ''}
      `).run(projectId)
      affectedPdfs = result.changes
    }

    // Record replace event
    const eventId = uuidv4()
    db.prepare(`
      INSERT INTO replace_events (id, project_id, find_text, replace_text, scope,
        match_count, affected_pdfs, before_revision_id, after_revision_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, projectId, findText, replaceText, scope, count, affectedPdfs,
      revision.id, newRevId, now)

    return {
      success: true,
      count,
      affectedPdfs,
      newRevisionId: newRevId,
      newContentJson: JSON.stringify(updatedContent),
    }
  })

  ipcMain.handle('findReplace:getHistory', (_event, projectId) => {
    const db = getDb()
    const events = db.prepare(`
      SELECT * FROM replace_events WHERE project_id = ? ORDER BY created_at DESC LIMIT 50
    `).all(projectId)
    return { success: true, events }
  })
}

/**
 * Find text matches within a Tiptap JSON document.
 * Returns count and array of match descriptors.
 */
function findMatchesInJson(node, findText, matchCase, wholeWord) {
  let count = 0
  const matches = []

  function searchNode(n, path = []) {
    if (!n) return
    if (n.type === 'text' && n.text) {
      const haystack = matchCase ? n.text : n.text.toLowerCase()
      const needle = matchCase ? findText : findText.toLowerCase()
      let idx = 0
      while (true) {
        const pos = haystack.indexOf(needle, idx)
        if (pos === -1) break
        if (wholeWord) {
          const before = pos > 0 ? haystack[pos - 1] : ' '
          const after = pos + needle.length < haystack.length ? haystack[pos + needle.length] : ' '
          const isWord = /\W/.test(before) && /\W/.test(after)
          if (!isWord) { idx = pos + 1; continue }
        }
        count++
        matches.push({ path: path.join('.'), position: pos, text: n.text.substr(pos, needle.length) })
        idx = pos + needle.length
      }
    }
    if (n.content) {
      n.content.forEach((child, i) => searchNode(child, [...path, i]))
    }
  }

  searchNode(node)
  return { count, matches }
}

/**
 * Replace all matches in Tiptap JSON, returns new document.
 */
function replaceInJson(node, findText, replaceText, matchCase, wholeWord) {
  if (!node) return node

  if (node.type === 'text' && node.text) {
    const flags = matchCase ? 'g' : 'gi'
    let pattern = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (wholeWord) pattern = `\\b${pattern}\\b`
    const regex = new RegExp(pattern, flags)
    const newText = node.text.replace(regex, replaceText)
    if (newText === node.text) return node
    return { ...node, text: newText }
  }

  if (node.content) {
    const newContent = node.content.map(child => replaceInJson(child, findText, replaceText, matchCase, wholeWord))
    const changed = newContent.some((n, i) => n !== node.content[i])
    if (!changed) return node
    return { ...node, content: newContent }
  }

  return node
}

module.exports = { registerFindReplaceHandlers }

