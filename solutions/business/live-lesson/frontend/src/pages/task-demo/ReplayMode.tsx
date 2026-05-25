import { useEffect, useMemo, useState } from 'react'
import { MockSessionProvider } from '../preview/MockSessionProvider'
import { getExerciseType } from '../../components/student/exercise/plugins/registry'
import '../../components/student/exercise/plugins/built-in' // side-effect: registers all 11 plugins
import { RightPanel, hasRightPanelContent } from './RightPanel'
import { taskDemoApi, type ExerciseSpec, type ReplayEntry, type Respondent } from './useTaskDemoApi'

/**
 * ReplayMode — read-only scrub through one respondent's submit history.
 *
 * Wiring:
 *   1. /respondents → resolve `?user=` (display name) to studentId
 *   2. /exercise    → sanitized spec (shape per plugin.enrichFromApi)
 *   3. /replay/:id  → array of attempts {data, score, checkItems, submittedAt}
 *
 * Per attempt the exercise component is remounted with reviewData so each
 * plugin's parseXxxReview function rebuilds the prior visual state (selected
 * options, ✓/✗ marks, hints, etc.).
 */
export function ReplayMode({ code, userParam }: { code: string; userParam: string }) {
  const [spec, setSpec] = useState<ExerciseSpec | null>(null)
  const [attempts, setAttempts] = useState<ReplayEntry[] | null>(null)
  const [respondent, setRespondent] = useState<Respondent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(null)
    setSpec(null)
    setAttempts(null)
    setRespondent(null)
    setIdx(0)

    if (!userParam.trim()) {
      setError('缺少 ?user= 参数 — 无法判断要回放哪位答题人')
      return
    }

    ;(async () => {
      try {
        const [allRespondents, fetchedSpec] = await Promise.all([
          taskDemoApi.respondents(code),
          taskDemoApi.exercise(code),
        ])
        if (cancelled) return

        const wanted = userParam.trim().toLowerCase()
        const match = allRespondents.find((r) => r.name.toLowerCase() === wanted)
        if (!match) {
          setError(`找不到答题人 "${userParam}"。可用的：${allRespondents.map(r => r.name).join(', ') || '(尚无)'}`)
          return
        }
        const replayData = await taskDemoApi.replay(code, match.studentId)
        if (cancelled) return

        setRespondent(match)
        setSpec(fetchedSpec)
        setAttempts(replayData)
        // Default cursor: the last attempt (most recent state).
        setIdx(Math.max(0, replayData.length - 1))
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? e))
      }
    })()

    return () => { cancelled = true }
  }, [code, userParam])

  if (error) {
    return (
      <Frame title="Replay">
        <ErrorBlock message={error} />
      </Frame>
    )
  }
  if (!spec || !attempts || !respondent) {
    return <Frame title="Replay"><Loading /></Frame>
  }
  if (attempts.length === 0) {
    return (
      <Frame title={`Replay · ${respondent.name}`}>
        <ErrorBlock message="该答题人尚未提交过任何答案。" hint="等他/她提交后再回来回放。" />
      </Frame>
    )
  }

  const current = attempts[idx]
  const plugin = getExerciseType(spec.type)

  const hasRightPanel = hasRightPanelContent(spec)

  return (
    <Frame title={`Replay · ${respondent.name}`}>
      <div style={{ padding: '14px 24px 0' }}>
        <ScrubBar attempts={attempts} idx={idx} onChange={setIdx} />
      </div>
      {plugin ? (
        <MockSessionProvider>
          <div style={{
            display: hasRightPanel ? 'grid' : 'block',
            gridTemplateColumns: hasRightPanel ? 'minmax(0, 520px) minmax(0, 1fr)' : undefined,
            gap: 0,
            height: hasRightPanel ? 'calc(100vh - 48px - 72px)' : undefined,
          }}>
            <div className="stu-task-area" style={{ overflow: 'auto', padding: '20px 24px', background: 'var(--surface)' }}>
              {/* key={idx} forces a fresh mount per scrub so useReviewRestore re-parses */}
              <ReplayStage
                key={`${respondent.studentId}-${current.attempt}`}
                plugin={plugin}
                spec={spec}
                entry={current}
              />
            </div>
            {hasRightPanel && (
              <div className="stu-text-area">
                <RightPanel spec={spec} overlay={null} />
              </div>
            )}
          </div>
        </MockSessionProvider>
      ) : (
        <ErrorBlock message={`No frontend plugin registered for type "${spec.type}".`} />
      )}
    </Frame>
  )
}

