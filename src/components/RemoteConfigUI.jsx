import { useState } from 'react'
import { isNewerVersion } from '../hooks/useRemoteConfig'

const CURRENT_VERSION = '1.3.0'

// ── Announcement Banner ─────────────────────────────────────────────────────
export function AnnouncementBanner({ config }) {
  const [dismissed, setDismissed] = useState(false)

  if (!config?.announcement || dismissed) return null

  const typeStyles = {
    info:    { bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-800',  icon: 'ℹ️' },
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-900', icon: '⚠️' },
    success: { bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-800', icon: '✅' },
    error:   { bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-800',   icon: '🚨' },
  }

  const style = typeStyles[config.announcement_type] || typeStyles.info

  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-xs font-medium border-b ${style.bg} ${style.border} ${style.text} flex-shrink-0`}>
      <span>{style.icon}</span>
      <span className="flex-1">{config.announcement}</span>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 opacity-50 hover:opacity-100 transition-opacity text-sm leading-none"
        title="Dismiss"
      >✕</button>
    </div>
  )
}

// ── Update Available Banner ─────────────────────────────────────────────────
export function UpdateBanner({ config }) {
  const [dismissed, setDismissed] = useState(false)

  const hasUpdate = isNewerVersion(config?.latest_version, CURRENT_VERSION)
  if (!hasUpdate || dismissed) return null

  function handleDownload() {
    if (config.download_url) {
      window.open(config.download_url, '_blank')
    }
  }

  if (config.force_update) {
    // Force update — cannot dismiss
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b bg-orange-50 border-orange-300 text-orange-900 flex-shrink-0">
        <span>🔄</span>
        <span className="flex-1">
          New version <strong>v{config.latest_version}</strong> is required. Please update to continue.
        </span>
        {config.download_url && (
          <button
            onClick={handleDownload}
            className="px-3 py-1 rounded-full bg-orange-600 text-white text-[10px] font-bold hover:bg-orange-700 transition-colors flex-shrink-0"
          >
            Download Update
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium border-b bg-blue-50 border-blue-200 text-blue-800 flex-shrink-0">
      <span>🆕</span>
      <span className="flex-1">
        Update available: <strong>v{config.latest_version}</strong>
      </span>
      {config.download_url && (
        <button
          onClick={handleDownload}
          className="px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 transition-colors flex-shrink-0"
        >
          Download
        </button>
      )}
      <button
        onClick={() => setDismissed(true)}
        className="opacity-40 hover:opacity-70 transition-opacity"
        title="Dismiss"
      >✕</button>
    </div>
  )
}

// ── Maintenance Mode Screen ─────────────────────────────────────────────────
export function MaintenanceScreen({ config }) {
  if (!config?.maintenance_mode) return null

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)' }}>
      <div className="text-center text-white p-8 max-w-md">
        <div className="text-6xl mb-4">🔧</div>
        <h1 className="text-2xl font-bold mb-2">Under Maintenance</h1>
        <p className="text-blue-200 text-sm">
          {config.maintenance_message || 'We\'re making improvements. Please check back shortly.'}
        </p>
        <p className="text-blue-300 text-xs mt-4">Local PDF Studio</p>
      </div>
    </div>
  )
}

