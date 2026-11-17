import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useAppStore from '../store/appStore'
import DataImportWizard from '../components/DataImportWizard'

export default function BulkGenerator() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { currentProject, currentRevision, loadProject } = useAppStore()

  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(50)
  const [filenamePattern, setFilenamePattern] = useState('Document_{number}.pdf')
  const [pageSettings, setPageSettings] = useState({})
  const [generating, setGenerating] = useState(false)
  const [showDataWizard, setShowDataWizard] = useState(false)
  const [dataset, setDataset] = useState(null)
  const [allRows, setAllRows] = useState([])
  const [selectedRows, setSelectedRows] = useState([])
  const [checkedKeys, setCheckedKeys] = useState(new Set())
  const [rowOffset, setRowOffset] = useState(0)
  const [rowsLoading, setRowsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [editingIndex, setEditingIndex] = useState(null)
  const [editingValue, setEditingValue] = useState('')
  const [newAirline, setNewAirline] = useState('')
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteText, setPasteText] = useState('')

  useEffect(() => {
    init()
  }, [projectId])

  async function init() {
    setLoading(true)
    const data = await loadProject(projectId)
    if (!data?.success) { navigate('/'); return }

    const settings = JSON.parse(data.project.settings_json || '{}')
    setPageSettings(settings)

    if (data.project.mode === 'personalized') {
      setFilenamePattern('Document_{{airline}}_{number}.pdf')
      if (data.dataset) {
        setDataset(data.dataset)
        await loadRows(data.dataset.id, 0)
      } else {
        // No project dataset — load global airlines
        try {
          const res = await window.api.airlines.asRows()
          if (res.success && res.rows?.length > 0) {
            const rows = res.rows.map(r => ({ ...r.data, _rowIndex: r.rowIndex }))
            setAllRows(rows)
            const keys = new Set(rows.map((_, i) => i))
            setCheckedKeys(keys)
            setSelectedRows(rows)
            setQuantity(rows.length)
          }
        } catch {}
      }
    }
    setLoading(false)
  }

  async function loadRows(datasetId, offset = 0) {
    setRowsLoading(true)
    try {
      const res = await window.api.dataImport.getRows(datasetId, 50, offset)
      if (res.success) {
        const rows = res.rows.slice(0, 50).map(r => ({ ...r.data, _rowIndex: r.rowIndex }))
        setAllRows(rows)
        const keys = new Set(rows.map((_, i) => i))
        setCheckedKeys(keys)
        setSelectedRows(rows)
        setRowOffset(offset)
        setQuantity(Math.min(res.total, 50))
      }
    } catch {}
    setRowsLoading(false)
  }

  function toggleRow(index) {
    setCheckedKeys(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      const newSelected = allRows.filter((_, i) => next.has(i))
      setSelectedRows(newSelected)
      return next
    })
  }

  function toggleAll(checked) {
    if (checked) {
      const keys = new Set(allRows.map((_, i) => i))
      setCheckedKeys(keys)
      setSelectedRows(allRows)
    } else {
      setCheckedKeys(new Set())
      setSelectedRows([])
    }
  }

  const firstColKey = allRows.length > 0
    ? Object.keys(allRows[0]).find(k => !k.startsWith('_')) || ''
    : ''

  const filteredRows = allRows.filter(row => {
    if (!searchQuery.trim()) return true
    return String(row[firstColKey] || '').toLowerCase().includes(searchQuery.toLowerCase())
  })

  function startEdit(index) {
    setEditingIndex(index)
    setEditingValue(allRows[index][firstColKey] || '')
  }

  function saveEdit(index) {
    if (!editingValue.trim()) return
    const updated = allRows.map((row, i) =>
      i === index ? { ...row, [firstColKey]: editingValue.trim() } : row
    )
    setAllRows(updated)
    const newSelected = updated.filter((_, i) => checkedKeys.has(i))
    setSelectedRows(newSelected)
    setEditingIndex(null)
    setEditingValue('')
  }

  function deleteRow(index) {
    const updated = allRows.filter((_, i) => i !== index)
    setAllRows(updated)
    // remap checkedKeys
    const newKeys = new Set()
    let shift = 0
    allRows.forEach((_, i) => {
      if (i === index) { shift = 1; return }
      if (checkedKeys.has(i)) newKeys.add(i - shift)
    })
    setCheckedKeys(newKeys)
    setSelectedRows(updated.filter((_, i) => newKeys.has(i)))
  }

  function addAirline() {
    if (!newAirline.trim() || !firstColKey) return
    const newRow = { [firstColKey]: newAirline.trim(), _rowIndex: allRows.length }
    const updated = [...allRows, newRow]
    setAllRows(updated)
    const newIndex = updated.length - 1
    const newKeys = new Set(checkedKeys)
    newKeys.add(newIndex)
    setCheckedKeys(newKeys)
    setSelectedRows(updated.filter((_, i) => newKeys.has(i)))
    setNewAirline('')
  }

  function loadFromPaste() {
    const colKey = firstColKey || 'airline'
    const lines = pasteText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .slice(0, 50)
    if (lines.length === 0) return
    const rows = lines.map((name, i) => ({ [colKey]: name, _rowIndex: i }))
    setAllRows(rows)
    const keys = new Set(rows.map((_, i) => i))
    setCheckedKeys(keys)
    setSelectedRows(rows)
    setDataset({ file_name: 'Pasted List', row_count: rows.length, columns_json: JSON.stringify([colKey]) })
    setPasteText('')
    setShowPasteModal(false)
  }

  async function handleGenerate() {
    if (!currentRevision) { alert('Please save your document first'); return }

    setGenerating(true)
    try {
      // Always fetch the LATEST revision before generating to ensure we have
      // the most recent version (e.g. after a Find & Replace)
      const freshData = await loadProject(projectId)
      const latestRevisionId = freshData?.revision?.id || currentRevision.id

      const isPersonalized = currentProject?.mode === 'personalized'

      const batchConfig = {
        projectId,
        mode: currentProject?.mode,
        quantity: isPersonalized ? selectedRows.length : quantity,
        filenamePattern,
        sourceRevisionId: latestRevisionId,
        datasetId: dataset?.id || null,
        selectedRows: isPersonalized ? selectedRows.slice(0, 50) : null,
        pageSettings,
      }

      const result = await window.api.pdf.generateBatch(batchConfig)
      if (result.success) {
        navigate(`/project/${projectId}/batch/${result.batchId}`)
      } else {
        alert('Failed to start batch: ' + result.error)
      }
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full text-gray-400">Loading...</div>
  )

  const isPersonalized = currentProject?.mode === 'personalized'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(`/project/${projectId}/editor`)} className="btn-ghost btn-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{currentProject?.name}</h1>
          <p className="text-sm text-gray-500">
            {isPersonalized ? 'Personalized PDF Generator' : 'Identical PDF Generator'}
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Identical mode: Quantity */}
        {!isPersonalized && (
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Batch Quantity</h2>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="range" min="1" max="50" value={quantity}
                  onChange={e => setQuantity(Number(e.target.value))}
                  className="w-full accent-primary-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1</span><span>50</span>
                </div>
              </div>
              <div className="text-center min-w-[60px]">
                <input
                  type="number" min="1" max="50"
                  className="input w-16 text-center text-lg font-bold"
                  value={quantity}
                  onChange={e => setQuantity(Math.min(50, Math.max(1, Number(e.target.value))))}
                />
                <div className="text-xs text-gray-400 mt-0.5">PDFs</div>
              </div>
            </div>
          </div>
        )}

        {/* Personalized mode: Data Import */}
        {isPersonalized && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Data Source</h2>
              <div className="flex gap-2">
                <button className="btn-secondary btn-sm" onClick={() => setShowPasteModal(true)}>
                  📋 Paste List
                </button>
                <button className="btn-secondary btn-sm" onClick={() => setShowDataWizard(true)}>
                  {dataset ? 'Change CSV' : 'Import CSV / Excel'}
                </button>
              </div>
            </div>

            {dataset ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-green-800">{dataset.file_name}</div>
                    <div className="text-xs text-green-600">{dataset.row_count} rows · {JSON.parse(dataset.columns_json || '[]').length} columns</div>
                  </div>
                </div>

                {/* Columns preview */}
                <div>
                  <div className="text-xs text-gray-500 mb-1">Detected columns:</div>
                  <div className="flex flex-wrap gap-1">
                    {JSON.parse(dataset.columns_json || '[]').map(col => (
                      <span key={col} className="badge badge-blue text-xs font-mono">{`{{${col}}}`}</span>
                    ))}
                  </div>
                </div>

                {/* Airline Checklist */}
                {allRows.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Header bar */}
                    <div className="flex items-center justify-between px-3 py-2 bg-surface-50 border-b border-gray-200">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={checkedKeys.size === allRows.length}
                          onChange={e => toggleAll(e.target.checked)}
                          className="w-4 h-4 accent-primary-600"
                        />
                        <span className="text-xs font-medium text-gray-700">
                          Select All
                        </span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-primary-600">
                          {checkedKeys.size} / {allRows.length} selected
                        </span>
                        <button
                          onClick={() => { setEditMode(e => !e); setEditingIndex(null) }}
                          className={`text-xs px-2 py-1 rounded font-medium border transition-colors ${editMode ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                        >
                          {editMode ? '✕ Done Editing' : '✏️ Edit List'}
                        </button>
                      </div>
                    </div>

                    {/* Search box — hidden in edit mode */}
                    {!editMode && (
                      <div className="px-3 py-2 border-b border-gray-100">
                        <input
                          type="text"
                          placeholder="Search airline..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="input input-sm w-full text-xs"
                        />
                      </div>
                    )}

                    {/* Scrollable list */}
                    <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                      {(editMode ? allRows : filteredRows).map((row) => {
                        const originalIndex = allRows.indexOf(row)
                        const label = row[firstColKey] || `Row ${originalIndex + 1}`
                        const isChecked = checkedKeys.has(originalIndex)
                        const isEditing = editMode && editingIndex === originalIndex

                        return (
                          <div
                            key={originalIndex}
                            className={`flex items-center gap-2 px-3 py-2 ${isChecked && !editMode ? 'bg-blue-50' : ''} ${editMode ? 'hover:bg-orange-50' : 'hover:bg-surface-50'} transition-colors`}
                          >
                            {/* Checkbox — only in select mode */}
                            {!editMode && (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleRow(originalIndex)}
                                className="w-4 h-4 accent-primary-600 flex-shrink-0"
                              />
                            )}

                            {/* Airline name — editable in edit mode */}
                            {isEditing ? (
                              <input
                                autoFocus
                                type="text"
                                value={editingValue}
                                onChange={e => setEditingValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveEdit(originalIndex)
                                  if (e.key === 'Escape') setEditingIndex(null)
                                }}
                                className="input input-sm flex-1 text-sm"
                              />
                            ) : (
                              <span className={`flex-1 text-sm ${isChecked && !editMode ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                                <span className="inline-block text-xs text-gray-400 font-mono w-7 mr-1 text-right">{originalIndex + 1}.</span>
                                {label}
                              </span>
                            )}

                            {/* Edit mode actions */}
                            {editMode && (
                              isEditing ? (
                                <div className="flex gap-1">
                                  <button onClick={() => saveEdit(originalIndex)} className="text-xs px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700">Save</button>
                                  <button onClick={() => setEditingIndex(null)} className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Cancel</button>
                                </div>
                              ) : (
                                <div className="flex gap-1 opacity-70 hover:opacity-100">
                                  <button
                                    onClick={() => startEdit(originalIndex)}
                                    title="Edit name"
                                    className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                  >✏️</button>
                                  <button
                                    onClick={() => deleteRow(originalIndex)}
                                    title="Delete"
                                    className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200"
                                  >🗑️</button>
                                </div>
                              )
                            )}
                          </div>
                        )
                      })}
                      {!editMode && filteredRows.length === 0 && (
                        <div className="px-3 py-4 text-center text-xs text-gray-400">No airlines match "{searchQuery}"</div>
                      )}
                    </div>

                    {/* Add new airline — only in edit mode */}
                    {editMode && (
                      <div className="px-3 py-2 border-t border-gray-200 bg-green-50 flex gap-2">
                        <input
                          type="text"
                          placeholder="New airline name..."
                          value={newAirline}
                          onChange={e => setNewAirline(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addAirline()}
                          className="input input-sm flex-1 text-sm"
                        />
                        <button
                          onClick={addAirline}
                          disabled={!newAirline.trim()}
                          className="btn-primary btn-sm text-xs px-3"
                        >+ Add</button>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="px-3 py-2 bg-surface-50 border-t border-gray-200 text-xs text-gray-500">
                      ✅ Will generate <strong className="text-gray-900">{checkedKeys.size}</strong> PDF{checkedKeys.size !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}

                <div className="text-sm text-gray-600">
                  Will generate <strong>{checkedKeys.size}</strong> personalized PDFs
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400">
                <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm">Import a CSV or Excel file to get started</p>
                <button className="btn-primary mt-3" onClick={() => setShowDataWizard(true)}>
                  Import Data File
                </button>
              </div>
            )}
          </div>
        )}

        {/* Filename Pattern */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Filename Pattern</h2>
          <input
            className="input font-mono"
            value={filenamePattern}
            onChange={e => setFilenamePattern(e.target.value)}
            placeholder="Document_{number}.pdf"
          />
          <div className="mt-2 text-xs text-gray-500">
            Use <code className="bg-surface-100 px-1 rounded">{'{number}'}</code> for sequence number
            {isPersonalized && (
              <> · <code className="bg-surface-100 px-1 rounded">{'{{column_name}}'}</code> for data values</>
            )}
          </div>
          {filenamePattern && (
            <div className="mt-2 text-xs text-gray-400">
              Preview: {filenamePattern
                .replace(/{number}/gi, '001')
                .replace(/\{\{(\w+)\}\}/g, (_, k) => `[${k}]`)}
            </div>
          )}
        </div>

        {/* Summary + Generate */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-900">Ready to Generate</div>
              <div className="text-sm text-gray-500 mt-0.5">
                {isPersonalized
                  ? `${Math.min(selectedRows.length, 50)} personalized PDFs from ${dataset?.file_name || 'no data'}`
                  : `${quantity} identical PDF${quantity !== 1 ? 's' : ''} from master document`}
              </div>
              {!currentRevision && (
                <div className="text-xs text-red-600 mt-1">⚠ No saved content. Go back to editor and save first.</div>
              )}
              {isPersonalized && !dataset && (
                <div className="text-xs text-red-600 mt-1">⚠ Please import a data file first.</div>
              )}
            </div>
            <button
              className="btn-primary btn-lg"
              onClick={handleGenerate}
              disabled={generating || !currentRevision || (isPersonalized && (!dataset || selectedRows.length === 0 || checkedKeys.size === 0))}
            >
              {generating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Starting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate All PDFs
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Paste List Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">📋 Paste Airline List</h2>
                <p className="text-xs text-gray-500 mt-0.5">Ek line = Ek airline (max 50)</p>
              </div>
              <button onClick={() => setShowPasteModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="p-5">
              <textarea
                autoFocus
                className="input w-full h-56 font-mono text-sm resize-none"
                placeholder={"American Airlines\nDelta Airlines\nEmirates\nQatar Airways\n..."}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
              />
              <div className="mt-2 text-xs text-gray-400">
                {pasteText.split('\n').filter(l => l.trim()).length} airlines detected
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button className="btn-secondary flex-1" onClick={() => setShowPasteModal(false)}>Cancel</button>
              <button
                className="btn-primary flex-1"
                onClick={loadFromPaste}
                disabled={!pasteText.trim()}
              >
                ✅ Load Airlines
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Import Wizard Modal */}
      {showDataWizard && (
        <DataImportWizard
          projectId={projectId}
          onClose={() => setShowDataWizard(false)}
          onImported={(ds, rows) => {
            setDataset(ds)
            const r = rows.slice(0, 50)
            setAllRows(r)
            const keys = new Set(r.map((_, i) => i))
            setCheckedKeys(keys)
            setSelectedRows(r)
            setShowDataWizard(false)
          }}
        />
      )}
    </div>
  )
}
