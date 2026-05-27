/**
 * PlanTab — top-level wrapper for the lesson plan view.
 *
 * Responsibilities:
 *  1. Fetch `plan/lesson-plan.md` from the project files API.
 *  2. Parse it into the typed AST.
 *  3. Fetch L1 library entries for every `req://` id in the doc and
 *     canonicalize the AST (refresh chip text/title from L1).
 *  4. Fetch the current user's L2 interpretations for those same ids
 *     so chips can show "my notes" in their popovers.
 *  5. Render via PlanRenderer.
 *
 * This is the read-only path (track 4 of the implementation roadmap).
 * Track 5 will swap PlanRenderer for an editable TipTap-based
 * editor; everything else here stays as-is.
 *
 * State machine:
 *  - 'loading'  — initial fetch in flight
 *  - 'empty'    — file doesn't exist yet (404); shows a "scaffold a
 *                 plan" hint instead of rendering nothing
 *  - 'error'    — any other failure; shows the error message + retry
 *  - 'ready'    — doc parsed + canonicalized + L2 lookup built
 */

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, FileText, RefreshCw, Eye, Edit } from 'lucide-react'

import { readFile, HttpError } from '../../api/projects'
import {
  getRequirement,
  searchRequirements,
  type ReqItem,
} from '../../api/teaching-requirements'
import {
  canonicalizeLessonPlan,
  collectReqIds,
  makeLookup,
  parseLessonPlan,
  type PlanDocument,
} from '../../lib/lesson-plan-md'
import PlanEditor from './PlanEditor'
import PlanRenderer, { type ChipResolver } from './PlanRenderer'
import InterpretationEditorModal from './InterpretationEditorModal'
import { flashScrollTarget } from '../../lib/flash-scroll-target'

const LESSON_PLAN_PATH = 'plan/lesson-plan.md'

type State =
  | { phase: 'loading' }
  | { phase: 'empty' }
  | { phase: 'error'; message: string }
  | {
      phase: 'ready'
      doc: PlanDocument
      resolver: ChipResolver
      libraryItems: ReqItem[]
    }

type Mode = 'view' | 'edit'

interface Props {
  projectId: string
  /** Optional subject hint used to narrow the L1 fetch. */
  subject?: string
  /**
   * Scroll-to-anchor signal. Anchor is the bare req id (e.g.
   * "r-1.2.3"); we query `[data-req-id="..."]` on the rendered
   * ReferenceChip. Works in both view + edit modes because the chip's
   * data attr survives the TipTap NodeView wrapping. Nonce bump
   * re-fires the effect for repeat clicks of the same nav link.
   */
  scrollAnchor?: string | null
  scrollNonce?: number
}

