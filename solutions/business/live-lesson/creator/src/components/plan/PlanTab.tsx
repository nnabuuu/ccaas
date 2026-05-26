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
import { AlertCircle, FileText, RefreshCw } from 'lucide-react'

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
import PlanRenderer, { type ChipResolver } from './PlanRenderer'

const LESSON_PLAN_PATH = 'plan/lesson-plan.md'

type State =
  | { phase: 'loading' }
  | { phase: 'empty' }
  | { phase: 'error'; message: string }
  | {
      phase: 'ready'
      doc: PlanDocument
      resolver: ChipResolver
    }

interface Props {
  projectId: string
  /** Optional subject hint used to narrow the L1 fetch. */
  subject?: string
}

export default function PlanTab({ projectId, subject }: Props) {
  const [state, setState] = useState<State>({ phase: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

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
          setState({ phase: 'ready', doc: canonicalized, resolver })
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
    <div className="px-6 py-6 max-w-3xl mx-auto w-full">
      {state.phase === 'loading' && (
        <div className="text-center text-gray-500 py-12">
          <RefreshCw size={24} className="mx-auto animate-spin mb-3" />
          <p className="text-sm">加载教案中…</p>
        </div>
      )}

      {state.phase === 'empty' && (
        <div className="text-center text-gray-500 py-16 border border-dashed border-gray-300 rounded-lg">
          <FileText size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm">这个项目还没有教案</p>
          <p className="text-xs text-gray-400 mt-1">
            文件 <code>plan/lesson-plan.md</code> 不存在
          </p>
        </div>
      )}

      {state.phase === 'error' && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={14} />
            <span className="font-medium">加载失败</span>
          </div>
          <p className="font-mono text-xs">{state.message}</p>
          <button
            onClick={reload}
            className="mt-2 text-xs underline hover:text-red-900"
          >
            重试
          </button>
        </div>
      )}

      {state.phase === 'ready' && (
        <PlanRenderer doc={state.doc} resolveChip={state.resolver} />
      )}
    </div>
  )
}

function normalizeInterpretation(
  i: { notes: string; updatedAt: string } | null | undefined,
): { notes: string; updatedAt: string } | null {
  if (!i) return null
  return { notes: i.notes, updatedAt: i.updatedAt }
}
