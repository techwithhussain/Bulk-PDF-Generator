import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import NewProject from './pages/NewProject'
import Editor from './pages/Editor'
import BulkGenerator from './pages/BulkGenerator'
import BatchProgress from './pages/BatchProgress'
import PDFLibrary from './pages/PDFLibrary'
import History from './pages/History'
import Settings from './pages/Settings'
import AppShell from './components/AppShell'
import ActivationScreen from './pages/ActivationScreen'

export default function App() {
  const [activated, setActivated] = useState(null) // null = checking, true/false
  const [userName, setUserName] = useState('')

  useEffect(() => {
    checkActivation()
  }, [])

  async function checkActivation() {
    try {
      const result = await window.api.license.checkLocal()
      setActivated(result.activated)
      if (result.activated) setUserName(result.userName || '')
    } catch {
      // If API not available (dev mode), skip activation
      setActivated(true)
    }
  }

  // Loading
  if (activated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f0f4ff' }}>
        <div className="text-center">
          <svg className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  // Not activated → show activation screen
  if (!activated) {
    return (
      <ActivationScreen
        onActivated={(name) => {
          setUserName(name)
          setActivated(true)
        }}
      />
    )
  }

  // Activated → normal app
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="new-project" element={<NewProject />} />
        <Route path="project/:projectId/editor" element={<Editor />} />
        <Route path="project/:projectId/generate" element={<BulkGenerator />} />
        <Route path="project/:projectId/batch/:batchId" element={<BatchProgress />} />
        <Route path="project/:projectId/library" element={<PDFLibrary />} />
        <Route path="project/:projectId/history" element={<History />} />
        <Route path="library" element={<PDFLibrary />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
