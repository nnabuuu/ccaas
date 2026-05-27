import { useEffect, useRef, useState } from 'react'
import { X, BookOpen, Clock, Loader2, AlertCircle } from 'lucide-react'
import { readFile } from '../../api/projects'
import type { Manifest } from '../../types'
import { getStepColor } from '../../types'

/**
 * Course preview — design §3.1 calls for a "预览课程" primary button
 * that opens a fullscreen modal showing the course as students will
 * see it. Full student-side render (live-lesson `frontend/` student
 * shell) requires either an iframe (no session id pre-publish) or
 * cross-package import (non-trivial) — both deferred. For now this
 * modal shows a **read-only summary of the execution manifest**: step
 * list with labels, durations, and strategies. Plus a "完整预览开发中"
 * notice so the user knows it's intentional scope, not a bug.
 *
 * Close: ESC key, click backdrop, or click the × button. The modal
 * traps no focus and uses no portal — design choice for simplicity;
 * if accessibility hardens, switch to a real Dialog primitive.
 */

interface Props {
  projectId: string
  /** Display name in the header chip. */
  projectTitle: string
  open: boolean
  onClose: () => void
}

export default function CoursePreviewModal({
  projectId,
  projectTitle,
  open,
  onClose,
}: Props) {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch the manifest only when the modal is open. Re-fetch on each
  // open so a teacher who edits + reopens sees fresh content (cheap
  // operation; backend caches).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setManifest(null)
    readFile(projectId, 'execution/manifest.json')
      .then(({ content }) => {
        if (cancelled) return
        try {
          const parsed = JSON.parse(content) as Manifest
          setManifest(parsed)
        } catch (e) {
          setError(e instanceof Error ? e.message : '解析 manifest 失败')
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : '加载 manifest 失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, projectId])

  // ESC-to-close. Attached only while open to avoid leaking listeners.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Track where a mousedown started so a click-drag that begins
  // inside the modal body but ends on the backdrop doesn't dismiss
  // the modal mid-text-selection. The backdrop only closes on a
  // genuine click that BOTH started and ended on itself.
  const backdropMouseDown = useRef(false)

  if (!open) return null

  const steps = manifest?.readingSteps ?? []
  const totalDuration = steps.reduce(
    (sum, s) => sum + (typeof s.duration === 'number' ? s.duration : 0),
    0,
  )

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6"
      onMouseDown={(e) => {
        // Only count the press as a backdrop press when it literally
        // landed on the backdrop element itself, not when bubbled up
        // from a child.
        backdropMouseDown.current = e.target === e.currentTarget
      }}
      onMouseUp={(e) => {
        // Close only when BOTH endpoints of the click land on the
        // backdrop. A drag from anywhere onto / off the backdrop
        // doesn't dismiss — that includes text-selection drags from
        // the body releasing on the backdrop AND backdrop presses
        // that drag into the body. Using mouseup (with onClick
        // dropped) sidesteps `click` event dispatch on the common
        // ancestor when down + up land on different elements.
        if (backdropMouseDown.current && e.target === e.currentTarget) {
          onClose()
        }
        backdropMouseDown.current = false
      }}
      role="dialog"
      aria-modal="true"
      aria-label="课程预览"
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
          <BookOpen size={18} className="text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900 flex-1 truncate">
            预览课程 · {projectTitle}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">
            完整预览开发中
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
            aria-label="关闭预览"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
              <Loader2 size={16} className="animate-spin" />
              加载课程数据…
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {!loading && !error && manifest && (
            <>
              {/* Course meta */}
              <div className="mb-5 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                <div className="font-medium text-gray-900">{manifest.title}</div>
                <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                  {manifest.subject && <span>学科: {manifest.subject}</span>}
                  {manifest.gradeLevel && <span>学段: {manifest.gradeLevel}</span>}
                  {manifest.lessonType && <span>课型: {manifest.lessonType}</span>}
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {totalDuration} 分钟 · {steps.length} 个 step
                  </span>
                </div>
                {manifest.description && (
                  <p className="mt-2 text-xs text-gray-600 leading-relaxed">
                    {manifest.description}
                  </p>
                )}
              </div>

              {/* Step list — read-only summary */}
              <div className="space-y-2">
                {steps.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400">
                    课程尚无 step
                  </div>
                ) : (
                  steps.map((step, i) => {
                    const color = getStepColor(i)
                    return (
                      <div
                        key={step.id}
                        className={`px-4 py-3 bg-white border border-gray-200 border-l-4 ${STEP_BORDER[color]} rounded-md`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold px-1.5 py-0.5 rounded ${STEP_BADGE[color]}`}
                          >
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-gray-900 flex-1 truncate">
                            {step.label || '(未命名 step)'}
                          </span>
                          {typeof step.duration === 'number' && (
                            <span className="text-xs text-gray-400 inline-flex items-center gap-1">
                              <Clock size={10} />
                              {step.duration} 分
                            </span>
                          )}
                        </div>
                        {step.strategy && (
                          <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                            策略: {step.strategy}
                          </p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Footer note about scope */}
              <div className="mt-6 px-4 py-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 leading-relaxed">
                <strong>说明: </strong>
                这里只是课程结构的只读概览。 完整的学生端预览 (按 phase
                呈现互动、AI 对话、计分等) 还在开发中, 暂时可以通过
                "发布" 按钮把课程发到 lesson 库, 再用学生端打开实际课堂。
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const STEP_BORDER: Record<string, string> = {
  teal: 'border-l-teal-400',
  blue: 'border-l-blue-400',
  purple: 'border-l-purple-400',
  amber: 'border-l-amber-400',
  green: 'border-l-green-400',
}

const STEP_BADGE: Record<string, string> = {
  teal: 'bg-teal-100 text-teal-800',
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
  amber: 'bg-amber-100 text-amber-800',
  green: 'bg-green-100 text-green-800',
}
