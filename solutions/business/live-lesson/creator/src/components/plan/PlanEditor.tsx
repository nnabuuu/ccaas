/**
 * PlanEditor — editable view of the lesson plan.
 *
 * Uses TipTap (ProseMirror-based) with a custom ReferenceChip node.
 * The component itself stays orchestrational:
 *  - parent loads markdown + builds the chip resolver (same as
 *    PlanTab in read-only mode)
 *  - this component initializes the editor with TipTap JSON converted
 *    from the parsed AST
 *  - on save, the editor's JSON → AST → canonicalize → markdown →
 *    PUT lesson-plan.md
 *
 * The toolbar exposes the common formatting actions plus an "插入
 * 教学要求" button (the design's `/req` slash command but as a
 * button — slash menu UI deferred to a future iteration).
 */

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useState } from 'react'
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Plus,
  Save,
  RefreshCw,
} from 'lucide-react'

import {
  canonicalizeLessonPlan,
  fromTiptapJson,
  makeLookup,
  serializeLessonPlan,
  toTiptapJson,
  type PlanDocument,
} from '../../lib/lesson-plan-md'
import { writeFile } from '../../api/projects'
import type { ReqItem } from '../../api/teaching-requirements'
import { createReferenceChipExtension } from './ReferenceChipNode'
import { HtmlBlockNode } from './HtmlBlockNode'
import type { ChipResolver } from './PlanRenderer'
import ReqPickerModal from './ReqPickerModal'
import InterpretationEditorModal from './InterpretationEditorModal'

interface Props {
  projectId: string
  /** Parsed + canonicalized doc to mount in the editor. */
  initialDoc: PlanDocument
  /** Library lookup for re-canonicalize on save. */
  libraryItems: ReqItem[]
  /** Chip resolver for inline chip rendering (color + interpretation). */
  resolveChip: ChipResolver
  /** Subject for the req picker library scoping. */
  subject?: string
  /** Called after a successful save so the parent can refetch. */
  onSaved?: () => void
  /** Called after an interpretation edit to refresh chip resolutions. */
  onInterpretationChanged?: () => void
  /** Bubble dirty state up so PlanTab can confirm before view-mode switch. */
  onDirtyChange?: (dirty: boolean) => void
}

const LESSON_PLAN_PATH = 'plan/lesson-plan.md'

