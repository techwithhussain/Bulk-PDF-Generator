import { useState, useEffect } from 'react'
import useAppStore from '../store/appStore'

const PAGE_SIZES = ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid']
const FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Helvetica', 'Calibri', 'Verdana', 'Tahoma', 'Courier New']

export default function Settings() {
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

  // Airlines state
  const [airlines, setAirlines] = useState([])
  const [pasteText, setPasteText] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [airlineMsg, setAirlineMsg] = useState('')
  const [airlinesLoading, setAirlinesLoading] = useState(false)

  useEffect(() => { initSettings(); loadAirlines() }, [appSettings])

  async function initSettings() {
    if (appSettings && Object.keys(appSettings).length > 0) {
      setForm(prev => ({ ...prev, ...appSettings }))
    }
    try {
      const res = await window.api.settings.getAppVersion()
      if (res.success) setVersion(res.version)
    } catch {}
  }

  async function loadAirlines() {
    try {
      const res = await window.api.airlines.getAll()
      if (res.success) setAirlines(res.airlines)
    } catch {}
  }

  async function handleImportCsv() {
    try {
      const result = await window.api.dataImport.chooseFile()
      if (!result?.success || !result?.filePath) return
      const filePath = result.filePath
      setAirlinesLoading(true)
      const parsed = await window.api.dataImport.parseFile(filePath)
      if (!parsed.success || !parsed.rows?.length) {
        setAirlineMsg('❌ CSV parse nahi hua.')
        setAirlinesLoading(false)
        return
      }
      const names = parsed.rows.map(r => r[Object.keys(r)[0]] || '').filter(Boolean)
      const res = await window.api.airlines.importFromCsv(names)
      if (res.success) {
        setAirlineMsg(`✅ ${res.added} airlines added, ${res.skipped} already existed`)
        await loadAirlines()
      }
    } catch (err) { setAirlineMsg('❌ Error: ' + err.message) }
    setAirlinesLoading(false)
    setTimeout(() => setAirlineMsg(''), 4000)
  }

  async function handlePasteAdd() {
    if (!pasteText.trim()) return
    setAirlinesLoading(true)
    try {
      const res = await window.api.airlines.addFromText(pasteText)
      if (res.success) {
        setAirlineMsg(`✅ ${res.added} airlines added`)
        setPasteText(''); setShowPaste(false)
        await loadAirlines()
      }
    } catch (err) { setAirlineMsg('❌ ' + err.message) }
    setAirlinesLoading(false)
    setTimeout(() => setAirlineMsg(''), 4000)
  }

  async function handleDeleteAirline(id) {
    await window.api.airlines.delete(id)
    setAirlines(prev => prev.filter(a => a.id !== id))
  }

  async function handleClearAll() {
    if (!window.confirm(`Delete all ${airlines.length} airlines?`)) return
    await window.api.airlines.clear()
    setAirlines([])
  }

  function set(key, val) { setForm(prev => ({ ...prev, [key]: val })); setSaved(false) }

  async function handleChooseFolder() {
    setChoosingFolder(true)
    try {
      const result = await window.api.export.chooseFolder()
      if (result.success) set('default_export_folder', result.folderPath)
    } catch {}
    setChoosingFolder(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await window.api.settings.set(form)
      await loadSettings()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  async function handleOpenLogs() {
    try { await window.api.settings.openLogsFolder() } catch {}
  }

  return (
    <div className="h-full overflow-y-auto">
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Application preferences and defaults</p>
        </div>
        <button className={`btn-primary ${saved ? 'bg-green-600 hover:bg-green-700' : ''}`} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Settings'}
        </button>
      </div>

      <div className="space-y-5">

        {/* ── GLOBAL AIRLINES ── */}
        <div className="card p-5 border-2 border-blue-100">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                ✈️ Global Airlines List
                <span className="text-xs font-normal bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                  {airlines.length} saved
                </span>
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Ek baar save karo — sab projects mein auto aayenge
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 mt-3 flex-wrap">
            <button className="btn-secondary btn-sm flex items-center gap-1.5" onClick={handleImportCsv} disabled={airlinesLoading}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import CSV
            </button>
            <button className="btn-secondary btn-sm flex items-center gap-1.5" onClick={() => setShowPaste(p => !p)}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Paste List
            </button>
            {airlines.length > 0 && (
              <button className="btn-ghost btn-sm text-red-500 ml-auto" onClick={handleClearAll}>
                Clear All
              </button>
            )}
          </div>

          {/* Paste box */}
          {showPaste && (
            <div className="mt-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
              <label className="text-xs text-gray-500 mb-1 block">Airline names — ek ek line mein:</label>
              <textarea className="input w-full font-mono text-xs" rows={6}
                placeholder={"American Airlines\nAir Canada\nIndiGo\nSpiceJet\n..."}
                value={pasteText} onChange={e => setPasteText(e.target.value)} />
              <div className="flex gap-2 mt-2">
                <button className="btn-primary btn-sm" onClick={handlePasteAdd} disabled={airlinesLoading}>
                  {airlinesLoading ? 'Adding...' : 'Add Airlines'}
                </button>
                <button className="btn-ghost btn-sm" onClick={() => { setShowPaste(false); setPasteText('') }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Message */}
          {airlineMsg && (
            <div className="mt-2 text-sm bg-green-50 border border-green-200 rounded px-3 py-1.5">{airlineMsg}</div>
          )}

          {/* List */}
          {airlines.length > 0 ? (
            <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
              <div className="max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {airlines.map((a, i) => (
                  <div key={a.id} className={`flex items-center justify-between px-3 py-1.5 text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-6 text-right">{i + 1}.</span>
                      <span className="text-gray-800">{a.name}</span>
                    </div>
                    <button onClick={() => handleDeleteAirline(a.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-3 text-center py-6 text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
              Koi airline nahi — Import CSV ya Paste List se add karo
            </div>
          )}
          <p className="text-[11px] text-gray-400 mt-2">
            💡 Naye projects mein yeh airlines automatically tabs mein aayengi
          </p>
        </div>

        {/* Export Folder */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Default Export Folder</h2>
          <p className="text-sm text-gray-500 mb-3">Where PDFs are saved when you click "Download All PDFs"</p>
          <div className="flex gap-2">
            <input className="input flex-1 font-mono text-xs" placeholder="No default folder set — will ask each time"
              value={form.default_export_folder || ''} readOnly />
            <button className="btn-secondary btn-sm flex-shrink-0" onClick={handleChooseFolder} disabled={choosingFolder}>
              {choosingFolder ? 'Choosing...' : 'Browse'}
            </button>
            {form.default_export_folder && (
              <button className="btn-ghost btn-sm flex-shrink-0 text-red-500" onClick={() => set('default_export_folder', '')}>✕</button>
            )}
          </div>
        </div>

        {/* Page Defaults */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Default Page Settings</h2>
          <p className="text-sm text-gray-500 mb-4">Applied to new projects</p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Page Size</label>
                <select className="input" value={form.default_page_size || 'A4'} onChange={e => set('default_page_size', e.target.value)}>
                  {PAGE_SIZES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Orientation</label>
                <div className="flex gap-2 mt-1">
                  {['portrait', 'landscape'].map(o => (
                    <button key={o} type="button" onClick={() => set('default_orientation', o)}
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-sm capitalize transition-all ${
                        form.default_orientation === o ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'
                      }`}>{o}</button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="label">Default Margins (mm)</label>
              <div className="grid grid-cols-4 gap-2">
                {[['default_margin_top','Top'],['default_margin_right','Right'],['default_margin_bottom','Bottom'],['default_margin_left','Left']].map(([key, label]) => (
                  <div key={key}>
                    <div className="text-xs text-gray-500 text-center mb-1">{label}</div>
                    <input type="number" min="0" max="50" className="input text-center" value={form[key] || '20'} onChange={e => set(key, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Default Font</label>
              <select className="input" value={form.default_font_family || 'Arial'} onChange={e => set('default_font_family', e.target.value)}>
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
            <div>
              <label className="label">Autosave Interval</label>
              <select className="input" value={form.autosave_interval || '3000'} onChange={e => set('autosave_interval', e.target.value)}>
                <option value="1000">1 second</option>
                <option value="2000">2 seconds</option>
                <option value="3000">3 seconds (recommended)</option>
                <option value="5000">5 seconds</option>
              </select>
            </div>
            <div>
              <label className="label">PDF Render Workers</label>
              <select className="input w-auto" value={form.max_concurrent_workers || '2'}
                onChange={e => set('max_concurrent_workers', e.target.value)} disabled={form.low_memory_mode === '1'}>
                <option value="1">1 worker (slowest, least memory)</option>
                <option value="2">2 workers (recommended)</option>
                <option value="3">3 workers (faster, more memory)</option>
              </select>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" className="rounded border-gray-300 w-4 h-4 mt-0.5"
                checked={form.low_memory_mode === '1'} onChange={e => set('low_memory_mode', e.target.checked ? '1' : '0')} />
              <div>
                <span className="text-sm font-medium text-gray-700">Low Memory Mode</span>
                <p className="text-xs text-gray-500 mt-0.5">Forces single render worker. Use on machines with less than 4 GB RAM.</p>
              </div>
            </label>
          </div>
        </div>

        {/* Diagnostics */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Diagnostics & Info</h2>
          <div className="space-y-3 mt-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div>
                <div className="text-sm font-medium text-gray-700">Application Version</div>
                <div className="text-xs text-gray-400">{version || 'Loading...'}</div>
              </div>
              <div className="flex gap-1.5">
                <span className="badge badge-green">100% Offline</span>
                <span className="badge badge-blue">Windows</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium text-gray-700">Log Files</div>
                <div className="text-xs text-gray-400">Local diagnostic logs for troubleshooting</div>
              </div>
              <button className="btn-secondary btn-sm" onClick={handleOpenLogs}>Open Logs Folder</button>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="card p-5 bg-surface-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Local PDF Studio</div>
              <div className="text-sm text-gray-500">Offline desktop app for bulk PDF generation. All data stays on your computer.</div>
            </div>
          </div>
        </div>

      </div>
    </div>
    </div>
  )
}