function ReplayStage({
  plugin,
  spec,
  entry,
}: {
  plugin: ReturnType<typeof getExerciseType>
  spec: ExerciseSpec
  entry: ReplayEntry
}) {
  if (!plugin) return null

  const exercise = useMemo<Record<string, any>>(() => {
    const ex: Record<string, any> = { type: plugin.type }
    plugin.enrichFromApi?.(ex, spec as Record<string, any>)
    return ex
  }, [plugin, spec])

  const reviewData = useMemo(() => ({
    data: entry.data,
    checkItems: entry.checkItems as any,
  }), [entry])

  const Component = plugin.Component

  // In replay mode we render the component frozen — setAns is a no-op so the
  // viewer can't mutate someone else's history.
  return (
    <div style={{ pointerEvents: 'none', opacity: 0.96 }}>
      <Component
        exercise={exercise}
        ans={entry.data}
        setAns={NOOP_SET}
        allDone
        softDone
        reviewData={reviewData}
        checkResultState={{
          allDone: true,
          softDone: true,
        }}
        setCheckResultState={NOOP_SET}
        onDone={NOOP}
        stepIdx={0}
        taskId={1}
        locale="zh"
      />
    </div>
  )
}

const NOOP = () => {}
// Setter that swallows all updates — the exercise component is rendered
// read-only in replay so any setAns / setCheckResultState the plugin would
// emit gets dropped.
const NOOP_SET: React.Dispatch<React.SetStateAction<Record<string, any>>> = () => {}

function ScrubBar({
  attempts,
  idx,
  onChange,
}: {
  attempts: ReplayEntry[]
  idx: number
  onChange: (next: number) => void
}) {
  const current = attempts[idx]
  const ts = new Date(current.submittedAt)
  const total = typeof current.score?.total === 'number' ? current.score!.total : null
  const scoreLabel = total === null ? '—' : `${total}%`
  const scoreColor = total === 100 ? '#2d6612' : total === 0 ? '#942929' : '#7a4d0e'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        background: '#fbfaf7',
        border: '1px solid rgba(28,28,26,.07)',
        borderRadius: 8,
        marginBottom: 16,
        fontSize: 13,
        color: '#5c5b56',
      }}
    >
      <button
        onClick={() => onChange(Math.max(0, idx - 1))}
        disabled={idx === 0}
        style={navBtn(idx === 0)}
        aria-label="上一次提交"
      >
        ◀
      </button>
      <div style={{ minWidth: 100, textAlign: 'center', fontWeight: 600, color: '#1c1c1a' }}>
        第 {current.attempt} 次 / 共 {attempts.length}
      </div>
      <button
        onClick={() => onChange(Math.min(attempts.length - 1, idx + 1))}
        disabled={idx === attempts.length - 1}
        style={navBtn(idx === attempts.length - 1)}
        aria-label="下一次提交"
      >
        ▶
      </button>
      <div style={{ flex: 1, height: 4, background: '#edece7', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            width: `${attempts.length > 1 ? (idx / (attempts.length - 1)) * 100 : 100}%`,
            height: '100%',
            background: '#1c1c1a',
            transition: 'width .15s',
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: '#9c9a92' }}>{ts.toLocaleString()}</div>
      <div
        style={{
          padding: '3px 10px',
          borderRadius: 4,
          background: '#edece7',
          color: scoreColor,
          fontWeight: 700,
          fontSize: 12,
        }}
      >
        {scoreLabel}
      </div>
    </div>
  )
}

function navBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 32,
    height: 28,
    background: disabled ? 'transparent' : '#1c1c1a',
    color: disabled ? '#9c9a92' : '#f0efe8',
    border: disabled ? '1px solid rgba(28,28,26,.07)' : 'none',
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 12,
  }
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f4f3ef',
        fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      }}
    >
      <header
        style={{
          padding: '10px 20px',
          background: '#fbfaf7',
          borderBottom: '1px solid rgba(28,28,26,.07)',
          fontSize: 13,
          color: '#5c5b56',
        }}
      >
        <strong style={{ color: '#1c1c1a' }}>Task Demo</strong> · {title}
      </header>
      <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>{children}</div>
    </div>
  )
}

function Loading() {
  return <div style={{ padding: 40, color: '#9c9a92' }}>Loading…</div>
}

function ErrorBlock({ message, hint }: { message: string; hint?: string }) {
  return (
    <div style={{ padding: 18, background: '#f6edda', borderRadius: 6 }}>
      <strong style={{ color: '#7a4d0e', display: 'block' }}>{message}</strong>
      {hint && <span style={{ color: '#5c5b56', fontSize: 12, display: 'block', marginTop: 6 }}>{hint}</span>}
    </div>
  )
}