export default function PlanTab({
  projectId,
  subject,
  scrollAnchor,
  scrollNonce,
}: Props) {
  const [state, setState] = useState<State>({ phase: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [mode, setMode] = useState<Mode>('view')
  const [interpretationEditId, setInterpretationEditId] = useState<string | null>(null)
  const [editorDirty, setEditorDirty] = useState(false)

  // beforeunload guard: when editor is dirty, the browser asks
  // before leaving. Belt-and-braces with the in-app mode-switch
  // confirm (which catches the more common case).
  useEffect(() => {
    if (!editorDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Modern browsers ignore the message string and show a generic
      // prompt — we set returnValue purely to trigger the dialog.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [editorDirty])

  // Scroll-to-chip on nav:// anchor. Anchor is the bare req id (no
  // `req://` prefix); ReferenceChip already carries `data-req-id` so
  // a simple querySelector lands the right node in both view + edit
  // modes. Also depends on `state.phase` — cold loads can run for
  // seconds (parse + L1 + L2 fetches), and a single 200ms timer
  // misses them. The effect re-runs when phase flips to 'ready', at
  // which point chips are in the DOM.
  useEffect(() => {
    if (!scrollAnchor) return
    if (state.phase !== 'ready') return

    let rafId = 0
    let retryId: ReturnType<typeof setTimeout> | null = null

    const tryScroll = () => {
      // CSS.escape on the anchor: refId is doc-author input, so a
      // pathological "r\"]" would otherwise break the selector. The
      // failure mode is a silent no-op rather than a thrown error
      // because the audit report is untrusted LLM output.
      const el = document.querySelector(
        `[data-req-id="${CSS.escape(scrollAnchor)}"]`,
      )
      if (el) {
        flashScrollTarget(el)
        return true
      }
      return false
    }

    rafId = requestAnimationFrame(() => {
      // PlanRenderer / PlanEditor commit chips in one paint after
      // the ready transition; a single retry covers the
      // commit-vs-paint gap. The phase-deps re-fire is what carries
      // us through long cold loads, not this retry.
      if (!tryScroll()) {
        retryId = setTimeout(tryScroll, 200)
      }
    })

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (retryId) clearTimeout(retryId)
    }
  }, [scrollAnchor, scrollNonce, state.phase])

  const requestModeChange = useCallback(
    (next: Mode) => {
      if (next === mode) return
      if (editorDirty && mode === 'edit') {
        if (!confirm('教案有未保存的修改。切换到预览会丢失这些修改, 继续?')) {
          return
        }
      }
      setMode(next)
      setEditorDirty(false)
    },
    [mode, editorDirty],
  )

  useEffect(() => {
    // Race guard: if projectId/subject change mid-fetch (or React
    // strict mode double-invokes the effect), a stale resolve would
    // setState after a newer one. Track cancellation so only the
    // most recent in-flight call writes state.
    let cancelled = false

    const run = async () => {
      setState({ phase: 'loading' })
      try {
        const fileResult = await readFile(projectId, LESSON_PLAN_PATH).catch(
          (err) => {
            // 404 → empty content path (plan file is optional). Use
            // the typed HttpError, not error message prefix matching.
            if (err instanceof HttpError && err.status === 404) {
              return { content: '', fileType: 'md' }
            }
            throw err
          },
        )
        if (cancelled) return
        const { content } = fileResult

        if (!content.trim()) {
          if (!cancelled) setState({ phase: 'empty' })
          return
        }

        const parsed = parseLessonPlan(content)
        const refIds = collectReqIds(parsed)

        // L1 search (subject-scoped) gives us category colors for
        // canonicalize. Per-id getRequirement also returns L2
        // myInterpretation. We do both in parallel because the
        // critical path is the slower of the two.
        const [allItems, perItem] = await Promise.all([
          subject
            ? searchRequirements({ subject }).catch(() => [] as ReqItem[])
            : Promise.resolve<ReqItem[]>([]),
          Promise.all(refIds.map((id) => getRequirement(id).catch(() => null))),
        ])
        if (cancelled) return

        const lookup = makeLookup(allItems)
        const canonicalized = canonicalizeLessonPlan(parsed, lookup)

        // Build the chip resolver: refId → {category color, interpretation}.
        // Only the refIds actually referenced in the doc need entries;
        // the L1 set is used for canonicalize, not for resolver.
        const interpretationsByRefId = new Map<
          string,
          { categoryColor?: string; interpretation: ReturnType<typeof normalizeInterpretation> }
        >()
        perItem.forEach((item, i) => {
          const id = refIds[i]
          if (!item) {
            interpretationsByRefId.set(id, { interpretation: null })
          } else {
            interpretationsByRefId.set(id, {
              categoryColor: item.categoryColor,
              interpretation: normalizeInterpretation(item.myInterpretation),
            })
          }
        })

        const resolver: ChipResolver = (refId) =>
          interpretationsByRefId.get(refId) ?? { interpretation: null }

        if (!cancelled) {
          setState({
            phase: 'ready',
            doc: canonicalized,
            resolver,
            libraryItems: allItems,
          })
        }
      } catch (err) {
        if (cancelled) return
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    run()
    return () => {
      cancelled = true
    }
    // reloadKey lets the parent / a manual retry button re-run.
  }, [projectId, subject, reloadKey])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {state.phase === 'loading' && (
        <div className="text-center text-gray-500 py-12">
          <RefreshCw size={24} className="mx-auto animate-spin mb-3" />
          <p className="text-sm">加载教案中…</p>
        </div>
      )}

      {state.phase === 'empty' && (
        <div className="px-6 py-12">
          <div className="text-center text-gray-500 py-16 border border-dashed border-gray-300 rounded-lg max-w-xl mx-auto">
            <FileText size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">这个项目还没有教案</p>
            <p className="text-xs text-gray-400 mt-1">
              文件 <code>plan/lesson-plan.md</code> 不存在
            </p>
          </div>
        </div>
      )}

      {state.phase === 'error' && (
        <div className="px-6 py-6">
          <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={14} />
              <span className="font-medium">加载失败</span>
            </div>
            <p className="font-mono text-xs">{state.message}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-2 text-xs underline hover:text-red-900"
            >
              重试
            </button>
          </div>
        </div>
      )}

      {state.phase === 'ready' && (
        <>
          <div className="flex items-center justify-end gap-1 px-4 py-2 border-b border-gray-200 bg-white">
            <ModeToggle mode={mode} setMode={requestModeChange} dirty={editorDirty} />
          </div>
          {mode === 'view' ? (
            <div className="flex-1 overflow-y-auto px-6 py-6 max-w-3xl mx-auto w-full">
              <PlanRenderer
                doc={state.doc}
                resolveChip={state.resolver}
                onEditInterpretation={(id) => setInterpretationEditId(id)}
              />
            </div>
          ) : (
            <PlanEditor
              projectId={projectId}
              initialDoc={state.doc}
              libraryItems={state.libraryItems}
              resolveChip={state.resolver}
              subject={subject}
              onSaved={reload}
              onInterpretationChanged={reload}
              onDirtyChange={setEditorDirty}
            />
          )}

          <InterpretationEditorModal
            open={!!interpretationEditId}
            reqId={interpretationEditId}
            onClose={() => setInterpretationEditId(null)}
            onChanged={reload}
          />
        </>
      )}
    </div>
  )
}

function ModeToggle({
  mode,
  setMode,
  dirty,
}: {
  mode: Mode
  setMode: (m: Mode) => void
  dirty: boolean
}) {
  return (
    <div className="inline-flex items-center gap-2">
      {dirty && (
        <span className="text-xs text-amber-700">未保存的修改</span>
      )}
      <div className="inline-flex bg-gray-100 border border-gray-200 rounded-lg p-0.5">
        <button
          type="button"
          onClick={() => setMode('view')}
          className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded ${
            mode === 'view'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Eye size={12} />
          预览
        </button>
        <button
          type="button"
          onClick={() => setMode('edit')}
          className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded ${
            mode === 'edit'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Edit size={12} />
          编辑
        </button>
      </div>
    </div>
  )
}

function normalizeInterpretation(
  i: { notes: string; updatedAt: string } | null | undefined,
): { notes: string; updatedAt: string } | null {
  if (!i) return null
  return { notes: i.notes, updatedAt: i.updatedAt }
}