export default function PlanEditor({
  projectId,
  initialDoc,
  libraryItems,
  resolveChip,
  subject,
  onSaved,
  onInterpretationChanged,
  onDirtyChange,
}: Props) {
  const [showPicker, setShowPicker] = useState(false)
  const [interpretationEditId, setInterpretationEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  // Bubble dirty up so PlanTab can confirm before mode-switch.
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // We use our own atom node for references; let TipTap manage
        // everything else from the default kit.
      }),
      Link.configure({
        openOnClick: false,
        // Block javascript:/data: URLs at the editor level. Our
        // markdown serializer's req:// scheme is fine because it's
        // a different node type entirely.
        protocols: ['http', 'https', 'mailto', 'tel'],
      }),
      Placeholder.configure({
        placeholder: '开始写教案…',
      }),
      createReferenceChipExtension({
        resolveChip,
        onEditInterpretation: (refId) => setInterpretationEditId(refId),
      }),
      // Preserves the agent-contract HTML comment on edit. Without
      // this, StarterKit silently strips unknown block-level HTML.
      HtmlBlockNode,
    ],
    content: toTiptapJson(initialDoc),
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[400px] focus:outline-none px-4 py-3',
      },
    },
    onUpdate() {
      setDirty(true)
    },
  })

  // Replace content if the initial doc changes (e.g. parent reload
  // after a save). Without this, the editor keeps showing whatever
  // it loaded at mount.
  //
  // BUT: if the new doc's markdown equals what we just saved, skip
  // setContent — the user may have started typing again during the
  // PUT, and setContent would wipe their cursor + new keystrokes.
  // We compare via serialized markdown which is what we actually
  // care about being identical.
  useEffect(() => {
    if (!editor) return
    const incomingMarkdown = serializeLessonPlan(initialDoc)
    let currentMarkdown: string | null = null
    try {
      const currentDoc = fromTiptapJson(editor.getJSON() as any)
      currentMarkdown = serializeLessonPlan(currentDoc)
    } catch {
      // editor not yet stable mid-mount; fall through to setContent
    }
    if (currentMarkdown === incomingMarkdown) {
      // No meaningful change. Just clear dirty (we just saved or
      // parent forced a refresh that matched).
      setDirty(false)
      return
    }
    editor.commands.setContent(toTiptapJson(initialDoc), { emitUpdate: false })
    setDirty(false)
  }, [editor, initialDoc])

  if (!editor) {
    return (
      <div className="text-center text-gray-500 py-12">
        <RefreshCw size={20} className="mx-auto animate-spin mb-3" />
        <p className="text-sm">编辑器初始化中…</p>
      </div>
    )
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const json = editor.getJSON()
      const doc = fromTiptapJson(json as any)
      const lookup = makeLookup(libraryItems)
      const canonicalized = canonicalizeLessonPlan(doc, lookup)
      const markdown = serializeLessonPlan(canonicalized)
      await writeFile(projectId, LESSON_PLAN_PATH, markdown)
      setDirty(false)
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handlePickRequirement = (item: {
    id: string
    text: string
    code: string
    categoryLabel: string
  }) => {
    editor.commands.insertReferenceChip({
      refId: item.id,
      text: item.text,
      title: `${item.code} · ${item.categoryLabel}`,
    })
  }

  return (
    <div className="flex flex-col h-full">
      <Toolbar
        editor={editor}
        onInsertReq={() => setShowPicker(true)}
        onSave={handleSave}
        canSave={dirty && !saving}
        saving={saving}
      />

      {error && (
        <div className="mx-4 mt-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          保存失败: {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      <ReqPickerModal
        open={showPicker}
        subject={subject}
        onClose={() => setShowPicker(false)}
        onPick={handlePickRequirement}
      />

      <InterpretationEditorModal
        open={!!interpretationEditId}
        reqId={interpretationEditId}
        onClose={() => setInterpretationEditId(null)}
        onChanged={onInterpretationChanged}
      />
    </div>
  )
}

// ── Toolbar ────────────────────────────────────────────────────────

interface ToolbarProps {
  editor: ReturnType<typeof useEditor>
  onInsertReq: () => void
  onSave: () => void
  canSave: boolean
  saving: boolean
}

function Toolbar({ editor, onInsertReq, onSave, canSave, saving }: ToolbarProps) {
  if (!editor) return null

  const btn = (
    active: boolean,
    onClick: () => void,
    title: string,
    icon: React.ReactNode,
  ) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded hover:bg-gray-200 ${active ? 'bg-gray-200 text-gray-900' : 'text-gray-600'}`}
    >
      {icon}
    </button>
  )

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
      {btn(
        editor.isActive('heading', { level: 1 }),
        () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        '一级标题',
        <Heading1 size={16} />,
      )}
      {btn(
        editor.isActive('heading', { level: 2 }),
        () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        '二级标题',
        <Heading2 size={16} />,
      )}
      {btn(
        editor.isActive('heading', { level: 3 }),
        () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        '三级标题',
        <Heading3 size={16} />,
      )}
      <span className="w-px h-5 bg-gray-300 mx-1" />
      {btn(
        editor.isActive('bold'),
        () => editor.chain().focus().toggleBold().run(),
        '粗体',
        <Bold size={16} />,
      )}
      {btn(
        editor.isActive('italic'),
        () => editor.chain().focus().toggleItalic().run(),
        '斜体',
        <Italic size={16} />,
      )}
      <span className="w-px h-5 bg-gray-300 mx-1" />
      {btn(
        editor.isActive('bulletList'),
        () => editor.chain().focus().toggleBulletList().run(),
        '无序列表',
        <List size={16} />,
      )}
      {btn(
        editor.isActive('orderedList'),
        () => editor.chain().focus().toggleOrderedList().run(),
        '有序列表',
        <ListOrdered size={16} />,
      )}
      {btn(
        editor.isActive('blockquote'),
        () => editor.chain().focus().toggleBlockquote().run(),
        '引用',
        <Quote size={16} />,
      )}
      <span className="w-px h-5 bg-gray-300 mx-1" />
      <button
        type="button"
        onClick={onInsertReq}
        title="插入教学要求"
        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100"
      >
        <Plus size={12} />
        教学要求
      </button>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave}
        className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Save size={12} />
        {saving ? '保存中' : '保存'}
      </button>
    </div>
  )
}
