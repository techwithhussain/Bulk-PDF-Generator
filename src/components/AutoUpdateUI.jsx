import { useAutoUpdate } from '../hooks/useAutoUpdate'

// ── Force Update Screen (Mandatory) ──────────────────────────────────────────
export function ForceUpdateScreen({ config }) {
  const { available, version, downloading, progress, downloaded, startDownload, installNow } = useAutoUpdate(config)

  // Only show if force_update=true AND update is available
  const force = config?.force_update === true || config?.force_update === 'true'
  if (!force || !available) return null

  return (
    <div className="fixed inset-0 z-[99998] flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}>
      <div className="text-center text-white p-8 max-w-md w-full mx-4">
        <div className="text-6xl mb-4">🚀</div>
        <h1 className="text-2xl font-bold mb-2">Update Required</h1>
        <p className="text-gray-400 text-sm mb-6">
          Version <strong className="text-white">v{version}</strong> is required to continue using Local PDF Studio.
        </p>

        {!downloading && !downloaded && (
          <button
            onClick={startDownload}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
          >
            Download Update
          </button>
        )}

        {downloading && !downloaded && (
          <div className="space-y-3">
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-gray-400 text-sm">Downloading... {progress}%</p>
          </div>
        )}

        {downloaded && (
          <button
            onClick={installNow}
            className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
          >
            🔄 Restart & Install Update
          </button>
        )}

        <p className="text-gray-600 text-xs mt-6">Local PDF Studio</p>
      </div>
    </div>
  )
}

// ── Optional Update Banner ────────────────────────────────────────────────────
export function UpdateToastBanner({ config }) {
  const {
    available, version, downloading, progress,
    downloaded, forceUpdate, startDownload, installNow
  } = useAutoUpdate(config)

  // Don't show if force update (ForceUpdateScreen handles it)
  // Don't show if no update
  if (!available || forceUpdate) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2 text-xs font-medium border-b
      bg-indigo-50 border-indigo-200 text-indigo-900 flex-shrink-0">
      <span>🆕</span>
      <span className="flex-1">
        <strong>v{version}</strong> available
        {downloading && !downloaded && (
          <span className="ml-2 text-indigo-600">— Downloading {progress}%</span>
        )}
        {downloaded && (
          <span className="ml-2 text-green-700 font-semibold">— Ready to install!</span>
        )}
      </span>

      {/* Progress bar during download */}
      {downloading && !downloaded && (
        <div className="w-24 bg-indigo-200 rounded-full h-1.5">
          <div
            className="bg-indigo-600 h-1.5 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Buttons */}
      {!downloading && !downloaded && (
        <button
          onClick={startDownload}
          className="px-3 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold
            hover:bg-indigo-700 transition-colors flex-shrink-0"
        >
          Download
        </button>
      )}

      {downloaded && (
        <button
          onClick={installNow}
          className="px-3 py-1 rounded-full bg-green-600 text-white text-[10px] font-bold
            hover:bg-green-700 transition-colors flex-shrink-0"
        >
          Restart & Install
        </button>
      )}
    </div>
  )
}

