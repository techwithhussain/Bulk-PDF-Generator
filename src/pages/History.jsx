import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const LABEL_BADGE = {
  autosave: 'badge-gray',
  manual: 'badge-blue',
  'pre-replace': 'badge-yellow',
  replace: 'badge-purple',
  restored: 'badge-green',
  initial: 'badge-gray',
}

export default function History() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [revisions, setRevisions] = useState([])
  const [replaceEvents, setReplaceEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('revisions')
  const [restoring, setRestoring] = useState(null)
  const [projectName, setProjectName] = useState('')

  useEffect(() => {
    loadHistory()
  }, [projectId])

  async function loadHistory() {
    setLoading(true)
    try {
      const [projectData, revisionsData, eventsData] = await Promise.all([
        window.api.projects.get(projectId),
        window.api.projects.getRevisions(projectId),
        window.api.findReplace.getHistory(projectId),
      ])

      if (projectData.success) setProjectName(projectData.project?.name || '')
      if (revisionsData.success) setRevisions(revisionsData.revisions)
      if (eventsData.success) setReplaceEvents(eventsData.events)
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRestore(revisionId, label) {
    if (!confirm(`Restore this revision (${label})?\nThis will create a new revision with the restored content. Your current content will still be available in history.`)) return

    setRestoring(revisionId)
    try {
      const result = await window.api.projects.restoreRevision(revisionId)
      if (result.success) {
        alert('Revision restored. Opening editor with restored content...')
        navigate(`/project/${projectId}/editor`)
      } else {
        alert('Restore failed: ' + result.error)
      }
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setRestoring(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(`/project/${projectId}/editor`)} className="btn-ghost btn-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">History</h1>
          {projectName && (
            <p className="text-sm text-gray-500 mt-0.5">{projectName}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-surface-100 rounded-xl p-1 w-fit">
        {[
          { id: 'revisions', label: 'Source Revisions', count: revisions.length },
          { id: 'replacements', label: 'Find & Replace Log', count: replaceEvents.length },
        ].map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === id ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-12 text-center text-gray-400">
          <svg className="w-6 h-6 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading history...
        </div>
      ) : activeTab === 'revisions' ? (
        <div>
          {revisions.length === 0 ? (
            <div className="card p-12 text-center">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500">No revisions yet. Start editing to create your first revision.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-surface-50">
                <p className="text-xs text-gray-500">
                  {revisions.length} revision{revisions.length !== 1 ? 's' : ''} · 
                  Autosaves are kept for the last 20 versions. Manual saves and replace snapshots are kept permanently.
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {revisions.map((rev, index) => (
                  <div key={rev.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-50 transition-colors">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center pt-1">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        index === 0 ? 'bg-primary-500' : 'bg-gray-300'
                      }`} />
                      {index < revisions.length - 1 && (
                        <div className="w-px h-full min-h-[20px] bg-gray-100 mt-1" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`badge ${LABEL_BADGE[rev.label] || 'badge-gray'}`}>
                          {rev.label}
                        </span>
                        {index === 0 && (
                          <span className="badge badge-green">Current</span>
                        )}
                        <span className="text-xs text-gray-400">{formatDate(rev.created_at)}</span>
                      </div>
                      {rev.description && (
                        <p className="text-sm text-gray-600">{rev.description}</p>
                      )}
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{rev.id.slice(0, 8)}...</p>
                    </div>

                    {index !== 0 && (
                      <button
                        onClick={() => handleRestore(rev.id, rev.label)}
                        disabled={restoring === rev.id}
                        className="btn-secondary btn-sm flex-shrink-0"
                      >
                        {restoring === rev.id ? (
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M3 10h10a8 8 0 018 8v2M3 10l6 6M3 10l6-6" />
                          </svg>
                        )}
                        Restore
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          {replaceEvents.length === 0 ? (
            <div className="card p-12 text-center">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-gray-500">No Find & Replace operations have been performed yet.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="divide-y divide-gray-50">
                {replaceEvents.map((ev) => (
                  <div key={ev.id} className="px-4 py-3 hover:bg-surface-50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="badge badge-blue">Replace</span>
                          <span className="text-xs text-gray-400">{formatDate(ev.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <code className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-xs font-mono">
                            {ev.find_text}
                          </code>
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                          <code className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs font-mono">
                            {ev.replace_text || '(empty)'}
                          </code>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span>{ev.match_count} match{ev.match_count !== 1 ? 'es' : ''}</span>
                          <span>·</span>
                          <span>{ev.affected_pdfs} PDF{ev.affected_pdfs !== 1 ? 's' : ''} affected</span>
                          <span>·</span>
                          <span className="capitalize">Scope: {ev.scope}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
  return d.toLocaleString()
}

