import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function NewProject() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [name, setName] = useState('')
  const [mode, setMode] = useState(searchParams.get('mode') || 'identical')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate(e) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) { setError('Project name is required'); return }
    setLoading(true)
    setError('')

    try {
      const result = await window.api.projects.create({ name: trimmedName, mode })
      if (result.success) {
        navigate(`/project/${result.project.id}/editor`)
      } else {
        setError(result.error || 'Failed to create project')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      {/* Back */}
      <button onClick={() => navigate('/')} className="btn-ghost btn-sm mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="card p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-6">New Project</h1>

        <form onSubmit={handleCreate} className="space-y-5">
          {/* Project Name */}
          <div>
            <label className="label">Project Name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g., Customer Welcome Letters"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              autoFocus
              maxLength={100}
            />
          </div>

          {/* Mode Selection */}
          <div>
            <label className="label">Generation Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('identical')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  mode === 'identical'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                </div>
                <div className="font-semibold text-sm text-gray-900">Identical PDFs</div>
                <div className="text-xs text-gray-500 mt-0.5">Same content, up to 50 copies</div>
              </button>

              <button
                type="button"
                onClick={() => setMode('personalized')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  mode === 'personalized'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                  <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="font-semibold text-sm text-gray-900">Personalized PDFs</div>
                <div className="text-xs text-gray-500 mt-0.5">{"{{placeholders}} + CSV/Excel data"}</div>
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => navigate('/')}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating...
                </>
              ) : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

