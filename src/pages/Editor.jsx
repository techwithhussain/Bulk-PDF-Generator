import { useEffect, useRef, useCallback, useState } from 'react'
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
  const { currentProject, currentRevision, loadProject, setSaveStatus, saveStatus, findReplaceOpen, setFindReplaceOpen } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [showPageSettings, setShowPageSettings] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const autosaveTimer = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image,
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => {
      setSaveStatus('unsaved')
      scheduleAutosave(editor.getJSON())
    },
  })

  useEffect(() => {
    initProject()
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [projectId])

  // Keyboard shortcut: Ctrl+H for Find & Replace, Ctrl+S for save
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault()
        setFindReplaceOpen(true)
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        handleManualSave()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [editor])

  async function initProject() {
    setLoading(true)
    const data = await loadProject(projectId)
    if (!data) {
      navigate('/')
      return
    }
    if (data.revision && editor) {
      try {
        const content = JSON.parse(data.revision.content_json)
        editor.commands.setContent(content)
      } catch {}
    }
    setLoading(false)
    setSaveStatus('saved')
  }

  function scheduleAutosave(contentJson) {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      doSave(contentJson, 'autosave')
    }, 3000)
  }

  async function doSave(contentJson, label = 'autosave') {
    setSaveStatus('saving')
    try {
      const json = contentJson || (editor ? editor.getJSON() : null)
      if (!json) return
      await window.api.projects.saveContent(projectId, JSON.stringify(json), label)
      setSaveStatus('saved')
    } catch (err) {
      console.error('Save failed:', err)
      setSaveStatus('error')
    }
  }

  async function handleManualSave() {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    if (editor) await doSave(editor.getJSON(), 'manual')
  }

  async function handlePreview() {
    try {
      const result = await window.api.pdf.getPreviewData(projectId, null)
      if (result.success) {
        setPreviewHtml(result.html)
        setShowPreview(true)
      }
    } catch (err) {
      console.error('Preview failed:', err)
    }
  }

  async function handleFindReplaceApply(newContentJson) {
    if (!editor) return
    try {
      const content = JSON.parse(newContentJson)
      editor.commands.setContent(content)
      setSaveStatus('saved')
    } catch {}
    // Reload project to get updated revision
    await loadProject(projectId)
  }

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
      {/* ── Google Docs–style top header ── */}
      <div className="bg-white border-b border-gray-200 px-4 pt-2 pb-0 flex flex-col gap-0">
        {/* Row 1: back + title + actions */}
        <div className="flex items-center gap-2 pb-1.5">
          {/* Back */}
          <button onClick={() => navigate('/')} className="btn-ghost btn-sm p-1.5 rounded-full" title="Back to Dashboard">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Doc icon */}
          <div className="w-8 h-8 rounded flex items-center justify-center bg-blue-500 flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/>
            </svg>
          </div>

          {/* Title + mode + save */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 text-base truncate">{currentProject?.name}</span>
              <span className={`badge text-[10px] ${currentProject?.mode === 'identical' ? 'badge-blue' : 'badge-purple'}`}>
                {currentProject?.mode === 'identical' ? 'Identical' : 'Personalized'}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
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
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5">
            <button
              className="btn-ghost btn-sm flex items-center gap-1.5 text-gray-700 hover:bg-gray-100 rounded-full px-3"
              onClick={() => setFindReplaceOpen(true)}
              title="Find & Replace (Ctrl+H)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-xs hidden sm:inline">Find & Replace</span>
            </button>

            <button
              className="btn-ghost btn-sm flex items-center gap-1.5 text-gray-700 hover:bg-gray-100 rounded-full px-3"
              onClick={() => setShowPageSettings(true)}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs hidden sm:inline">Page Settings</span>
            </button>

            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-300 bg-white text-gray-700 text-xs font-medium hover:bg-gray-50 shadow-sm transition-colors"
              onClick={handlePreview}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-9.797.785C6.14 9.11 9.054 7 12 7c2.945 0 5.859 2.11 6.797 5.785C17.859 16.46 14.945 18 12 18c-2.945 0-5.859-1.54-6.797-4.215z" />
              </svg>
              Preview
            </button>

            <button
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-sm transition-colors"
              onClick={() => navigate(`/project/${projectId}/generate`)}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate PDFs
            </button>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      {editor && <EditorToolbar editor={editor} projectId={projectId} isPersonalized={currentProject?.mode === 'personalized'} />}

      {/* ── Editor Canvas ── */}
      <div className="flex-1 overflow-auto" style={{ background: '#f0f4f9' }}>
        <div className="py-6 px-8">
          {/* Ruler hint */}
          <div className="max-w-[210mm] mx-auto mb-1">
            <div className="flex justify-between text-[10px] text-gray-400 select-none px-1">
              <span>A4 · 210mm × 297mm</span>
              <span className="italic">{currentProject?.name}</span>
            </div>
          </div>
          {/* Paper */}
          <div
            className="max-w-[210mm] mx-auto mb-10 bg-white rounded-sm"
            style={{
              boxShadow: '0 1px 3px rgba(60,64,67,.3), 0 4px 8px rgba(60,64,67,.15)',
              minHeight: '297mm',
            }}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Find & Replace Panel */}
      {findReplaceOpen && (
        <FindReplacePanel
          projectId={projectId}
          onClose={() => setFindReplaceOpen(false)}
          onApplied={handleFindReplaceApply}
        />
      )}

      {/* Page Settings Panel */}
      {showPageSettings && currentProject && (
        <PageSettingsPanel
          projectId={projectId}
          settings={JSON.parse(currentProject.settings_json || '{}')}
          onClose={() => setShowPageSettings(false)}
          onSaved={() => { setShowPageSettings(false); loadProject(projectId) }}
        />
      )}

      {/* PDF Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Document Preview</h2>
              <button onClick={() => setShowPreview(false)} className="btn-ghost btn-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-surface-100">
              <div
                className="max-w-[210mm] mx-auto bg-white shadow-md rounded p-10"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
            <div className="p-3 border-t border-gray-100 text-xs text-gray-400 text-center">
              This is a preview. Final PDF output may vary slightly due to print engine differences.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

