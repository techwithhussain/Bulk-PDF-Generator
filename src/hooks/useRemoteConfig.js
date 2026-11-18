import { useState, useEffect, useCallback } from 'react'

// Default config (shown while loading)
const DEFAULT_CONFIG = {
  latest_version: '1.2.0',
  download_url: '',
  force_update: false,
  maintenance_mode: false,
  maintenance_message: '',
  announcement: '',
  announcement_type: 'info',
  features: {},
}

export function useRemoteConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)

  const loadConfig = useCallback(async () => {
    try {
      if (!window.api?.remoteConfig) return
      const data = await window.api.remoteConfig.get()
      if (data) setConfig(data)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    loadConfig()

    // Listen for config pushed from main process on startup
    const unsub = window.api?.on?.('remoteConfig:loaded', (data) => {
      if (data) setConfig(data)
      setLoading(false)
    })

    // Re-check every 10 minutes while app is open
    const interval = setInterval(loadConfig, 10 * 60 * 1000)

    return () => {
      if (typeof unsub === 'function') unsub()
      clearInterval(interval)
    }
  }, [loadConfig])

  const refresh = useCallback(async () => {
    try {
      if (!window.api?.remoteConfig) return
      const data = await window.api.remoteConfig.refresh()
      if (data) setConfig(data)
    } catch {}
  }, [])

  return { config, loading, refresh }
}

// Helper: compare version strings "1.2.0" vs "1.3.0"
export function isNewerVersion(latest, current) {
  if (!latest || !current) return false
  const a = latest.split('.').map(Number)
  const b = current.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true
    if ((a[i] || 0) < (b[i] || 0)) return false
  }
  return false
}

