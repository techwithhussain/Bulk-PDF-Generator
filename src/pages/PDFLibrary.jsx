import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const STATUS_BADGE = {
  done: 'badge-green',
  pending: 'badge-yellow',
  failed: 'badge-red',
  canceled: 'badge-gray',
  processing: 'badge-blue',
}

export default function PDFLibrary() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    loadItems()
  }, [projectId])

  async function loadItems() {
    setLoading(true)
    try {
      let result
      if (projectId) {
        result = await window.api.library.getItems(projectId)
      } else {
        result = await window.api.library.getAllItems()
      }
      if (result.success) setItems(result.items)
    } catch (err) {
      console.error('Failed to load library:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(e, itemId) {
    e.stopPropagation()
    if (!confirm('Delete this PDF record? The file will also be removed.')) return
    try {
      await window.api.library.deleteItem(itemId)
      setItems(prev => prev.filter(i => i.id !== itemId))
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
  }

  async function handleOpenFolder(e, itemId) {
    e.stopPropagation()
    try {
      await window.api.library.openContainingFolder(itemId)
    } catch (err) {
      alert('Failed to open folder: ' + err.message)
    }
  }

  const filtered = items.filter(item => {
    const matchSearch = !search ||
      item.filename?.toLowerCase().includes(search.toLowerCase()) ||
      item.project_name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || item.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {projectId && (
          <button onClick={() => navigate(`/project/${projectId}/editor`)} className="btn-ghost btn-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">PDF Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {projectId ? 'Generated PDFs for this project' : 'All generated PDFs'}
          </p>
        </div>
        <button
          onClick={loadItems}
          className="btn-secondary btn-sm"
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card p-3 mb-5 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="input pl-9"
            placeholder="Search by filename or project..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-auto"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="done">Completed</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
          <option value="canceled">Canceled</option>
        </select>
      </div>

      {/* Stats */}
      {items.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total', count: items.length, color: 'text-gray-900', bg: 'bg-surface-50' },
            { label: 'Completed', count: items.filter(i => i.status === 'done').length, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'Failed', count: items.filter(i => i.status === 'failed').length, color: 'text-red-700', bg: 'bg-red-50' },
            { label: 'Exported', count: items.filter(i => i.exported_at).length, color: 'text-blue-700', bg: 'bg-blue-50' },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className={`card p-3 text-center ${bg}`}>
              <div className={`text-2xl font-bold ${color}`}>{count}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="card p-12 text-center text-gray-400">
          <svg className="w-6 h-6 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-gray-500 font-medium">
            {items.length === 0 ? 'No PDFs generated yet' : 'No PDFs match your filter'}
          </h3>
          {items.length === 0 && (
            <p className="text-sm text-gray-400 mt-1">
              Generate PDFs from a project to see them here
            </p>
          )}
          {search && (
            <button className="btn-ghost btn-sm mt-3" onClick={() => setSearch('')}>Clear search</button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filename</th>
                  {!projectId && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Generated</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exported</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/>
                        </svg>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate max-w-[200px]">{item.filename}</div>
                          {item.is_outdated ? (
                            <span className="text-xs text-orange-600">⚠ Outdated</span>
                          ) : item.is_customized ? (
                            <span className="text-xs text-purple-600">★ Customized</span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    {!projectId && (
                      <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">{item.project_name}</td>
                    )}
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_BADGE[item.status] || 'badge-gray'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {item.generated_at ? formatDate(item.generated_at) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {item.exported_at ? (
                        <span className="text-green-600">{formatDate(item.exported_at)}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {item.file_path && (
                          <button
                            onClick={(e) => handleOpenFolder(e, item.id)}
                            className="btn-ghost btn-sm"
                            title="Show in Explorer"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(e, item.id)}
                          className="btn-ghost btn-sm text-red-500 hover:text-red-700 hover:bg-red-50"
                          title="Delete"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-100 bg-surface-50 text-xs text-gray-400">
            Showing {filtered.length} of {items.length} PDF{items.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}

function formatDate(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return d.toLocaleDateString()
}

