/**
 * InterpretationEditorModal — edits the calling user's L2
 * interpretation for one req.
 *
 * Loads the current interpretation when opened (composite L1+L2 fetch
 * gives us both `text` for context and `myInterpretation.notes` for
 * the editable body), then PUTs on save. Delete button removes the
 * interpretation entirely (the chip popover then shows "add" CTA).
 *
 * Per design §5.5: this is sidecar editing; it never touches the
 * lesson-plan.md file. Chip text/title on screen update only after
 * the next canonicalize pass (which happens on parent reload).
 */

import { useEffect, useRef, useState } from 'react'
import { Trash2, X } from 'lucide-react'

import {
  deleteInterpretation,
  getRequirement,
  putInterpretation,
  type ReqItemWithInterpretation,
} from '../../api/teaching-requirements'

const NOTES_MAX_BYTES = 16_000

interface Props {
  open: boolean
  reqId: string | null
  onClose: () => void
  /** Called after a successful save/delete so the parent can refetch. */
  onChanged?: () => void
}

export default function InterpretationEditorModal({
  open,
  reqId,
  onClose,
  onChanged,
}: Props) {
  const [item, setItem] = useState<ReqItemWithInterpretation | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open || !reqId) return
    previouslyFocused.current = document.activeElement as HTMLElement | null
    setItem(null)
    setNotes('')
    setError(null)
    setLoading(true)
    getRequirement(reqId)
      .then((result) => {
        setItem(result)
        setNotes(result.myInterpretation?.notes ?? '')
        setLoading(false)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      })
    const t = setTimeout(() => textareaRef.current?.focus(), 60)
    return () => {
      clearTimeout(t)
      previouslyFocused.current?.focus?.()
    }
  }, [open, reqId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, saving, onClose])

  if (!open || !reqId) return null

  const byteLength = new Blob([notes]).size
  const overLimit = byteLength > NOTES_MAX_BYTES
  const canSave = !saving && !loading && !overLimit

  const handleSave = async () => {
    if (!canSave || !reqId) return
    setSaving(true)
    setError(null)
    try {
      await putInterpretation(reqId, notes)
      onChanged?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!reqId || !item?.myInterpretation) return
    if (!confirm('删除这条解读? 这个操作不可恢复。')) return
    setSaving(true)
    setError(null)
    try {
      await deleteInterpretation(reqId)
      onChanged?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-20"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="interp-modal-title"
        className="w-full max-w-lg bg-white rounded-xl shadow-lg"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 id="interp-modal-title" className="text-base font-semibold text-gray-900">
            编辑解读
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {loading ? (
            <div className="text-sm text-gray-500 py-4">加载中…</div>
          ) : (
            <>
              {item && (
                <div className="bg-gray-50 border border-gray-200 rounded p-3">
                  <div className="text-sm text-gray-900 font-medium">{item.text}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {item.code} · {item.categoryLabel}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  我的解读 <span className="text-gray-400 font-normal">(markdown)</span>
                </label>
                <textarea
                  ref={textareaRef}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="可以写: 例子 / 评估提示 / 跟其它要求的关联 / 常见陷阱…"
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                />
                <div
                  className={`mt-1 text-xs ${
                    overLimit ? 'text-red-600' : 'text-gray-400'
                  }`}
                >
                  {byteLength} / {NOTES_MAX_BYTES} bytes{' '}
                  {overLimit && '— 超出长度上限'}
                </div>
              </div>

              {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200">
          <div>
            {item?.myInterpretation && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                <Trash2 size={14} />
                删除
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
