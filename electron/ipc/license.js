const { getDb } = require('../db/database')
const https = require('https')
const http = require('http')
const crypto = require('crypto')

// ── Google Apps Script Web App URL ──────────────────────────────────────────
const VALIDATION_URL = 'https://script.google.com/macros/s/AKfycbyB9vYTOsN119gWXqXIILdmk3yIkgD5fEwnS4zbfLfkLnPBxbVVFLtoZdY3LX63GM6L/exec'

// ── Get or create a persistent machine ID ───────────────────────────────────
function getMachineId(db) {
  try {
    const row = db.prepare(`SELECT value FROM app_settings WHERE key = 'machine_id'`).get()
    if (row && row.value) return row.value

    // Generate a new UUID for this machine
    const id = crypto.randomUUID()
    db.prepare(`INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('machine_id', ?, ?)`)
      .run(id, new Date().toISOString())
    return id
  } catch {
    return 'unknown-machine'
  }
}

function registerLicenseHandlers(ipcMain) {

  // Check if already activated locally
  ipcMain.handle('license:checkLocal', () => {
    try {
      const db = getDb()
      const row = db.prepare(`SELECT value FROM app_settings WHERE key = 'license_status'`).get()
      const key = db.prepare(`SELECT value FROM app_settings WHERE key = 'license_key'`).get()
      if (row && row.value === 'active') {
        return { activated: true, key: key?.value || '' }
      }
      return { activated: false }
    } catch {
      return { activated: false }
    }
  })

  // Online re-verify on every launch (Option A)
  // Returns: { valid, status, reason }
  ipcMain.handle('license:verifyOnline', async () => {
    try {
      const db = getDb()
      const keyRow = db.prepare(`SELECT value FROM app_settings WHERE key = 'license_key'`).get()
      if (!keyRow || !keyRow.value) return { valid: false, reason: 'no_key' }

      const machineId = getMachineId(db)
      const key = keyRow.value
      const url = `${VALIDATION_URL}?key=${encodeURIComponent(key)}&machineId=${encodeURIComponent(machineId)}`

      const result = await fetchUrl(url)
      const data = JSON.parse(result)

      if (data.valid && data.status === 'active') {
        // Still valid — keep local activation
        return { valid: true, status: 'active' }

      } else if (data.status === 'blocked') {
        // Owner blocked this key — clear local activation!
        db.prepare(`DELETE FROM app_settings WHERE key IN ('license_status','license_key','license_activated_at','license_user')`).run()
        return { valid: false, status: 'blocked', reason: 'Your license has been revoked. Contact Tech With Hussain.' }

      } else if (data.status === 'machine_mismatch') {
        // Machine changed without transfer — block
        db.prepare(`DELETE FROM app_settings WHERE key IN ('license_status','license_key','license_activated_at','license_user')`).run()
        return { valid: false, status: 'machine_mismatch', reason: 'License transferred to another PC. Contact Tech With Hussain.' }

      } else {
        // Key not found in sheet anymore — revoke
        db.prepare(`DELETE FROM app_settings WHERE key IN ('license_status','license_key','license_activated_at','license_user')`).run()
        return { valid: false, status: 'not_found', reason: 'License key not found. Contact Tech With Hussain.' }
      }

    } catch (err) {
      // No internet — allow offline (grace mode)
      if (err.message === 'NO_INTERNET') {
        return { valid: true, status: 'offline', reason: 'offline_grace' }
      }
      // Other error — allow offline
      return { valid: true, status: 'offline', reason: 'verify_error' }
    }
  })

  // Validate key online → save locally if valid
  ipcMain.handle('license:activate', async (_event, licenseKey) => {
    if (!licenseKey || licenseKey.trim() === '') {
      return { success: false, error: 'Please enter a license key' }
    }

    const key = licenseKey.trim().toUpperCase()
    const db = getDb()
    const machineId = getMachineId(db)

    // Call Google Apps Script to validate (with machine ID)
    try {
      const url = `${VALIDATION_URL}?key=${encodeURIComponent(key)}&machineId=${encodeURIComponent(machineId)}`
      const result = await fetchUrl(url)
      const data = JSON.parse(result)

      if (data.valid && data.status === 'active') {
        // Save activation locally
        const now = new Date().toISOString()
        db.prepare(`INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('license_status', 'active', ?)`).run(now)
        db.prepare(`INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('license_key', ?, ?)`).run(key, now)
        db.prepare(`INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('license_activated_at', ?, ?)`).run(now, now)
        db.prepare(`INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('license_user', ?, ?)`).run(data.userName || '', now)

        return { success: true, userName: data.userName || '' }

      } else if (data.status === 'machine_mismatch') {
        return { success: false, error: 'This key is already activated on another PC. Contact Tech With Hussain to transfer.' }

      } else if (data.status === 'blocked') {
        return { success: false, error: 'This license key has been blocked. Contact Tech With Hussain.' }

      } else if (data.status === 'expired') {
        return { success: false, error: 'This license key has expired. Contact Tech With Hussain.' }

      } else {
        return { success: false, error: 'Invalid license key. Please check and try again.' }
      }

    } catch (err) {
      if (err.message === 'NO_INTERNET') {
        return { success: false, error: 'No internet connection. Please connect to internet for first-time activation.' }
      }
      return { success: false, error: 'Could not verify key. Check your internet connection.' }
    }
  })

  // Deactivate (for testing / transfer)
  ipcMain.handle('license:deactivate', () => {
    try {
      const db = getDb()
      db.prepare(`DELETE FROM app_settings WHERE key IN ('license_status','license_key','license_activated_at','license_user')`).run()
      return { success: true }
    } catch {
      return { success: false }
    }
  })
}

// HTTP/HTTPS fetch with redirect support (Google Apps Script returns 302)
function fetchUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects'))
    }

    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, { timeout: 15000 }, (res) => {
      // Follow redirects (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirectUrl = res.headers.location
        res.resume()
        return fetchUrl(redirectUrl, maxRedirects - 1).then(resolve).catch(reject)
      }

      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve(data))
    })

    req.on('error', (err) => {
      if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
        reject(new Error('NO_INTERNET'))
      } else {
        reject(err)
      }
    })
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('NO_INTERNET'))
    })
  })
}

module.exports = { registerLicenseHandlers }
