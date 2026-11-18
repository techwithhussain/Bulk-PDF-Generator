'use strict'

const https = require('https')
const http = require('http')
const { app } = require('electron')

// Same GAS URL as license — config action added
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyB9vYTOsN119gWXqXIILdmk3yIkgD5fEwnS4zbfLfkLnPBxbVVFLtoZdY3LX63GM6L/exec'

// Cached config (so we don't fetch every IPC call)
let cachedConfig = null
let lastFetchTime = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Default config (offline fallback)
const DEFAULT_CONFIG = {
  latest_version: app.getVersion(),
  download_url: '',
  force_update: false,
  maintenance_mode: false,
  maintenance_message: '',
  announcement: '',
  announcement_type: 'info', // info | warning | success
  features: {},
}

// Fetch config from Google Sheet via GAS
async function fetchRemoteConfig() {
  try {
    const url = `${GAS_URL}?action=getConfig`
    const result = await fetchUrl(url)
    const data = JSON.parse(result)

    if (data && data.success) {
      cachedConfig = { ...DEFAULT_CONFIG, ...data.config }
      lastFetchTime = Date.now()
      return cachedConfig
    }
    return cachedConfig || DEFAULT_CONFIG
  } catch (err) {
    console.log('[RemoteConfig] Fetch failed (offline?):', err.message)
    return cachedConfig || DEFAULT_CONFIG
  }
}

// Get config (use cache if fresh)
async function getConfig() {
  const now = Date.now()
  if (cachedConfig && (now - lastFetchTime) < CACHE_TTL) {
    return cachedConfig
  }
  return fetchRemoteConfig()
}

function registerRemoteConfigHandlers(ipcMain) {
  // Get current config
  ipcMain.handle('remoteConfig:get', async () => {
    try {
      return await getConfig()
    } catch {
      return DEFAULT_CONFIG
    }
  })

  // Force refresh
  ipcMain.handle('remoteConfig:refresh', async () => {
    lastFetchTime = 0 // invalidate cache
    return fetchRemoteConfig()
  })
}

// HTTP/HTTPS fetch (reused from license.js pattern)
function fetchUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'))
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, { timeout: 10000 }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume()
        return fetchUrl(res.headers.location, maxRedirects - 1).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve(data))
    })
    req.on('error', (err) => {
      if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') reject(new Error('NO_INTERNET'))
      else reject(err)
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('NO_INTERNET')) })
  })
}

module.exports = { registerRemoteConfigHandlers, getConfig, fetchRemoteConfig }

