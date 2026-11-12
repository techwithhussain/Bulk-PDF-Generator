import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const STATUS_BADGE = {
  done: 'badge-green',
  running: 'badge-blue',
  failed: 'badge-red',
  pending: 'badge-yellow',
  canceled: 'badge-gray',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    setLoading(true)
    try {
      if (!window.api) { setLoading(false); return }
      const result = await window.api.projects.list()
      if (result.success) setProjects(result.projects)
    } catch (err) {
      console.error('Failed to load projects:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(e, projectId) {
    e.stopPropagation()
    if (!confirm('Delete this project? This cannot be undone.')) return
    await window.api.projects.delete(projectId)
    loadProjects()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage your PDF projects</p>
        </div>
        <button className="btn-primary btn-lg" onClick={() => navigate('/new-project')}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {/* Quick Start Cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => navigate('/new-project?mode=identical')}
          className="card p-5 text-left hover:border-primary-300 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Identical PDFs</h3>
          <p className="text-sm text-gray-500">Create up to 50 copies of the same document with different filenames</p>
        </button>

        <button
          onClick={() => navigate('/new-project?mode=personalized')}
          className="card p-5 text-left hover:border-primary-300 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-purple-100 transition-colors">
            <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Personalized PDFs</h3>
          <p className="text-sm text-gray-500">Use CSV/Excel data to generate unique PDFs for each row with {"{{placeholders}}"}</p>
        </button>
      </div>

      {/* Recent Projects */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Projects</h2>

        {loading ? (
          <div className="card p-8 text-center text-gray-400">
            <svg className="w-6 h-6 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading...
          </div>
        ) : projects.length === 0 ? (
          <div className="card p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-gray-500 font-medium">No projects yet</h3>
            <p className="text-sm text-gray-400 mt-1">Create your first project to get started</p>
            <button className="btn-primary mt-4" onClick={() => navigate('/new-project')}>
              Create First Project
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/project/${project.id}/editor`)}
                className="card p-4 flex items-center gap-4 cursor-pointer hover:border-gray-300 hover:shadow transition-all"
              >
                {/* Mode icon */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  project.mode === 'identical' ? 'bg-blue-50' : 'bg-purple-50'
                }`}>
                  {project.mode === 'identical' ? (
                    <svg className="w-4.5 h-4.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                    </svg>
                  ) : (
                    <svg className="w-4.5 h-4.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">{project.name}</span>
                    <span className={`badge ${project.mode === 'identical' ? 'badge-blue' : 'badge-purple'}`}>
                      {project.mode === 'identical' ? 'Identical' : 'Personalized'}
                    </span>
                    {project.last_batch_status && (
                      <span className={`badge ${STATUS_BADGE[project.last_batch_status] || 'badge-gray'}`}>
                        {project.last_batch_status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-0.5">
                    <span className="text-xs text-gray-400">
                      {project.pdf_count || 0} PDFs · {project.batch_count || 0} batches
                    </span>
                    <span className="text-xs text-gray-400">
                      Modified {formatDate(project.updated_at)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/project/${project.id}/generate`) }}
                    className="btn-ghost btn-sm"
                    title="Generate PDFs"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, project.id)}
                    className="btn-ghost btn-sm text-red-500 hover:text-red-700 hover:bg-red-50"
                    title="Delete project"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatDate(isoString) {
  if (!isoString) return 'Never'
  const d = new Date(isoString)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return d.toLocaleDateString()
}

