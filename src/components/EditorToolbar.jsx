export default function EditorToolbar({ editor, projectId, isPersonalized }) {
  if (!editor) return null

  const btn = (active, action, title, children) => (
    <button
      type="button"
      onClick={action}
      title={title}
      className={`w-8 h-8 rounded flex items-center justify-center text-xs transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700 shadow-inner'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  )

  function insertPlaceholder() {
    const name = window.prompt('Enter placeholder field name (e.g., name, phone, email):')
    if (name) {
      const cleaned = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      if (cleaned) editor.chain().focus().insertContent(`{{${cleaned}}}`).run()
    }
  }

  async function insertImage() {
    const result = await window.api?.dataImport?.chooseFile?.() // Reuse file picker
    // Simplified: use prompt for URL/path
    const src = window.prompt('Image path or URL:')
    if (src) editor.chain().focus().setImage({ src }).run()
  }

  function setLink() {
    const href = window.prompt('Enter URL:', editor.getAttributes('link').href || 'https://')
    if (href === null) return
    if (href === '') {
      editor.chain().focus().unsetLink().run()
    } else {
      editor.chain().focus().setLink({ href }).run()
    }
  }

  function insertTable() {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  const FONT_SIZES = ['10pt', '12pt', '14pt', '16pt', '18pt', '24pt', '32pt']
  const HEADINGS = [1, 2, 3, 4]

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-1 flex items-center gap-0.5 flex-wrap sticky top-0 z-10"
      style={{ boxShadow: '0 1px 3px rgba(60,64,67,.15)' }}
    >
      {/* Undo/Redo */}
      {btn(false, () => editor.chain().focus().undo().run(), 'Undo (Ctrl+Z)',
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6M3 10l6-6"/></svg>)}
      {btn(false, () => editor.chain().focus().redo().run(), 'Redo (Ctrl+Y)',
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10H11a8 8 0 00-8 8v2M21 10l-6 6M21 10l-6-6"/></svg>)}

      <Divider />

      {/* Headings */}
      <select
        className="h-7 px-1 text-xs border border-gray-200 rounded bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-400"
        value={
          HEADINGS.find(h => editor.isActive('heading', { level: h })) 
            ? `h${HEADINGS.find(h => editor.isActive('heading', { level: h }))}`
            : 'p'
        }
        onChange={(e) => {
          if (e.target.value === 'p') editor.chain().focus().setParagraph().run()
          else editor.chain().focus().toggleHeading({ level: parseInt(e.target.value.replace('h','')) }).run()
        }}
      >
        <option value="p">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="h4">Heading 4</option>
      </select>

      <Divider />

      {/* Bold, Italic, Underline, Strike */}
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold (Ctrl+B)',
        <strong className="text-xs">B</strong>)}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic (Ctrl+I)',
        <em className="text-xs">I</em>)}
      {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Underline (Ctrl+U)',
        <span className="text-xs underline">U</span>)}
      {btn(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), 'Strikethrough',
        <span className="text-xs line-through">S</span>)}

      <Divider />

      {/* Text color */}
      <div className="relative group">
        <button title="Text Color" className="w-7 h-7 rounded flex flex-col items-center justify-center hover:bg-surface-100">
          <span className="text-xs font-bold text-gray-700 leading-none">A</span>
          <div className="w-5 h-1 mt-0.5 rounded-sm bg-red-500" />
        </button>
        <input
          type="color"
          className="absolute inset-0 opacity-0 cursor-pointer w-full"
          onChange={e => editor.chain().focus().setColor(e.target.value).run()}
          title="Text Color"
        />
      </div>

      {/* Highlight */}
      {btn(editor.isActive('highlight'), () => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run(), 'Highlight',
        <span className="text-xs bg-yellow-200 px-0.5">H</span>)}

      <Divider />

      {/* Alignment */}
      {btn(editor.isActive({ textAlign: 'left' }), () => editor.chain().focus().setTextAlign('left').run(), 'Align Left',
        <AlignLeftIcon />)}
      {btn(editor.isActive({ textAlign: 'center' }), () => editor.chain().focus().setTextAlign('center').run(), 'Align Center',
        <AlignCenterIcon />)}
      {btn(editor.isActive({ textAlign: 'right' }), () => editor.chain().focus().setTextAlign('right').run(), 'Align Right',
        <AlignRightIcon />)}
      {btn(editor.isActive({ textAlign: 'justify' }), () => editor.chain().focus().setTextAlign('justify').run(), 'Justify',
        <AlignJustifyIcon />)}

      <Divider />

      {/* Lists */}
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bullet List',
        <BulletListIcon />)}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Ordered List',
        <OrderedListIcon />)}

      <Divider />

      {/* Blockquote, HR */}
      {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Blockquote',
        <QuoteIcon />)}
      {btn(false, () => editor.chain().focus().setHorizontalRule().run(), 'Horizontal Rule',
        <span className="text-xs">—</span>)}

      <Divider />

      {/* Table */}
      {btn(false, insertTable, 'Insert Table',
        <TableIcon />)}

      {/* Link */}
      {btn(editor.isActive('link'), setLink, 'Insert Link',
        <LinkIcon />)}

      <Divider />

      {/* Placeholder (personalized mode) */}
      {isPersonalized && (
        <button
          type="button"
          onClick={insertPlaceholder}
          title="Insert Placeholder {{field}}"
          className="h-7 px-2 rounded text-xs font-mono bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
        >
          {'{{field}}'}
        </button>
      )}

      {/* Clear formatting */}
      {btn(false, () => editor.chain().focus().clearNodes().unsetAllMarks().run(), 'Clear Formatting',
        <span className="text-xs">Tx</span>)}
    </div>
  )
}

function Divider() {
  return <div className="w-px h-4 bg-gray-200 mx-1 flex-shrink-0" />
}

function AlignLeftIcon() { return <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 5h18M3 10h12M3 15h18M3 20h12"/></svg> }
function AlignCenterIcon() { return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg> }
function AlignRightIcon() { return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg> }
function AlignJustifyIcon() { return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg> }
function BulletListIcon() { return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg> }
function OrderedListIcon() { return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" fontSize="8" fill="currentColor">1</text><text x="2" y="14" fontSize="8" fill="currentColor">2</text><text x="2" y="20" fontSize="8" fill="currentColor">3</text></svg> }
function QuoteIcon() { return <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391C14.017 10.339 16.5 8 19.5 8h.5V4h-.5C13.254 4 10 7.891 10 13.609V21h4.017zM3.983 21v-7.391C3.983 10.339 6.5 8 9.5 8h.5V4H9.5C3.254 4 0 7.891 0 13.609V21h3.983z"/></svg> }
function TableIcon() { return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg> }
function LinkIcon() { return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> }

