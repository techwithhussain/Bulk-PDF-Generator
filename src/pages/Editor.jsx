import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import useAppStore from '../store/appStore'
import EditorToolbar from '../components/EditorToolbar'
import FindReplacePanel from '../components/FindReplacePanel'
import PageSettingsPanel from '../components/PageSettingsPanel'

export default function Editor() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { currentProject, loadProject, setSaveStatus, saveStatus, findReplaceOpen, setFindReplaceOpen } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [showPageSettings, setShowPageSettings] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')

  // ── Data Tabs State ──────────────────────────────────────────────────────────
  const [dataRows, setDataRows] = useState([])
  const [activeTab, setActiveTab] = useState('template')
  const [tabHtml, setTabHtml] = useState('')
  const [tabLoading, setTabLoading] = useState(false)
  const [pendingContent, setPendingContent] = useState(null)

  const autosaveTimer = useRef(null)
  const refreshTimer = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit, Underline, TextStyle, Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
    ],
    content: '',
    editorProps: { attributes: { class: 'tiptap-editor', spellcheck: 'true' } },
    onUpdate: ({ editor }) => {
      setSaveStatus('unsaved')
      scheduleAutosave(editor.getJSON())
    },
  })

  useEffect(() => {
    initProject()
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, [projectId])

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'h') { e.preventDefault(); setFindReplaceOpen(prev => !prev) }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleManualSave() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [editor])

  // Set content once editor is ready
  useEffect(() => {
    if (editor && pendingContent !== null) {
      try { editor.commands.setContent(JSON.parse(pendingContent)) } catch {}
      setPendingContent(null)
    }
  }, [editor, pendingContent])

  async function initProject() {
    setLoading(true)
    const data = await loadProject(projectId)
    if (!data) { navigate('/'); return }
    if (data.revision) {
      setPendingContent(data.revision.content_json)
    }
    if (data.project?.mode === 'personalized' && data.dataset?.id) {
      try {
        const res = await window.api.dataImport.getRows(data.dataset.id, 100, 0)
        if (res.success && res.rows?.length > 0) {
          setDataRows(res.rows.map(r => ({ ...r.data, _rowIndex: r.rowIndex })))
        }
      } catch {}
    } else if (data.project?.mode === 'personalized') {
      // No project dataset — try global airlines
      try {
        const res = await window.api.airlines.asRows()
        if (res.success && res.rows?.length > 0) {
          setDataRows(res.rows.map(r => ({ ...r.data, _rowIndex: r.rowIndex })))
        }
      } catch {}
    }
    setLoading(false)
    setSaveStatus('saved')
  }

  function scheduleAutosave(contentJson) {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => doSave(contentJson, 'autosave'), 3000)
  }

  async function doSave(contentJson, label = 'autosave') {
    setSaveStatus('saving')
    try {
      const json = contentJson || (editor ? editor.getJSON() : null)
      if (!json) return
      await window.api.projects.saveContent(projectId, JSON.stringify(json), label)
      setSaveStatus('saved')
    } catch { setSaveStatus('error') }
  }

  async function handleManualSave() {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    if (editor) await doSave(editor.getJSON(), 'manual')
  }

  async function handlePreview() {
    try {
      const result = await window.api.pdf.getPreviewData(projectId, null)
      if (result.success) { setPreviewHtml(result.html); setShowPreview(true) }
    } catch {}
  }

  async function switchTab(tab) {
    setActiveTab(tab)
    if (tab !== 'template') {
      await fetchRowPreview(tab)
    }
  }

  async function fetchRowPreview(rowIndex) {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    setTabLoading(true)
    try {
      const rowData = dataRows[rowIndex]
      const result = await window.api.pdf.getPreviewData(projectId, rowData)
      if (result.success) setTabHtml(result.html)
    } catch {}
    setTabLoading(false)
  }

  async function handleLoadCsv() {
    try {
      const result = await window.api.dataImport.chooseFile()
      if (!result?.success || !result?.filePath) return
      const filePath = result.filePath
      const parsed = await window.api.dataImport.parseFile(filePath)
      if (!parsed.success || !parsed.rows?.length) { alert('CSV parse nahi hua.'); return }
      const saved = await window.api.dataImport.saveDataset(projectId, {
        filename: filePath.split(/[\\/]/).pop(),
        columns: parsed.columns, rows: parsed.rows, totalRows: parsed.rows.length,
      })
      if (saved.success) {
        const res = await window.api.dataImport.getRows(saved.datasetId, 100, 0)
        if (res.success && res.rows?.length > 0) {
          setDataRows(res.rows.map(r => ({ ...r.data, _rowIndex: r.rowIndex })))
          setActiveTab('template')
        }
      }
    } catch (err) { console.error('CSV load failed:', err) }
  }

  async function handleFindReplaceApply(newContentJson) {
    if (!editor) return
    try { editor.commands.setContent(JSON.parse(newContentJson)); setSaveStatus('saved') } catch {}
    await loadProject(projectId)
  }

  function getRowLabel(row, index) {
    const val = row.airline || row.Airline || row.AIRLINE ||
                row.name || row.Name || row.NAME ||
                row.company || row.Company || null
    return val ? String(val).substring(0, 18) : `Row ${index + 1}`
  }

  const isPersonalized = currentProject?.mode === 'personalized'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <svg className="w-6 h-6 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading editor...
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa]">

      {/* ── Top Header ── */}
      <div className="bg-white border-b border-gray-200 px-4 pt-2 pb-0 flex-shrink-0">
        <div className="flex items-center gap-2 pb-1.5">
          <button onClick={() => navigate('/')} className="btn-ghost btn-sm p-1.5 rounded-full">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="w-8 h-8 rounded flex items-center justify-center bg-blue-500 flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 text-base truncate">{currentProject?.name}</span>
              <span className={`badge text-[10px] ${!isPersonalized ? 'badge-blue' : 'badge-purple'}`}>
                {!isPersonalized ? 'Identical' : 'Personalized'}
              </span>
            </div>
            <span className={`text-[11px] ${
              saveStatus === 'saved' ? 'text-gray-500' :
              saveStatus === 'saving' ? 'text-blue-500' :
              saveStatus === 'unsaved' ? 'text-amber-600' : 'text-red-500'
            }`}>
              {saveStatus === 'saved' ? '✓ All changes saved' :
               saveStatus === 'saving' ? 'Saving...' :
               saveStatus === 'unsaved' ? '● Unsaved changes' : '✕ Save error'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="btn-ghost btn-sm flex items-center gap-1.5 text-gray-700 hover:bg-gray-100 rounded-full px-3"
              onClick={() => setFindReplaceOpen(true)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-xs hidden sm:inline">Find & Replace</span>
            </button>
            <button className="btn-ghost btn-sm flex items-center gap-1.5 text-gray-700 hover:bg-gray-100 rounded-full px-3"
              onClick={() => setShowPageSettings(true)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs hidden sm:inline">Page Settings</span>
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-300 bg-white text-gray-700 text-xs font-medium hover:bg-gray-50 shadow-sm"
              onClick={handlePreview}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-9.797.785C6.14 9.11 9.054 7 12 7c2.945 0 5.859 2.11 6.797 5.785C17.859 16.46 14.945 18 12 18c-2.945 0-5.859-1.54-6.797-4.215z" />
              </svg>
              Preview
            </button>
            <button className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-sm"
              onClick={() => navigate(`/project/${projectId}/generate`)}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate PDFs
            </button>
          </div>
        </div>
      </div>

      {/* ── Toolbar (always visible — grayed out in preview tab) ── */}
      {editor && (
        <div className={activeTab !== 'template' ? 'opacity-40 pointer-events-none' : ''}>
          <EditorToolbar editor={editor} projectId={projectId} isPersonalized={isPersonalized} />
        </div>
      )}

      {/* ── Main Area: Left Sidebar + Content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT SIDEBAR: Pages / Tabs (Google Docs style) ── */}
        {isPersonalized && (
          <div className="flex flex-col bg-[#f1f3f4] border-r border-gray-200"
            style={{ flex: '0 0 160px', width: '160px', maxWidth: '160px', overflow: 'hidden' }}>

            {/* Sidebar header */}
            <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Pages</span>
              {dataRows.length > 0 && (
                <span className="text-[9px] text-gray-400 bg-white rounded-full px-1.5 py-0.5 border border-gray-200">
                  {dataRows.length}
                </span>
              )}
            </div>

            {/* Scrollable tab list */}
            <div className="flex-1 overflow-y-scroll py-1" style={{ scrollbarWidth: 'thin' }}>

              {/* Template tab */}
              <button
                onClick={() => switchTab('template')}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                  activeTab === 'template'
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600 font-medium'
                    : 'text-gray-600 hover:bg-white hover:text-gray-900'
                }`}
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="truncate">Template</span>
              </button>

              {/* Divider */}
              {dataRows.length > 0 && <div className="mx-3 my-1 border-t border-gray-200" />}

              {/* Row tabs */}
              {dataRows.map((row, i) => (
                <button
                  key={i}
                  onClick={() => switchTab(i)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                    activeTab === i
                      ? 'bg-purple-50 text-purple-700 border-r-2 border-purple-600 font-medium'
                      : 'text-gray-600 hover:bg-white hover:text-gray-900'
                  }`}
                >
                  <svg className="w-3 h-3 flex-shrink-0 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
                  </svg>
                  <span className="truncate">{getRowLabel(row, i)}</span>
                </button>
              ))}

              {/* Load CSV button */}
              <div className="px-2 pt-2 pb-3">
                <button
                  onClick={handleLoadCsv}
                  className="w-full flex items-center gap-1.5 justify-center text-[10px] text-blue-600 bg-white hover:bg-blue-50 border border-blue-200 rounded-md px-2 py-1.5 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {dataRows.length > 0 ? 'Change CSV' : 'Load CSV'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── RIGHT: Editor / Preview Area (overflow-y:scroll = no layout shift) ── */}
        <div className="flex-1 overflow-y-scroll" style={{ background: '#f0f4f9' }}>
          <div className="py-6 px-8">

            {/* Info bar — changes based on active tab */}
            <div style={{ width: '100%', maxWidth: '210mm' }} className="mx-auto mb-1 flex items-center justify-between px-1">
              <span className="text-[10px] text-gray-400 select-none">A4 · 210mm × 297mm</span>
              {activeTab !== 'template' ? (
                <div className="flex items-center gap-2">
                  <span className="bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 text-[10px] font-medium">
                    Preview: {getRowLabel(dataRows[activeTab], activeTab)}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => activeTab > 0 && switchTab(activeTab - 1)}
                      disabled={activeTab <= 0}
                      className="p-1 rounded hover:bg-gray-200 disabled:opacity-30">
                      <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-[10px] text-gray-500">{activeTab + 1}/{dataRows.length}</span>
                    <button onClick={() => activeTab < dataRows.length - 1 && switchTab(activeTab + 1)}
                      disabled={activeTab >= dataRows.length - 1}
                      className="p-1 rounded hover:bg-gray-200 disabled:opacity-30">
                      <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <span className="text-[10px] text-gray-400 italic select-none">{currentProject?.name}</span>
              )}
            </div>
            {/* ── Single Paper div — always same size, content changes ── */}
            {/* -- Single Paper div -- editor always rendered, preview overlays -- */}
            <div className="mx-auto mb-10 bg-white rounded-sm"
              style={{ width: '100%', maxWidth: '210mm', position: 'relative', boxShadow: '0 1px 3px rgba(60,64,67,.3), 0 4px 8px rgba(60,64,67,.15)', minHeight: '297mm' }}>

              {/* Editor -- ALWAYS in DOM, visibility hidden not display:none -- */}
              <div style={{ visibility: activeTab === 'template' ? 'visible' : 'hidden' }}>
                <EditorContent editor={editor} />
              </div>

              {/* Preview -- absolute overlay on top of editor -- */}
              {activeTab !== 'template' && (
                tabLoading ? (
                  <div className="flex items-center justify-center" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'white', zIndex: 1 }}>
                    <div className="text-center text-gray-400">
                      <svg className="w-6 h-6 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <p className="text-xs">Rendering preview...</p>
                    </div>
                  </div>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: tabHtml }}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, minHeight: '100%', background: 'white', zIndex: 1, padding: '25.4mm' }} />
                )
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Panels ── */}
      {findReplaceOpen && (
        <FindReplacePanel projectId={projectId} onClose={() => setFindReplaceOpen(false)} onApplied={handleFindReplaceApply} />
      )}
      {showPageSettings && currentProject && (
        <PageSettingsPanel projectId={projectId}
          settings={JSON.parse(currentProject.settings_json || '{}')}
          onClose={() => setShowPageSettings(false)}
          onSaved={() => { setShowPageSettings(false); loadProject(projectId) }} />
      )}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Document Preview</h2>
              <button onClick={() => setShowPreview(false)} className="btn-ghost btn-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-50">
              <div className="w-[210mm] mx-auto bg-white shadow-md rounded" style={{ padding: "25.4mm" }}
                dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
