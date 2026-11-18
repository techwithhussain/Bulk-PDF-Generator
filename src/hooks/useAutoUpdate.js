import { useState, useEffect, useCallback } from 'react'

// ── Auto Update Hook ──────────────────────────────────────────────────────────
export function useAutoUpdate(config) {
  const [state, setState] = useState({
    checking: false,
    available: false,
    version: null,
    downloading: false,
    progress: 0,
    downloaded: false,
    error: null,
    forceUpdate: false,
  })

  // Listen to main process updater events
  useEffect(() => {
    if (!window.api?.on) return

    const unsubs = [
      window.api.on('updater:checking', () =>
        setState(s => ({ ...s, checking: true, error: null }))),

      window.api.on('updater:available', (info) =>
        setState(s => ({
          ...s,
          checking: false,
          available: true,
          version: info.version,
        }))),

      window.api.on('updater:not-available', () =>
        setState(s => ({ ...s, checking: false }))),

      window.api.on('updater:progress', (data) =>
        setState(s => ({ ...s, downloading: true, progress: data.percent }))),

      window.api.on('updater:downloaded', () =>
        setState(s => ({ ...s, downloading: false, downloaded: true, progress: 100 }))),

      window.api.on('updater:error', (msg) =>
        setState(s => ({ ...s, checking: false, downloading: false, error: msg }))),
    ]

    return () => unsubs.forEach(fn => typeof fn === 'function' && fn())
  }, [])

  // Sync force_update from remote config
  useEffect(() => {
    const force = config?.force_update === true || config?.force_update === 'true'
    setState(s => ({ ...s, forceUpdate: force }))
  }, [config?.force_update])

  const startDownload = useCallback(async () => {
    setState(s => ({ ...s, downloading: true, progress: 0 }))
    await window.api?.updater?.download?.()
  }, [])

  const installNow = useCallback(() => {
    window.api?.updater?.install?.()
  }, [])

  return { ...state, startDownload, installNow }
}

