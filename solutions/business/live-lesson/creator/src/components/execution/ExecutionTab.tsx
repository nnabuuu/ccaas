import { useCallback, useEffect, useRef, useState } from 'react'
import { Layout, Save, CheckCircle, Loader2 } from 'lucide-react'
import { readFile, writeFile } from '../../api/projects'
import type { Manifest, ReadingStep } from '../../types'
import { getStepColor } from '../../types'
import StepList from './StepList'
import BlockEditorDrawer from './BlockEditorDrawer'
import { parseStepAnchor } from '../../lib/scroll-anchor'
import { flashScrollTarget } from '../../lib/flash-scroll-target'

interface ExecutionTabProps {
  projectId: string
  /**
   * Bump this counter to force a reload of the manifest from disk —
   * used by `ProjectEditorPage` when the operator clicks "Reload"
   * on an agent-edit notice. The useEffect depends on it so any
   * change re-runs the fetch.
   */
  reloadKey?: number
  /**
   * Scroll-to-anchor signal. When the user clicks a `nav://execution/step-N`
   * link inside an audit report, the parent ChatBridge sets
   * `scrollAnchor` to "step-N" and bumps `scrollNonce`. We watch both
   * (anchor + nonce as deps) so re-clicking the same link still re-fires
   * the scroll. Null anchor means no scroll pending.
   */
  scrollAnchor?: string | null
  scrollNonce?: number
}

type SaveStatus = 'saved' | 'saving' | 'unsaved'

const TIMELINE_BG: Record<string, string> = {
  teal: 'bg-teal-400',
  blue: 'bg-blue-400',
  purple: 'bg-purple-400',
  amber: 'bg-amber-400',
  green: 'bg-green-400',
}

let stepIdCounter = 0
function nextStepId(): string {
  return `s-${Date.now()}-${++stepIdCounter}`
}

