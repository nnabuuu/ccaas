import { useEffect, useMemo, useState } from 'react'
import { TaskDemoSessionProvider } from './TaskDemoSessionProvider'
import { getExerciseType } from '../../components/student/exercise/plugins/registry'
import '../../components/student/exercise/plugins/built-in' // side-effect: registers all 11 plugins
import type { ExerciseUIPlugin } from '../../components/student/exercise/plugins/types'
import { type TextOverlay } from '../../components/student/TextPanel'
import { RightPanel, hasRightPanelContent } from './RightPanel'
import { taskDemoApi, type ExerciseSpec, type SubmitResult } from './useTaskDemoApi'

/**
 * AnswerMode — interactive answer view for /task-demo/:code?user=X.
 *
 * Layout: 2-column [exercise | article TextPanel].
 *   - article comes back on the /exercise response (server bundles it from
 *     manifest.article). select-evidence needs it (student picks tokens in
 *     the paragraphs); other types use it as reading context.
 *   - SelectEvidenceExercise emits an `overlay` via onOverlayChange that
 *     drives the in-text token highlighting in TextPanel.
 *   - select-evidence submits via SessionCtx.submit (selfManagedSubmit), so
 *     we wrap in TaskDemoSessionProvider which wires that to the real
 *     /api/task-demo/:code/submit endpoint.
 */
export function AnswerMode({
  code,
  studentId,
  userName,
}: {
  code: string
  studentId: string
  userName: string
}) {
  const [spec, setSpec] = useState<ExerciseSpec | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ attempt: number; allCorrect: boolean; total: number | null } | null>(null)
  // overlay is the live state SelectEvidenceExercise emits to drive token
  // highlighting in TextPanel. Lifted to this level so both children share it.
  const [overlay, setOverlay] = useState<TextOverlay | null>(null)

  useEffect(() => {
    let cancelled = false
    setSpec(null)
    setError(null)
    taskDemoApi
      .exercise(code)
      .then((s) => { if (!cancelled) setSpec(s) })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)) })
    return () => { cancelled = true }
  }, [code])

  if (error) {
    return <Frame title="加载失败"><ErrorBlock message={error} hint="检查 backend 是否在 :3007 运行。" /></Frame>
  }
  if (!spec) {
    return <Frame title="加载中…"><Loading /></Frame>
  }

  const plugin = getExerciseType(spec.type)
  if (!plugin) {
    return <Frame title="不支持的题型"><ErrorBlock message={`No frontend plugin registered for type "${spec.type}".`} /></Frame>
  }

  const stepDef = (spec.manifest?.readingSteps as Array<{ idx: number; label?: string }> | undefined)?.find((s) => s.idx === spec.step)
  const headerTitle = stepDef?.label ?? spec.type
  const hasRightPanel = hasRightPanelContent(spec)
  const rightPanel = hasRightPanel ? <RightPanel spec={spec} overlay={overlay} /> : null

  return (
    <Frame title={`${userName} · ${headerTitle}`}>
      <TaskDemoSessionProvider
        code={code}
        studentId={studentId}
        onSubmitResult={(r) => {
          const total = typeof r.score?.total === 'number' ? r.score!.total : null
          // selfManagedSubmit plugins (select-evidence) flow through here.
          setLastResult((prev) => ({
            attempt: (prev?.attempt ?? 0) + 1,
            allCorrect: r.allCorrect,
            total,
          }))
        }}
      >
        <TwoColumn
          left={
            <ExerciseSurface
              code={code}
              studentId={studentId}
              plugin={plugin}
              spec={spec}
              setOverlay={setOverlay}
              onSubmitResult={(r) => setLastResult({
                attempt: r.attempt,
                allCorrect: r.allCorrect,
                total: typeof r.score?.total === 'number' ? r.score!.total : null,
              })}
            />
          }
          right={rightPanel}
        />
        {lastResult && <ResultBanner result={lastResult} />}
      </TaskDemoSessionProvider>
    </Frame>
  )
}

