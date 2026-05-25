import { useEffect, useMemo, useState } from 'react'
import { MockSessionProvider } from '../preview/MockSessionProvider'
import { getExerciseType } from '../../components/student/exercise/plugins/registry'
import '../../components/student/exercise/plugins/built-in' // side-effect: registers all 11 plugins
import type { ExerciseUIPlugin } from '../../components/student/exercise/plugins/types'
import { taskDemoApi, type ExerciseSpec, type SubmitResult } from './useTaskDemoApi'

/**
 * AnswerMode — interactive answer view for /task-demo/:code?user=X.
 * Fetches the sanitized exercise spec from the backend, renders the real
 * production component via the plugin registry, and on submit POSTs to
 * /api/task-demo/:code/submit so every attempt persists.
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
    return (
      <Frame title="加载失败">
        <ErrorBlock message={error} hint="检查 backend 是否在 :3007 运行。" />
      </Frame>
    )
  }
  if (!spec) {
    return <Frame title="加载中…"><div style={{ padding: 40, color: '#9c9a92' }}>Loading…</div></Frame>
  }

  const plugin = getExerciseType(spec.type)
  if (!plugin) {
    return (
      <Frame title="不支持的题型">
        <ErrorBlock message={`No frontend plugin registered for type "${spec.type}".`} />
      </Frame>
    )
  }

  return (
    <Frame title={`${userName} · ${spec.type}`}>
      <MockSessionProvider>
        <ExerciseSurface
          code={code}
          studentId={studentId}
          plugin={plugin}
          spec={spec}
        />
      </MockSessionProvider>
    </Frame>
  )
}

function ExerciseSurface({
  code,
  studentId,
  plugin,
  spec,
}: {
  code: string
  studentId: string
  plugin: ExerciseUIPlugin
  spec: ExerciseSpec
}) {
  // Build exercise via the plugin's enrichFromApi (the backend already
  // sanitized — this is the API path, not the manifest fallback).
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
  const [lastResult, setLastResult] = useState<SubmitResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const canSubmit = plugin.canSubmit(exercise, ans, checkResultState) && !submitting

  const doSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const data = plugin.formatSubmitData(ans, checkResultState)
      const result = await taskDemoApi.submit(code, studentId, data)
      setLastResult(result)

      // Run handleCheckResult so plugin-specific state (hints, partial
      // correctness, retry hooks) is computed exactly as production would.
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
      />

      {!plugin.selfManagedSubmit && (
        <SubmitBar canSubmit={canSubmit} onSubmit={doSubmit} submitting={submitting} />
      )}

      {lastResult && (
        <ResultBanner result={lastResult} />
      )}
      {submitError && (
        <ErrorBlock message={submitError} hint="提交失败 — 答案未持久化。" />
      )}
    </div>
  )
}

function SubmitBar({
  canSubmit,
  submitting,
  onSubmit,
}: {
  canSubmit: boolean
  submitting: boolean
  onSubmit: () => void
}) {
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

function ResultBanner({ result }: { result: SubmitResult }) {
  const total = typeof result.score?.total === 'number' ? result.score!.total : null
  const color = result.allCorrect ? '#2d6612' : total === 0 ? '#942929' : '#7a4d0e'
  const bg = result.allCorrect ? '#e6f2dc' : total === 0 ? '#f5dada' : '#f6edda'
  return (
    <div
      style={{
        marginTop: 14,
        padding: '10px 14px',
        background: bg,
        color,
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      第 {result.attempt} 次提交 · {result.allCorrect ? '全对 🎉' : total === 0 ? '再试一次' : '部分正确'}
    </div>
  )
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

function ErrorBlock({ message, hint }: { message: string; hint?: string }) {
  return (
    <div style={{ padding: 18, background: '#f5dada', borderRadius: 6 }}>
      <strong style={{ color: '#942929', display: 'block' }}>{message}</strong>
      {hint && <span style={{ color: '#5c5b56', fontSize: 12, display: 'block', marginTop: 6 }}>{hint}</span>}
    </div>
  )
}
