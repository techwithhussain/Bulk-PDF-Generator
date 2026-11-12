import { useState } from 'react'

const PAGE_SIZES = ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid']
const FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Helvetica', 'Calibri', 'Verdana', 'Tahoma', 'Courier New']

export default function PageSettingsPanel({ projectId, settings, onClose, onSaved }) {
  const [form, setForm] = useState({
    pageSize: settings.pageSize || 'A4',
    orientation: settings.orientation || 'portrait',
    marginTop: settings.marginTop ?? 20,
    marginRight: settings.marginRight ?? 20,
    marginBottom: settings.marginBottom ?? 20,
    marginLeft: settings.marginLeft ?? 20,
    fontFamily: settings.fontFamily || 'Arial',
    fontSize: settings.fontSize || 12,
    headerText: settings.headerText || '',
    footerText: settings.footerText || '',
    showPageNumbers: settings.showPageNumbers || false,
  })
  const [saving, setSaving] = useState(false)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  async function handleSave() {
    setSaving(true)
    try {
      await window.api.projects.update(projectId, { settings: form })
      onSaved?.()
    } catch (err) {
      alert('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[480px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="font-semibold text-gray-900">Page Settings</h2>
          <button onClick={onClose} className="btn-ghost btn-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Page Size + Orientation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Page Size</label>
              <select className="input" value={form.pageSize} onChange={e => set('pageSize', e.target.value)}>
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
                    onClick={() => set('orientation', o)}
                    className={`flex-1 py-1.5 px-2 rounded-lg border text-sm capitalize transition-all ${form.orientation === o ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
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
            <label className="label">Margins (mm)</label>
            <div className="grid grid-cols-4 gap-2">
              {['marginTop', 'marginRight', 'marginBottom', 'marginLeft'].map(key => (
                <div key={key}>
                  <div className="text-xs text-gray-500 text-center mb-1 capitalize">
                    {key.replace('margin', '')}
                  </div>
                  <input
                    type="number"
                    className="input text-center"
                    min="0" max="50" step="1"
                    value={form[key]}
                    onChange={e => set(key, Number(e.target.value))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Font */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Font Family</label>
              <select className="input" value={form.fontFamily} onChange={e => set('fontFamily', e.target.value)}>
                {FONTS.map(f => <option key={f} style={{ fontFamily: f }}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Font Size (pt)</label>
              <input
                type="number"
                className="input"
                min="8" max="72"
                value={form.fontSize}
                onChange={e => set('fontSize', Number(e.target.value))}
              />
            </div>
          </div>

          {/* Header/Footer */}
          <div>
            <label className="label">Header Text</label>
            <input className="input" placeholder="Optional header text..." value={form.headerText}
              onChange={e => set('headerText', e.target.value)} />
          </div>
          <div>
            <label className="label">Footer Text</label>
            <input className="input" placeholder="Optional footer text..." value={form.footerText}
              onChange={e => set('footerText', e.target.value)} />
          </div>

          {/* Page Numbers */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.showPageNumbers}
              onChange={e => set('showPageNumbers', e.target.checked)}
              className="rounded border-gray-300 text-primary-600 w-4 h-4" />
            <span className="text-sm text-gray-700">Show page numbers</span>
          </label>
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2 sticky bottom-0 bg-white">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

