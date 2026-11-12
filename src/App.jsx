import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import NewProject from './pages/NewProject'
import Editor from './pages/Editor'
import BulkGenerator from './pages/BulkGenerator'
import BatchProgress from './pages/BatchProgress'
import PDFLibrary from './pages/PDFLibrary'
import History from './pages/History'
import Settings from './pages/Settings'
import AppShell from './components/AppShell'

export default function App() {
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

