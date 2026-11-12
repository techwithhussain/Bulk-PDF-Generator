import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useAppStore from '../store/appStore'

const PAGE_SIZES = ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid']
const FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Helvetica', 'Calibri', 'Verdana', 'Tahoma', 'Courier New']

export default function Settings() {
  const navigate = useNavigate()
  const { appSettings, loadSettings } = useAppStore()

  const [form, setForm] = useState({
    default_export_folder: '',
    default_page_size: 'A4',
    default_orientation: 'portrait',
    default_margin_top: '20',
    default_margin_right: '20',
    default_margin_bottom: '20',
    default_margin_left: '20',
    default_font_family: 'Arial',
    autosave_interval: '3000',
    low_memory_mode: '0',
    max_concurrent_workers: '2',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [version, setVersion] = useState('')
  const [choosingFolder, setChoosingFolder] = useState(false)

  useEffect(() => {
    initSettings()
  }, [appSettings])

  async function initSettings() {
    // Merge loaded settings into form
    if (appSettings && Object.keys(appSettings).length > 0) {
      setForm(prev => ({ ...prev, ...appSettings }))
    }

    // Get app version
    try {
      const res = await window.api.settings.getAppVersion()
      if (res.success) setVersion(res.version)
    } catch {}
  }

  function set(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
    setSaved(false)
  }

  async function handleChooseFolder() {
    setChoosingFolder(true)
    try {
      const result = await window.api.export.chooseFolder()
      if (result.success) {
        set('default_export_folder', result.folderPath)
      }
    } catch (err) {
      alert('Failed to choose folder: ' + err.message)
    } finally {
      setChoosingFolder(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await window.api.settings.set(form)
      await loadSettings()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert('Failed to save settings: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleOpenLogs() {
    try {
      await window.api.settings.openLogsFolder()
    } catch (err) {
      alert('Could not open logs folder: ' + err.message)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Application preferences and defaults</p>
        </div>
        <button
          className={`btn-primary ${saved ? 'bg-green-600 hover:bg-green-700' : ''}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </>
          ) : saved ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved!
            </>
          ) : 'Save Settings'}
        </button>
      </div>

      <div className="space-y-5">
        {/* Export Folder */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Default Export Folder</h2>
          <p className="text-sm text-gray-500 mb-3">Where PDFs are saved when you click "Download All PDFs"</p>
          <div className="flex gap-2">
            <input
              className="input flex-1 font-mono text-xs"
              placeholder="No default folder set — will ask each time"
              value={form.default_export_folder || ''}
              onChange={e => set('default_export_folder', e.target.value)}
              readOnly
            />
            <button
              className="btn-secondary btn-sm flex-shrink-0"
              onClick={handleChooseFolder}
              disabled={choosingFolder}
            >
              {choosingFolder ? 'Choosing...' : 'Browse'}
            </button>
            {form.default_export_folder && (
              <button
                className="btn-ghost btn-sm flex-shrink-0 text-red-500"
                onClick={() => set('default_export_folder', '')}
                title="Clear default folder"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Page Defaults */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Default Page Settings</h2>
          <p className="text-sm text-gray-500 mb-4">Applied to new projects</p>

          <div className="space-y-4">
            {/* Page size + orientation */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Page Size</label>
                <select
                  className="input"
                  value={form.default_page_size || 'A4'}
                  onChange={e => set('default_page_size', e.target.value)}
                >
                  {PAGE_SIZES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Orientation</label>
                <div className="flex gap-2 mt-1">
                  {['portrait', 'landscape'].map(o => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => set('default_orientation', o)}
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-sm capitalize transition-all ${
                        form.default_orientation === o
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Margins */}
            <div>
              <label className="label">Default Margins (mm)</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'default_margin_top', label: 'Top' },
                  { key: 'default_margin_right', label: 'Right' },
                  { key: 'default_margin_bottom', label: 'Bottom' },
                  { key: 'default_margin_left', label: 'Left' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <div className="text-xs text-gray-500 text-center mb-1">{label}</div>
                    <input
                      type="number" min="0" max="50" step="1"
                      className="input text-center"
                      value={form[key] || '20'}
                      onChange={e => set(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Font */}
            <div>
              <label className="label">Default Font</label>
              <select
                className="input"
                value={form.default_font_family || 'Arial'}
                onChange={e => set('default_font_family', e.target.value)}
              >
                {FONTS.map(f => <option key={f} style={{ fontFamily: f }}>{f}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Performance */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Performance</h2>
          <p className="text-sm text-gray-500 mb-4">PDF generation and autosave settings</p>

          <div className="space-y-4">
            {/* Autosave interval */}
            <div>
              <label className="label">Autosave Interval</label>
              <select
                className="input"
                value={form.autosave_interval || '3000'}
                onChange={e => set('autosave_interval', e.target.value)}
              >
                <option value="1000">1 second</option>
                <option value="2000">2 seconds</option>
                <option value="3000">3 seconds (recommended)</option>
                <option value="5000">5 seconds</option>
                <option value="10000">10 seconds</option>
              </select>
            </div>

            {/* Concurrent workers */}
            <div>
              <label className="label">PDF Render Workers</label>
              <div className="flex items-center gap-3">
                <select
                  className="input w-auto"
                  value={form.max_concurrent_workers || '2'}
                  onChange={e => set('max_concurrent_workers', e.target.value)}
                  disabled={form.low_memory_mode === '1'}
                >
                  <option value="1">1 worker (slowest, least memory)</option>
                  <option value="2">2 workers (recommended)</option>
                  <option value="3">3 workers (faster, more memory)</option>
                </select>
              </div>
            </div>

            {/* Low memory mode */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-primary-600 w-4 h-4 mt-0.5"
                checked={form.low_memory_mode === '1'}
                onChange={e => set('low_memory_mode', e.target.checked ? '1' : '0')}
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Low Memory Mode</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Forces single render worker. Use on machines with less than 4 GB RAM.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Diagnostics */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Diagnostics & Info</h2>
          <p className="text-sm text-gray-500 mb-4">Application logs and version information</p>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div>
                <div className="text-sm font-medium text-gray-700">Application Version</div>
                <div className="text-xs text-gray-400 mt-0.5">{version || 'Loading...'}</div>
              </div>
              <div className="flex gap-1.5">
                <span className="badge badge-green">100% Offline</span>
                <span className="badge badge-blue">Windows</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium text-gray-700">Log Files</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Local diagnostic logs for troubleshooting
                </div>
              </div>
              <button className="btn-secondary btn-sm" onClick={handleOpenLogs}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Open Logs Folder
              </button>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="card p-5 bg-surface-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Local PDF Studio</div>
              <div className="text-sm text-gray-500">
                Offline Windows desktop app for bulk PDF generation.
                All data stays on your computer — no cloud, no account required.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

