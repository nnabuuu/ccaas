/**
 * /exercise-demo — single-exercise preview page.
 *
 * URL params:
 *   ?bundle=<bundleId>      bundle directory name (e.g. 'quiz-demo')
 *   &story=<storyName>      named export from the *.stories.mjs (default: 'Default')
 *   &role=student|teacher   view mode (default: 'student')
 *
 * Renders a single production exercise component (e.g. QuizExercise) with
 * data sourced from the exercise-preview server (/preview/bundles/:id).
 * Wraps the component in MockSessionProvider so SessionCtx hooks don't crash.
 *
 * Submission flow (student view): runs the plugin's `localGrade` against the
 * full answerKey from the story — no backend call. For complex types that
 * need server-side grading (image-upload, rich-content-quiz), a future
 * iteration will POST to /preview/sessions/:id/check.
 */
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MockSessionProvider } from './preview/MockSessionProvider'
import { loadStory, type LoadedPreviewStory } from './preview/loadStory'
import { getExerciseType } from '../components/student/exercise/plugins/registry'
import '../components/student/exercise/plugins/built-in' // side-effect: registers all 11 plugins
import type { ExerciseUIPlugin } from '../components/student/exercise/plugins/types'
import '../styles/teacher-base.css'
import '../styles/teacher-observe.css'

type Role = 'student' | 'teacher'

export default function PluginPreviewPage() {
  const [params, setParams] = useSearchParams()
  const bundleId = params.get('bundle')
  const storyName = params.get('story') ?? 'Default'
  const role = (params.get('role') ?? 'student') as Role
  // ?embed=1 — hide the built-in top chrome so the page can be iframed by
  // the exercise-preview chrome without showing two title/role bars.
  const embed = params.get('embed') === '1'

  const [loaded, setLoaded] = useState<LoadedPreviewStory | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bundleId) {
      setError('Missing ?bundle= URL param. Try /exercise-demo?bundle=quiz&story=Default')
      return
    }
    setLoaded(null)
    setError(null)
    loadStory(bundleId, storyName)
      .then(setLoaded)
      .catch((e) => setError(String(e?.message ?? e)))
  }, [bundleId, storyName])

  const switchRole = (next: Role) => {
    const p = new URLSearchParams(params)
    p.set('role', next)
    setParams(p, { replace: true })
  }

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui, sans-serif' }}>
        <h2 style={{ color: '#942929', marginBottom: 12 }}>Preview Error</h2>
        <pre style={{ background: '#f5dada', padding: 14, borderRadius: 6, color: '#942929' }}>{error}</pre>
        <p style={{ marginTop: 16, color: '#5c5b56' }}>
          Make sure the preview server is running:{' '}
          <code style={{ background: '#edece7', padding: '2px 6px', borderRadius: 3 }}>
            npx exercise-preview packages/exercise-preview/bundles/
          </code>
        </p>
      </div>
    )
  }

  if (!loaded) {
    return <div style={{ padding: 40, color: '#9c9a92' }}>Loading preview…</div>
  }

  const plugin = getExerciseType(loaded.plugin.type)
  if (!plugin) {
    return (
      <div style={{ padding: 40, color: '#942929' }}>
        No frontend plugin registered for type "{loaded.plugin.type}".
      </div>
    )
  }

  return (
    <MockSessionProvider>
      <div style={{ minHeight: '100vh', background: '#f4f3ef', display: 'flex', flexDirection: 'column' }}>
        {!embed && <PreviewChrome loaded={loaded} role={role} onSwitchRole={switchRole} />}
        <div style={{ flex: 1, padding: embed ? '0' : '24px 32px', maxWidth: embed ? 'none' : 1200, margin: '0 auto', width: '100%' }}>
          {role === 'student' ? (
            <StudentStage plugin={plugin} story={loaded.story} />
          ) : (
            <TeacherStage plugin={plugin} story={loaded.story} />
          )}
        </div>
      </div>
    </MockSessionProvider>
  )
}

/* ── Chrome (top bar) ────────────────────────────────────────────────── */

function PreviewChrome({
  loaded,
  role,
  onSwitchRole,
}: {
  loaded: LoadedPreviewStory
  role: Role
  onSwitchRole: (r: Role) => void
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 20px',
        background: '#fbfaf7',
        borderBottom: '1px solid rgba(28,28,26,.07)',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 700 }}>{loaded.meta.title ?? loaded.bundleId}</div>
      <div style={{ color: '#9c9a92', fontSize: 11 }}>
        {loaded.plugin.type} · {loaded.storyName}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, background: '#edece7', borderRadius: 6, padding: 3 }}>
        {(['student', 'teacher'] as Role[]).map((r) => (
          <button
            key={r}
            onClick={() => onSwitchRole(r)}
            style={{
              border: 'none',
              padding: '5px 12px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              background: role === r ? '#1c1c1a' : 'transparent',
              color: role === r ? '#f0efe8' : '#5c5b56',
            }}
          >
            {r === 'student' ? '学生' : '教师'}
          </button>
        ))}
      </div>
    </header>
  )
}

