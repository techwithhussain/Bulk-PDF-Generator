import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const STATUS_COLOR = {
  done: 'bg-green-500',
  processing: 'bg-blue-500 progress-active',
  pending: 'bg-gray-200',
  failed: 'bg-red-500',
  canceled: 'bg-gray-300',
}

const STATUS_BADGE = {
  done: 'badge-green',
  processing: 'badge-blue',
  pending: 'badge-gray',
  failed: 'badge-red',
  canceled: 'badge-gray',
  running: 'badge-blue',
}

export default function BatchProgress() {
  const { projectId, batchId } = useParams()
  const navigate = useNavigate()
  const [batch, setBatch] = useState(null)
  const [items, setItems] = useState([])
  const [counts, setCounts] = useState({ total: 0, done: 0, failed: 0, active: 0, pending: 0 })
  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState(null)
  const [exportProgress, setExportProgress] = useState(null)
  const [zipping, setZipping] = useState(false)
  const [zipResult, setZipResult] = useState(null)
  const cleanupRef = useRef([])

  useEffect(() => {
    loadBatch()
    const unsubProgress = window.api.on('batch:progress', handleProgress)
    const unsubDone = window.api.on('batch:itemDone', handleItemDone)
    const unsubFail = window.api.on('batch:itemFailed', handleItemFailed)
    const unsubComplete = window.api.on('batch:complete', handleComplete)
    const unsubExport = window.api.on('export:progress', handleExportProgress)
    const unsubExportComplete = window.api.on('export:complete', handleExportComplete)

    cleanupRef.current = [unsubProgress, unsubDone, unsubFail, unsubComplete, unsubExport, unsubExportComplete]
    return () => cleanupRef.current.forEach(fn => fn?.())
  }, [batchId])

  async function loadBatch() {
    const [batchRes, itemsRes] = await Promise.all([
      window.api.pdf.getBatches(projectId),
      window.api.pdf.getBatchItems(batchId),
    ])
    if (batchRes.success) {
      const b = batchRes.batches.find(b => b.id === batchId)
      setBatch(b)
      if (b) {
        setCounts({
          total: b.total_count,
          done: b.done_count,
          failed: b.failed_count,
          active: 0,
          pending: b.total_count - b.done_count - b.failed_count,
        })
      }
    }
    if (itemsRes.success) setItems(itemsRes.items)
  }

  function handleProgress(data) {
    if (data.batchId !== batchId) return
    setCounts({ total: data.total, done: data.done, failed: data.failed, active: data.active, pending: data.pending })
  }

  function handleItemDone(data) {
    if (data.batchId !== batchId) return
    setItems(prev => prev.map(item =>
      item.id === data.itemId ? { ...item, status: 'done' } : item
    ))
  }

  function handleItemFailed(data) {
    if (data.batchId !== batchId) return
    setItems(prev => prev.map(item =>
      item.id === data.itemId ? { ...item, status: 'failed', error_message: data.error } : item
    ))
  }

  function handleComplete(data) {
    if (data.batchId !== batchId) return
    setCounts(c => ({ ...c, done: data.done, failed: data.failed, active: 0, pending: 0 }))
    setBatch(b => b ? { ...b, status: 'done', done_count: data.done, failed_count: data.failed } : b)
  }

  function handleExportProgress(data) {
    if (data.batchId !== batchId) return
    setExportProgress(data)
  }

  function handleExportComplete(data) {
    if (data.batchId !== batchId) return
    setExportProgress(null)
    setExportResult(data)
    setExporting(false)
  }

  async function handleCancel() {
    if (!confirm('Cancel this batch? In-progress items will finish, pending ones will be canceled.')) return
    await window.api.pdf.cancelBatch(batchId)
    setBatch(b => b ? { ...b, status: 'canceled' } : b)
  }

  async function handleRetry() {
    await window.api.pdf.retryFailed(batchId)
    setBatch(b => b ? { ...b, status: 'running' } : b)
    loadBatch()
  }

  async function handleDownloadAll() {
    setExporting(true)
    setExportResult(null)
    try {
      const result = await window.api.export.downloadBatch(batchId, null)
      if (result.canceled) { setExporting(false); return }
      if (!result.success) {
        alert('Export failed: ' + result.error)
        setExporting(false)
      }
      // result handled by IPC event
    } catch (err) {
      alert('Export error: ' + err.message)
      setExporting(false)
    }
  }

  async function handleOpenFolder(folderPath) {
    await window.api.export.openFolder(folderPath)
  }

  async function handleDownloadZip() {
    setZipping(true)
    setZipResult(null)
    try {
      const result = await window.api.export.downloadZip(batchId)
      if (result.canceled) { setZipping(false); return }
      if (result.success) {
        setZipResult(result)
      } else {
        alert('ZIP export failed: ' + result.error)
      }
    } catch (err) {
      alert('ZIP error: ' + err.message)
    } finally {
      setZipping(false)
    }
  }

  const isRunning = batch?.status === 'running'
  const isDone = batch?.status === 'done'
  const isCanceled = batch?.status === 'canceled'
  const progressPct = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 0

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(`/project/${projectId}/editor`)} className="btn-ghost btn-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Batch Progress
            {batch?.status && (
              <span className={`badge ${STATUS_BADGE[batch.status] || 'badge-gray'}`}>{batch.status}</span>
            )}
          </h1>
          <p className="text-sm text-gray-500">Batch ID: {batchId?.slice(0, 8)}...</p>
        </div>

        {isRunning && (
          <button className="btn-danger btn-sm" onClick={handleCancel}>Cancel Batch</button>
        )}
        {batch?.failed_count > 0 && !isRunning && (
          <button className="btn-secondary btn-sm" onClick={handleRetry}>Retry Failed</button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-2xl font-bold text-gray-900">{progressPct}%</div>
          <div className="text-sm text-gray-500">{counts.done} / {counts.total} complete</div>
        </div>

        <div className="h-3 bg-surface-100 rounded-full overflow-hidden mb-4">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isRunning ? 'bg-primary-500' : isDone ? 'bg-green-500' : 'bg-gray-400'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Count grid */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Complete', count: counts.done, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Processing', count: counts.active, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Pending', count: counts.pending, color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: 'Failed', count: counts.failed, color: 'text-red-600', bg: 'bg-red-50' },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className={`${bg} rounded-lg p-3 text-center`}>
              <div className={`text-2xl font-bold ${color}`}>{count}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Export Result */}
      {exportResult && (
        <div className="card p-4 mb-5 border-green-200 bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-green-800">✓ Export Complete</div>
              <div className="text-sm text-green-700 mt-0.5">
                {exportResult.exported} files exported to:
              </div>
              <div className="text-xs text-green-600 font-mono mt-1 break-all">{exportResult.destFolder}</div>
              {exportResult.failed > 0 && (
                <div className="text-xs text-red-600 mt-1">{exportResult.failed} files failed to copy</div>
              )}
            </div>
            <button
              className="btn-secondary btn-sm flex-shrink-0 ml-3"
              onClick={() => handleOpenFolder(exportResult.destFolder)}
            >
              Open Folder
            </button>
          </div>
        </div>
      )}

      {/* Export Progress */}
      {exportProgress && (
        <div className="card p-4 mb-5">
          <div className="text-sm font-medium text-gray-700 mb-2">
            Exporting... {exportProgress.exported}/{exportProgress.total}
          </div>
          <div className="text-xs text-gray-500 truncate">{exportProgress.currentFile}</div>
          <div className="h-2 bg-surface-100 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all"
              style={{ width: `${Math.round((exportProgress.exported / exportProgress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Download Action */}
      {counts.done > 0 && (
        <div className="card p-4 mb-5">
          <div className="font-medium text-gray-900 mb-3">Download PDFs</div>
          <div className="flex gap-3 flex-wrap">
            {/* Download to Folder */}
            <div className="flex-1 min-w-[200px] border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-gray-800">📁 Download</div>
                <div className="text-xs text-gray-500 mt-0.5">{counts.done} PDFs → choose folder</div>
              </div>
              <button
                className="btn-secondary btn-sm flex-shrink-0"
                onClick={handleDownloadAll}
                disabled={exporting || zipping}
              >
                {exporting ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : 'Download'}
              </button>
            </div>

            {/* Download as ZIP */}
            <div className="flex-1 min-w-[200px] border border-primary-200 bg-primary-50 rounded-lg p-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-primary-800">📦 Download as ZIP</div>
                <div className="text-xs text-primary-600 mt-0.5">All {counts.done} PDFs in one ZIP file</div>
              </div>
              <button
                className="btn-primary btn-sm flex-shrink-0"
                onClick={handleDownloadZip}
                disabled={exporting || zipping}
              >
                {zipping ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    ZIP
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* ZIP success */}
          {zipResult && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800">
              ✅ ZIP saved — {zipResult.count} PDFs → <span className="font-mono text-xs break-all">{zipResult.zipPath}</span>
            </div>
          )}
        </div>
      )}

      {/* Item List */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-medium text-gray-900 text-sm">PDF Items</span>
          <span className="text-xs text-gray-400">{items.length} total</span>
        </div>
        <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50">
          {items.map((item, i) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-50">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLOR[item.status] || 'bg-gray-200'}`} />
              <div className="text-xs text-gray-400 w-6 text-right flex-shrink-0">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-800 truncate">{item.filename}</div>
                {item.error_message && (
                  <div className="text-xs text-red-500 truncate">{item.error_message}</div>
                )}
              </div>
              <span className={`badge ${STATUS_BADGE[item.status] || 'badge-gray'} flex-shrink-0`}>
                {item.status}
              </span>
            </div>
          ))}
          {items.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No items yet...</div>
          )}
        </div>
      </div>
    </div>
  )
}

