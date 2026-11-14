import { useState } from 'react'

export default function FindReplacePanel({ projectId, onClose, onApplied }) {
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [scope, setScope] = useState('master')
  const [matchCase, setMatchCase] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState('input') // 'input' | 'preview' | 'confirm' | 'done'
  const [result, setResult] = useState(null)

  async function handlePreview() {
    if (!findText.trim()) return
    setLoading(true)
    try {
      const res = await window.api.findReplace.preview({
        projectId, findText, replaceText, scope, matchCase, wholeWord
      })
      setPreview(res)
      setPhase(res.count > 0 ? 'preview' : 'preview')
    } catch (err) {
      alert('Preview failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Show confirm step (no native dialog — in-app UI)
  function handleConfirmStep() {
    setPhase('confirm')
  }

  async function handleApply() {
    setLoading(true)
    try {
      const res = await window.api.findReplace.apply({
        projectId, findText, replaceText, scope, matchCase, wholeWord, confirmed: true
      })
      setResult(res)
      setPhase('done')
      if (res.success && res.newContentJson) {
        onApplied?.(res.newContentJson)
      }
    } catch (err) {
      setPhase('preview') // go back on error
      alert('Replace failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setPhase('input')
    setPreview(null)
    setResult(null)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-start justify-end p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-96 mt-14 mr-2 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Find & Replace
            <span className="text-xs text-gray-400 font-normal">Ctrl+H</span>
          </h2>
          <button onClick={onClose} className="btn-ghost btn-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Find */}
          <div>
            <label className="label">Find</label>
            <input
              className="input"
              placeholder="Text to find..."
              value={findText}
              onChange={e => { setFindText(e.target.value); setPhase('input'); setPreview(null) }}
              autoFocus
            />
          </div>

          {/* Replace */}
          <div>
            <label className="label">Replace with</label>
            <input
              className="input"
              placeholder="Replacement text..."
              value={replaceText}
              onChange={e => { setReplaceText(e.target.value); setPhase('input'); setPreview(null) }}
            />
          </div>

          {/* Options */}
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={matchCase} onChange={e => setMatchCase(e.target.checked)}
                className="rounded border-gray-300 text-primary-600" />
              <span className="text-sm text-gray-600">Match case</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={wholeWord} onChange={e => setWholeWord(e.target.checked)}
                className="rounded border-gray-300 text-primary-600" />
              <span className="text-sm text-gray-600">Whole word</span>
            </label>
          </div>

          {/* Scope */}
          <div>
            <label className="label">Scope</label>
            <select className="input" value={scope} onChange={e => setScope(e.target.value)}>
              <option value="master">Master / Template only</option>
              <option value="all">All PDFs in project</option>
            </select>
          </div>

          {/* Preview results */}
          {preview && (
            <div className={`rounded-lg p-3 text-sm ${
              preview.count === 0 ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' :
              'bg-blue-50 border border-blue-200 text-blue-800'
            }`}>
              {preview.count === 0 ? (
                <span>No matches found for "{findText}"</span>
              ) : (
                <div className="space-y-1">
                  <div><strong>{preview.count}</strong> match{preview.count !== 1 ? 'es' : ''} found</div>
                  <div>{preview.affectedPdfs} PDF{preview.affectedPdfs !== 1 ? 's' : ''} will be marked for regeneration</div>
                  <div className="text-xs opacity-75 mt-1">
                    "{findText}" → "{replaceText}"
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Done result */}
          {phase === 'done' && result && (
            <div className={`rounded-lg p-3 text-sm ${
              result.success ? 'bg-green-50 border border-green-200 text-green-800' :
              'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {result.success ? (
                <div>
                  <div className="font-medium">✓ Replacement applied</div>
                  <div className="text-xs mt-0.5">{result.count} replacements · {result.affectedPdfs} PDFs queued for regeneration</div>
                </div>
              ) : (
                <div>✕ {result.error}</div>
              )}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="p-4 border-t border-gray-100 flex gap-2">
          {phase === 'done' ? (
            <>
              <button className="btn-secondary flex-1" onClick={handleReset}>New Search</button>
              <button className="btn-primary flex-1" onClick={onClose}>Close</button>
            </>
          ) : phase === 'confirm' ? (
            // In-app confirmation — no native dialog freeze!
            <div className="w-full space-y-2">
              <div className="text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg p-2.5">
                ⚠️ Replace <strong>{preview?.count}</strong> occurrence{preview?.count !== 1 ? 's' : ''} in {preview?.affectedPdfs} PDF{preview?.affectedPdfs !== 1 ? 's' : ''}?
                <div className="text-xs mt-1 opacity-75">This can be undone via revision history.</div>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary flex-1" onClick={() => setPhase('preview')}>Cancel</button>
                <button
                  className="btn-danger flex-1"
                  onClick={handleApply}
                  disabled={loading}
                >
                  {loading ? 'Replacing...' : 'Yes, Replace All'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
              {phase === 'input' || !preview || preview.count === 0 ? (
                <button
                  className="btn-primary flex-1"
                  onClick={handlePreview}
                  disabled={!findText.trim() || loading}
                >
                  {loading ? 'Searching...' : 'Preview Matches'}
                </button>
              ) : (
                <button
                  className="btn-danger flex-1"
                  onClick={handleConfirmStep}
                  disabled={loading}
                >
                  {`Replace All (${preview.count})`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