/* ── Student stage ───────────────────────────────────────────────────── */

function StudentStage({ plugin, story }: { plugin: ExerciseUIPlugin; story: LoadedPreviewStory['story'] }) {
  // Build an `exercise` from the answerKey via the plugin's enrichFromManifest.
  // This is the same offline path used in production when no API spec is available.
  // Use Record<string, any> rather than unknown so plugin.Component (which takes
  // Record<string, any>) accepts the value without casting at the call site.
  const exercise = useMemo<Record<string, any>>(() => {
    const ex: Record<string, any> = { type: plugin.type }
    plugin.enrichFromManifest?.(ex, story.answerKey as Record<string, any>)
    return ex
  }, [plugin, story.answerKey])

  const [ans, setAns] = useState<Record<string, any>>(story.initialAns ?? {})
  const [checkResultState, setCheckResultState] = useState<Record<string, any>>({})
  const [allDone, setAllDone] = useState(false)
  const [softDone, setSoftDone] = useState(false)

  const Component = plugin.Component

  return (
    <div>
      <Component
        exercise={exercise}
        ans={ans}
        setAns={setAns}
        allDone={allDone}
        softDone={softDone}
        reviewData={story.reviewData}
        checkResultState={checkResultState}
        setCheckResultState={setCheckResultState}
        onDone={() => {
          setAllDone(true)
          setSoftDone(true)
        }}
        stepIdx={0}
        taskId={1}
        locale={story.locale}
      />

      {!plugin.selfManagedSubmit && (
        <SubmitBar
          plugin={plugin}
          exercise={exercise}
          ans={ans}
          checkResultState={checkResultState}
          onResult={(out) => {
            setCheckResultState(out.checkResultState)
            setAllDone(out.allDone)
            setSoftDone(out.softDone)
          }}
        />
      )}
    </div>
  )
}

// First-submit baseline for plugin.localGrade — empty correct set + no prior
// attempts. Per-plugin localGrade implementations diverge from here.
const EMPTY_PREV_GRADE = { correctQs: new Set<number>(), attempts: {} as Record<number, any[]> }

function SubmitBar({
  plugin,
  exercise,
  ans,
  checkResultState,
  onResult,
}: {
  plugin: ExerciseUIPlugin
  exercise: Record<string, any>
  ans: Record<string, any>
  checkResultState: Record<string, any>
  onResult: (out: import('../components/student/exercise/plugins/types').CheckResultHandlerOutput) => void
}) {
  const canSubmit = plugin.canSubmit(exercise, ans, checkResultState)
  return (
    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
      <button
        disabled={!canSubmit}
        onClick={() => {
          // Local grade path: works for quiz/match/order/etc. that ship `localGrade`.
          const result = plugin.localGrade?.(exercise, ans, EMPTY_PREV_GRADE, 1)
          if (result) {
            onResult({
              checkResultState: {
                allDone: result.allDone,
                softDone: result.softDone,
                correctQs: result.correctQs,
                wrongQs: result.wrongQs,
                attempts: result.attempts,
              },
              allDone: result.allDone,
              softDone: result.softDone,
              correctQs: result.correctQs,
              wrongQs: result.wrongQs,
              attempts: result.attempts,
              clearAnsKeys: result.clearAnsKeys,
            })
          }
        }}
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
        提交答案
      </button>
    </div>
  )
}

/* ── Teacher stage ───────────────────────────────────────────────────── */

function TeacherStage({ plugin, story }: { plugin: ExerciseUIPlugin; story: LoadedPreviewStory['story'] }) {
  const ClassView = plugin.ObserveClassView
  if (!ClassView) {
    return (
      <div style={{ padding: 40, color: '#7a4d0e', background: '#f6edda', borderRadius: 8 }}>
        Plugin "{plugin.type}" 没有声明 ObserveClassView — 教师视角不可用。
      </div>
    )
  }
  if (!story.classObserveData) {
    return (
      <div style={{ padding: 40, color: '#7a4d0e', background: '#f6edda', borderRadius: 8 }}>
        <strong>该 story 缺少 classObserveData</strong>
        <br />
        <span style={{ fontSize: 12 }}>
          在 *.stories.mjs 中给本 story 加 <code>classObserveData</code>（对应 ObserveClassView 的 data shape）即可启用教师视角。
        </span>
      </div>
    )
  }
  return (
    <div className="m2-shell" style={{ padding: 0 }}>
      <ClassView data={story.classObserveData} onStudentSelect={() => { /* no-op in preview */ }} />
    </div>
  )
}