function ExerciseSurface({
  code,
  studentId,
  plugin,
  spec,
  setOverlay,
  onSubmitResult,
}: {
  code: string
  studentId: string
  plugin: ExerciseUIPlugin
  spec: ExerciseSpec
  setOverlay: (o: TextOverlay | null) => void
  onSubmitResult: (r: SubmitResult) => void
}) {
  const exercise = useMemo<Record<string, any>>(() => {
    const ex: Record<string, any> = { type: plugin.type }
    plugin.enrichFromApi?.(ex, spec as Record<string, any>)
    return ex
  }, [plugin, spec])

  const [ans, setAns] = useState<Record<string, any>>({})
  const [checkResultState, setCheckResultState] = useState<Record<string, any>>({})
  const [attempts, setAttempts] = useState<Record<number, any[]>>({})
  const [correctQs, setCorrectQs] = useState<Set<number>>(new Set())
  const [allDone, setAllDone] = useState(false)
  const [softDone, setSoftDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const canSubmit = plugin.canSubmit(exercise, ans, checkResultState) && !submitting

  const doSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const data = plugin.formatSubmitData(ans, checkResultState)
      const result = await taskDemoApi.submit(code, studentId, data)
      onSubmitResult(result)
      const out = plugin.handleCheckResult(
        { type: spec.type, allCorrect: result.allCorrect, items: result.items as any },
        exercise,
        { ans, attempts, correctQs, serverHints: {}, pluginState: checkResultState },
      )
      setCheckResultState(out.checkResultState)
      setAllDone(out.allDone)
      setSoftDone(out.softDone)
      if (out.attempts) setAttempts(out.attempts)
      if (out.correctQs) setCorrectQs(out.correctQs)
    } catch (e: any) {
      setSubmitError(String(e?.message ?? e))
    } finally {
      setSubmitting(false)
    }
  }

  const Component = plugin.Component

  // selfManagedSubmit plugins (select-evidence / rich-content-quiz /
  // guided-discovery) call props.submit(stepIdx, data) directly instead
  // of going through the SubmitBar. Wire that to the real backend so the
  // selfManagedSubmit branch actually persists.
  const pluginSubmit = async (_step: number, data: Record<string, any>) => {
    try {
      const result = await taskDemoApi.submit(code, studentId, data)
      onSubmitResult(result)
    } catch (e: any) {
      setSubmitError(String(e?.message ?? e))
    }
  }

  return (
    <div>
      <Component
        exercise={exercise}
        ans={ans}
        setAns={setAns}
        allDone={allDone}
        softDone={softDone}
        checkResultState={checkResultState}
        setCheckResultState={setCheckResultState}
        onDone={() => { setAllDone(true); setSoftDone(true) }}
        stepIdx={0}
        taskId={1}
        locale="zh"
        onOverlayChange={setOverlay}
        submit={pluginSubmit}
      />

      {!plugin.selfManagedSubmit && (
        <SubmitBar canSubmit={canSubmit} onSubmit={doSubmit} submitting={submitting} />
      )}

      {submitError && <ErrorBlock message={submitError} hint="提交失败 — 答案未持久化。" />}
    </div>
  )
}


function TwoColumn({ left, right }: { left: React.ReactNode; right: React.ReactNode | null }) {
  if (!right) return <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>{left}</div>
  return (
    <div className="stu-shell" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 520px) minmax(0, 1fr)', gap: 0, height: 'calc(100vh - 48px)' }}>
      <div className="stu-task-area" style={{ overflow: 'auto', padding: '20px 24px', background: 'var(--surface)' }}>
        {left}
      </div>
      <div className="stu-text-area">
        {right}
      </div>
    </div>
  )
}

function SubmitBar({ canSubmit, submitting, onSubmit }: { canSubmit: boolean; submitting: boolean; onSubmit: () => void }) {
  return (
    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
      <button
        disabled={!canSubmit}
        onClick={onSubmit}
        style={{
          padding: '10px 20px',
          background: canSubmit ? '#1c1c1a' : '#9c9a92',
          color: '#f0efe8',
          border: 'none',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit',
        }}
      >
        {submitting ? '提交中…' : '提交答案'}
      </button>
    </div>
  )
}

function ResultBanner({ result }: { result: { attempt: number; allCorrect: boolean; total: number | null } }) {
  const color = result.allCorrect ? '#2d6612' : result.total === 0 ? '#942929' : '#7a4d0e'
  const bg = result.allCorrect ? '#e6f2dc' : result.total === 0 ? '#f5dada' : '#f6edda'
  const label = result.allCorrect ? '全对 🎉' : result.total === 0 ? '再试一次' : '部分正确'
  return (
    <div style={{
      position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      padding: '10px 20px', background: bg, color, borderRadius: 999,
      fontSize: 13, fontWeight: 600, boxShadow: '0 6px 20px rgba(0,0,0,.12)',
      zIndex: 20,
    }}>
      第 {result.attempt} 次提交 · {label}
    </div>
  )
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f4f3ef)', fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif' }}>
      <header style={{
        padding: '10px 20px',
        background: 'var(--surface, #fbfaf7)',
        borderBottom: '1px solid var(--border, rgba(28,28,26,.07))',
        fontSize: 13,
        color: 'var(--t2, #5c5b56)',
      }}>
        <strong style={{ color: 'var(--t1, #1c1c1a)' }}>Task Demo</strong> · {title}
      </header>
      {children}
    </div>
  )
}

function Loading() {
  return <div style={{ padding: 40, color: 'var(--t3, #9c9a92)' }}>Loading…</div>
}

function ErrorBlock({ message, hint }: { message: string; hint?: string }) {
  return (
    <div style={{ padding: 18, background: 'var(--red-bg, #f5dada)', borderRadius: 6, margin: 20 }}>
      <strong style={{ color: 'var(--red, #942929)', display: 'block' }}>{message}</strong>
      {hint && <span style={{ color: 'var(--t2, #5c5b56)', fontSize: 12, display: 'block', marginTop: 6 }}>{hint}</span>}
    </div>
  )
}
