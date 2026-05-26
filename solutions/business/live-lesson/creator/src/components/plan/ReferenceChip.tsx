/**
 * Inline rendering of a `req://` reference. Shows canonical text +
 * category badge; hover/click opens a popover with the user's L2
 * interpretation (or an "add one" affordance if absent).
 *
 * The chip is the focal point of the design's L2 surface: it's where
 * teachers see the canonical standard *and* their own pedagogical
 * notes side-by-side without those notes leaking into the lesson
 * plan file.
 */

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Edit3, FileText } from 'lucide-react'
import type { InterpretationOverlay } from '../../api/teaching-requirements'

const CATEGORY_COLOR_CLASSES: Record<string, string> = {
  teal: 'bg-teal-50 text-teal-700 border-teal-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
}

interface Props {
  refId: string
  text: string
  /** Optional title metadata ("课标 X · 分类"). */
  title: string | null
  /** L1 category color hint — when undefined we fall back to gray. */
  categoryColor?: string
  /** When true, the chip renders as a "broken link" warning. */
  stale?: boolean
  /** L2 interpretation for the current user, null when absent. */
  interpretation: InterpretationOverlay | null
  /** Fires when the user wants to edit / add their interpretation. */
  onEditInterpretation?: () => void
}

export default function ReferenceChip({
  refId,
  text,
  title,
  categoryColor,
  stale,
  interpretation,
  onEditInterpretation,
}: Props) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLSpanElement | null>(null)

  // Close popover on outside click or Escape. Simpler than wiring an
  // accessibility-grade dialog at this layer; chip popover is
  // informational, not modal. Keyboard close is a basic a11y
  // expectation though, so Escape gets handled.
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const colorClass =
    stale
      ? 'bg-red-50 text-red-700 border-red-300'
      : CATEGORY_COLOR_CLASSES[categoryColor ?? ''] ??
        'bg-gray-100 text-gray-700 border-gray-200'

  return (
    <span ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-sm font-medium ${colorClass} hover:opacity-80 transition-opacity`}
        // refId is a stable identifier — surface it as the data
        // attribute so DevTools / e2e tests can target a chip without
        // relying on visible text (which may be canonicalized away).
        data-req-id={refId}
        data-stale={stale ? '1' : '0'}
      >
        {stale && <AlertCircle size={12} />}
        <span>{text}</span>
      </button>

      {open && (
        <span
          role="dialog"
          aria-label="教学要求详情"
          className="absolute top-full left-0 mt-1 z-50 w-80 p-3 bg-white rounded-lg border border-gray-200 shadow-lg text-sm text-left"
        >
          {stale ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-red-600 font-medium">
                <AlertCircle size={14} />
                <span>找不到这条教学要求</span>
              </div>
              <p className="text-xs text-gray-600">
                <span className="font-mono">{refId}</span> 在当前库里不存在了。原文: "{text}"
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div>
                <div className="text-gray-900 font-medium leading-snug">
                  {text}
                </div>
                {title && (
                  <div className="text-xs text-gray-500 mt-0.5">{title}</div>
                )}
              </div>

              <div className="border-t border-gray-100 pt-2.5">
                {interpretation ? (
                  <>
                    <div className="flex items-center justify-between text-xs font-medium text-gray-700 mb-1">
                      <span className="inline-flex items-center gap-1">
                        <FileText size={11} />
                        我的解读
                      </span>
                      {onEditInterpretation && (
                        <button
                          type="button"
                          onClick={onEditInterpretation}
                          className="inline-flex items-center gap-0.5 text-gray-500 hover:text-gray-900"
                        >
                          <Edit3 size={11} />
                          编辑
                        </button>
                      )}
                    </div>
                    <div className="text-gray-700 whitespace-pre-wrap text-xs leading-relaxed max-h-40 overflow-y-auto">
                      {interpretation.notes}
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={onEditInterpretation}
                    disabled={!onEditInterpretation}
                    className="w-full text-left text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <Edit3 size={11} />
                    为这个要求记一些解读
                  </button>
                )}
              </div>
            </div>
          )}
        </span>
      )}
    </span>
  )
}
