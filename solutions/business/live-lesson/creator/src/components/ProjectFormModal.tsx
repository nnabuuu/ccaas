import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { listSubjects } from '../api/teaching-requirements'

/**
 * Shared form modal for creating + editing projects. Both flows take
 * the same three fields (title, description, subjects); only the
 * heading text, submit-button label, and submit handler differ.
 *
 * Subject picker is a checkbox group rather than a multi-select dropdown:
 * the catalog is small (2-5 subjects in practice) and checkboxes make
 * "no subjects" an obvious explicit state instead of a hidden default.
 *
 * The subject list is fetched on open via /api/teaching-requirements/_subjects
 * — kept inside the modal (vs lifting to a parent) because both create
 * and edit flows are the only consumers; a singleton fetch would mean
 * stale data on backend reload.
 */

const TITLE_MAX = 100
const DESC_MAX = 500

export interface ProjectFormValues {
  title: string
  description: string
  subjects: string[]
}

interface Props {
  open: boolean
  title: string
  submitLabel: string
  initialValues?: ProjectFormValues
  onClose: () => void
  onSubmit: (values: ProjectFormValues) => Promise<void>
}

const EMPTY_VALUES: ProjectFormValues = {
  title: '',
  description: '',
  subjects: [],
}

export default function ProjectFormModal({
  open,
  title: heading,
  submitLabel,
  initialValues,
  onClose,
  onSubmit,
}: Props) {
  const [values, setValues] = useState<ProjectFormValues>(EMPTY_VALUES)
  const [availableSubjects, setAvailableSubjects] = useState<string[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    // Stash the element that had focus before opening so we can return
    // focus there when the modal closes (a11y: AT users shouldn't lose
    // their place).
    previouslyFocused.current = document.activeElement as HTMLElement | null
    setValues(initialValues ?? EMPTY_VALUES)
    setError(null)
    setSubmitting(false)
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => {
      clearTimeout(t)
      previouslyFocused.current?.focus?.()
    }
    // initialValues intentionally omitted: only the open transition
    // should reset, not every parent re-render that produces a new
    // initialValues reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    // Fetch the subject catalog once per open. Failures surface as a
    // disabled picker section with an error message; the form is still
    // submittable (a project with zero subjects is valid).
    let cancelled = false
    listSubjects()
      .then((subjects) => {
        if (!cancelled) setAvailableSubjects(subjects)
      })
      .catch((err) => {
        if (cancelled) return
        setAvailableSubjects([])
        // eslint-disable-next-line no-console
        console.warn('failed to load subject catalog:', err)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, submitting, onClose])

  if (!open) return null

  const trimmedTitle = values.title.trim()
  const canSubmit =
    trimmedTitle.length > 0 && trimmedTitle.length <= TITLE_MAX && !submitting

  const toggleSubject = (subject: string) => {
    setValues((v) => {
      const has = v.subjects.includes(subject)
      return {
        ...v,
        subjects: has
          ? v.subjects.filter((s) => s !== subject)
          : [...v.subjects, subject],
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        title: trimmedTitle,
        description: values.description.trim(),
        subjects: values.subjects,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-form-modal-title"
        className="w-full max-w-md bg-white rounded-xl shadow-lg"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2
            id="project-form-modal-title"
            className="text-base font-semibold text-gray-900"
          >
            {heading}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              标题 <span className="text-red-500">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={values.title}
              maxLength={TITLE_MAX}
              onChange={(e) =>
                setValues((v) => ({ ...v, title: e.target.value }))
              }
              placeholder="例如:函数与图像入门"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              required
            />
            <div className="mt-1 text-xs text-gray-400">
              {values.title.length}/{TITLE_MAX}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              描述 <span className="text-gray-400 font-normal">(可选)</span>
            </label>
            <textarea
              value={values.description}
              maxLength={DESC_MAX}
              onChange={(e) =>
                setValues((v) => ({ ...v, description: e.target.value }))
              }
              placeholder="简短描述这个课程的主题或学习目标"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
            />
            <div className="mt-1 text-xs text-gray-400">
              {values.description.length}/{DESC_MAX}
            </div>
          </div>

          {/* fieldset + legend gives screen readers a group name + count;
              aria-pressed on each button announces the toggle state.
              Without the fieldset wrapper, each button is read independently
              and the user loses the "N options, X selected" context. */}
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-1.5">
              教学要求库{' '}
              <span className="text-gray-400 font-normal">
                (可选 · 可多选)
              </span>
            </legend>
            {availableSubjects === null ? (
              <div className="text-xs text-gray-400 py-2">加载中…</div>
            ) : availableSubjects.length === 0 ? (
              <div className="text-xs text-gray-400 py-2">
                后端尚未配置任何教学要求库。
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableSubjects.map((subject) => {
                  const selected = values.subjects.includes(subject)
                  return (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => toggleSubject(subject)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        selected
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                      }`}
                      aria-pressed={selected}
                    >
                      {subject}
                    </button>
                  )
                })}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-400">
              选中的学科会被物化到 agent 的{' '}
              <code className="text-gray-500">_lib/</code> 工作区。
            </p>
          </fieldset>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '处理中…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
