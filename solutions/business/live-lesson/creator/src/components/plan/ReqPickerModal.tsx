/**
 * ReqPickerModal — picks one teaching-requirement item from the L1
 * library to insert as a chip.
 *
 * Loads the subject's library once on open, lets the user filter by
 * search box + category, and returns the chosen item via `onPick`.
 *
 * UX choices:
 *  - Single-select (not multi): inserting multiple chips at once
 *    would need newline handling that's complex to predict. Reopen
 *    the picker for the next chip.
 *  - Search input gets auto-focus on open (the most common path).
 *  - Esc + backdrop close (a11y baseline).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import {
  listLibraries,
  type ReqLibrary,
} from '../../api/teaching-requirements'

interface PickedItem {
  id: string
  text: string
  code: string
  categoryLabel: string
  categoryColor: string
}

interface Props {
  open: boolean
  subject?: string
  onClose: () => void
  onPick: (item: PickedItem) => void
}

const ALL = '__all__'

export default function ReqPickerModal({ open, subject, onClose, onPick }: Props) {
  const [libraries, setLibraries] = useState<ReqLibrary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState<string>(ALL)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  // Fetch on open. We re-fetch each open to pick up edits made in
  // a different tab/session — the library is small enough that the
  // cost is trivial compared to staleness risk.
  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null
    setQuery('')
    setActiveCategoryId(ALL)
    setError(null)
    setLoading(true)
    listLibraries({ subject })
      .then((libs) => {
        setLibraries(libs)
        setLoading(false)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      })
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => {
      clearTimeout(t)
      previouslyFocused.current?.focus?.()
    }
  }, [open, subject])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Categories appear in the order their libraries were registered;
  // dedupe by id since a future multi-subject setup may overlap.
  const categories = useMemo(() => {
    const seen = new Set<string>()
    const out: Array<{ id: string; label: string; color: string }> = []
    for (const lib of libraries) {
      for (const cat of lib.categories) {
        if (seen.has(cat.id)) continue
        seen.add(cat.id)
        out.push({ id: cat.id, label: cat.label, color: cat.color })
      }
    }
    return out
  }, [libraries])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out: PickedItem[] = []
    for (const lib of libraries) {
      for (const cat of lib.categories) {
        if (activeCategoryId !== ALL && cat.id !== activeCategoryId) continue
        for (const item of cat.items) {
          if (
            q &&
            !(
              item.text.toLowerCase().includes(q) ||
              item.code.toLowerCase().includes(q) ||
              item.id.toLowerCase().includes(q)
            )
          )
            continue
          out.push({
            id: item.id,
            text: item.text,
            code: item.code,
            categoryLabel: cat.label,
            categoryColor: cat.color,
          })
        }
      }
    }
    return out
  }, [libraries, query, activeCategoryId])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-24"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="req-picker-title"
        className="w-full max-w-xl bg-white rounded-xl shadow-lg flex flex-col max-h-[70vh]"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 id="req-picker-title" className="text-base font-semibold text-gray-900">
            选择教学要求
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 space-y-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="按文字 / 编码 / id 搜索"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveCategoryId(ALL)}
                className={`text-xs px-2.5 py-1 rounded-full border ${
                  activeCategoryId === ALL
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                全部
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategoryId(c.id)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    activeCategoryId === c.id
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2">
          {loading && (
            <div className="text-center text-sm text-gray-500 py-8">加载中…</div>
          )}
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm my-3">
              {error}
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="text-center text-sm text-gray-500 py-8">
              没有匹配的教学要求
            </div>
          )}
          {!loading && !error && filtered.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {filtered.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(item)
                      onClose()
                    }}
                    className="w-full text-left py-2 px-2 hover:bg-gray-50 rounded transition-colors"
                  >
                    <div className="text-sm text-gray-900">{item.text}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {item.code} · {item.categoryLabel}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