export default function ExecutionTab({
  projectId,
  reloadKey = 0,
  scrollAnchor,
  scrollNonce,
}: ExecutionTabProps) {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [selectedBlock, setSelectedBlock] = useState<{ stepIdx: number } | null>(null)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manifestRef = useRef<Manifest | null>(null)
  manifestRef.current = manifest
  /**
   * Generation counter incremented on every reload (reloadKey bump) and
   * on unmount. Inside save(), we snapshot the current gen at start and
   * compare on resolve — if it changed, an external reload happened
   * mid-flight and we discard our stale write (no setSaveStatus, no
   * fallback ui change) to prevent overwriting freshly-loaded content
   * with the operator's pre-reload edits.
   */
  const saveGenRef = useRef(0)

  // Load manifest
  useEffect(() => {
    let cancelled = false
    // Clear timer + bump generation so any in-flight save() resolves
    // into the "stale, discard" branch instead of overwriting the
    // freshly-loaded manifest with the operator's pre-reload edits.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveGenRef.current++
    async function load() {
      try {
        setLoading(true)
        setError(null)
        setSelectedBlock(null)
        const { content } = await readFile(projectId, 'execution/manifest.json')
        if (!cancelled) {
          const parsed = JSON.parse(content) as Manifest
          if (!Array.isArray(parsed.readingSteps)) {
            throw new Error('Invalid manifest: missing readingSteps array')
          }
          setManifest(parsed)
          setSaveStatus('saved')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load manifest')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [projectId, reloadKey])

  // Scroll-to-step on nav:// anchor. Deps include `scrollNonce` so a
  // re-click with the same anchor still re-fires (otherwise React
  // skips the effect when only the parent's nonce bumped). Also
  // depends on `manifest` so when the bridge fires DURING a cold
  // load (manifest still null on first mount), the effect re-runs
  // once steps render — a 200ms timer alone misses cold loads
  // >200ms. Untrusted-input safe: parseStepAnchor returns null for
  // any unrecognized shape, so the effect silently no-ops on garbage
  // LLM anchors.
  //
  // Dual-anchor selection (DEF-01 follow-up): the parsed anchor may
  // carry both `id` (stable step.id) and `idx` (1-based position).
  // Prefer id — it survives the user reordering steps after the
  // audit was produced. Fall back to idx for the legacy single-form
  // anchor or when the LLM omitted the id. This is the only place
  // that decides priority; everything else just consumes whichever
  // element comes back.
  //
  // Deleted-step trade-off: if id is present but no matching DOM
  // element exists (the step was deleted after audit ran), idx
  // fallback may land on whatever step now occupies that position —
  // potentially the wrong content. Accepted as silent-degrade since
  // (a) the audit context provides enough surrounding info that a
  // mismatch is recoverable, and (b) "some scroll" is usually less
  // confusing than "click did nothing".
  // Use a boolean "data ready" gate rather than `manifest` itself in
  // the deps below — otherwise every keystroke in the block editor
  // (which mutates manifest) re-runs this effect and re-flashes the
  // step row mid-edit. We only need to re-fire when manifest
  // transitions null → non-null.
  const manifestReady = manifest != null
  useEffect(() => {
    if (!scrollAnchor) return
    const parsed = parseStepAnchor(scrollAnchor)
    if (!parsed) return
    // Wait for manifest to mount — without steps in the DOM neither
    // selector can resolve. Cheap early-return; the effect re-fires
    // when `manifestReady` flips true.
    if (!manifestReady) return

    let rafId = 0
    let retryId: ReturnType<typeof setTimeout> | null = null

    const tryScroll = () => {
      // id is doc-author / runtime-generated (`s-${Date.now()}-N`);
      // CSS.escape defends the selector against pathological chars.
      // idx is `\d+` straight from the regex — safe to interpolate.
      const byId =
        parsed.id != null
          ? document.querySelector(
              `[data-step-id="${CSS.escape(parsed.id)}"]`,
            )
          : null
      const byIdx =
        byId == null && parsed.idx != null
          ? document.querySelector(`[data-step-idx="${parsed.idx}"]`)
          : null
      const el = byId ?? byIdx
      if (el) {
        flashScrollTarget(el)
        return true
      }
      return false
    }

    rafId = requestAnimationFrame(() => {
      // Defensive retry for the late-paint case (steps mount but
      // child blocks still measuring). At this point manifest is
      // non-null so steps WILL render; a single retry covers
      // React's commit-then-paint gap without growing into
      // exponential backoff territory.
      if (!tryScroll()) {
        retryId = setTimeout(tryScroll, 200)
      }
    })

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (retryId) clearTimeout(retryId)
    }
  }, [scrollAnchor, scrollNonce, manifestReady])

  // Save function — generation-guarded against reload races.
  const save = useCallback(async () => {
    const m = manifestRef.current
    if (!m) return
    const gen = saveGenRef.current
    setSaveStatus('saving')
    try {
      await writeFile(projectId, 'execution/manifest.json', JSON.stringify(m, null, 2))
      // If a reload bumped the generation while we were in-flight, the
      // operator's pre-reload edits would clobber the new content. Drop
      // this write's status update — the load() in the new effect run
      // already set 'saved'.
      if (gen !== saveGenRef.current) return
      setSaveStatus('saved')
    } catch {
      if (gen !== saveGenRef.current) return
      setSaveStatus('unsaved')
    }
  }, [projectId])

  // Schedule auto-save with 2s debounce
  const scheduleSave = useCallback(() => {
    setSaveStatus('unsaved')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => { save() }, 2000)
  }, [save])

  const handleStepsChange = useCallback((steps: ReadingStep[]) => {
    setManifest((prev) => {
      if (!prev) return prev
      return { ...prev, readingSteps: steps }
    })
    scheduleSave()
  }, [scheduleSave])

  // Use functional updater to avoid stale closure over steps
  const handleStepChange = useCallback((updatedStep: ReadingStep) => {
    if (!selectedBlock) return
    const idx = selectedBlock.stepIdx
    setManifest((prev) => {
      if (!prev) return prev
      const next = [...prev.readingSteps]
      next[idx] = updatedStep
      return { ...prev, readingSteps: next }
    })
    scheduleSave()
  }, [selectedBlock, scheduleSave])

  const handleSelectBlock = useCallback((stepIdx: number, _blockType: string) => {
    setSelectedBlock({ stepIdx })
  }, [])

  const handleAddStep = useCallback(() => {
    setManifest((prev) => {
      if (!prev) return prev
      const steps = prev.readingSteps
      const newStep: ReadingStep = {
        id: nextStepId(),
        idx: steps.length,
        type: 'task',
        duration: 5,
        label: `Step ${steps.length + 1}`,
      }
      return { ...prev, readingSteps: [...steps, newStep] }
    })
    scheduleSave()
  }, [scheduleSave])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading manifest...
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-500 text-sm">
        {error}
      </div>
    )
  }

  if (!manifest) return null

  const steps = manifest.readingSteps
  const selectedStep = selectedBlock ? steps[selectedBlock.stepIdx] : null

  return (
    <div className="h-full flex">
      {/* Left: step list */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Layout size={16} className="text-blue-500" />
              执行设计
            </h2>
            <div className="flex items-center gap-1.5 text-xs">
              {saveStatus === 'saved' && (
                <>
                  <CheckCircle size={12} className="text-green-500" />
                  <span className="text-gray-400">Saved</span>
                </>
              )}
              {saveStatus === 'saving' && (
                <>
                  <Loader2 size={12} className="animate-spin text-blue-500" />
                  <span className="text-gray-400">Saving...</span>
                </>
              )}
              {saveStatus === 'unsaved' && (
                <>
                  <Save size={12} className="text-amber-500" />
                  <span className="text-amber-600">Unsaved</span>
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Design the step-by-step execution flow for your lesson
          </p>

          {/* Timeline bar */}
          {steps.length > 0 && (
            <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 mt-3">
              {steps.map((step, i) => (
                <div
                  key={step.id}
                  className={TIMELINE_BG[getStepColor(i)]}
                  style={{ flex: step.duration || 1 }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Step list */}
        <div className="flex-1 overflow-y-auto p-6">
          <StepList
            steps={steps}
            onStepsChange={handleStepsChange}
            onSelectBlock={handleSelectBlock}
            selectedBlock={selectedBlock}
          />

          {/* Add step button */}
          <button
            onClick={handleAddStep}
            className="w-full flex items-center justify-center gap-2 py-3 mt-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors"
          >
            + Add step
          </button>
        </div>
      </div>

      {/* Right: block editor drawer */}
      {selectedStep && (
        <BlockEditorDrawer
          step={selectedStep}
          onStepChange={handleStepChange}
          onClose={() => setSelectedBlock(null)}
        />
      )}
    </div>
  )
}
