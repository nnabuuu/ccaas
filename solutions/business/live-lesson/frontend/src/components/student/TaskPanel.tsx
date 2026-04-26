import { useState, useEffect, useCallback, useRef, createContext, Fragment } from 'react'
import { linkParas } from './utils/linkParas'
import BoardInline from './BoardInline'
import AudioButton from './AudioButton'
import { DiscussPhase } from './DiscussPhase'
import { PracticePhase } from './PracticePhase'
import { TASKS, LESSON_INTRO, LESSON_SUMMARY } from './task-data'
import type { Task } from './task-data'

export { TASKS } from './task-data'
export type { Task } from './task-data'

export const SessionCtx = createContext<{ sessionCode?: string; studentId?: string; submit?: (step: number, data: Record<string, any>) => Promise<boolean> }>({})

/* ═══ MARKDOWN-LITE RENDERER ═══ */
function renderMd(text: string) {
  if (!text) return null
  const lines = text.split('\n')
  return lines.map((line, i) => {
    let parts: (string | JSX.Element)[] = [line]
    // bold **...**
    parts = parts.flatMap((p, pi) => {
      if (typeof p !== 'string') return [p]
      const segs: (string | JSX.Element)[] = []
      let rest = p
      while (rest.includes('**')) {
        const a = rest.indexOf('**')
        const b = rest.indexOf('**', a + 2)
        if (b === -1) { segs.push(rest); rest = ''; break }
        if (a > 0) segs.push(rest.slice(0, a))
        segs.push(<strong key={`b${pi}${a}`}>{rest.slice(a + 2, b)}</strong>)
        rest = rest.slice(b + 2)
      }
      if (rest) segs.push(rest)
      return segs
    })
    // italic *...*
    parts = parts.flatMap((p, pi) => {
      if (typeof p !== 'string') return [p]
      const segs: (string | JSX.Element)[] = []
      let rest = p
      while (rest.includes('*')) {
        const a = rest.indexOf('*')
        const b = rest.indexOf('*', a + 1)
        if (b === -1) { segs.push(rest); rest = ''; break }
        if (a > 0) segs.push(rest.slice(0, a))
        segs.push(<em key={`i${pi}${a}`}>{rest.slice(a + 1, b)}</em>)
        rest = rest.slice(b + 1)
      }
      if (rest) segs.push(rest)
      return segs
    })
    // para links ¶N, ¶N-M
    parts = parts.flatMap((p) => {
      if (typeof p !== 'string') return [p]
      return linkParas(p)
    })
    // bullet
    if (line.startsWith('• ')) {
      return <div key={i} style={{ paddingLeft: 12, position: 'relative', lineHeight: 1.7 }}>• {parts.map((p) => typeof p === 'string' ? p.replace('• ', '') : p)}</div>
    }
    return <Fragment key={i}>{i > 0 && <br />}{parts}</Fragment>
  })
}

const PHASE_IDS = ['listen', 'practice', 'discuss', 'takeaway'] as const
const PHASE_LABELS = ['Listen', 'Practice', 'Discuss', 'Takeaway']

/* ═══ LISTEN PHASE ═══ */
function ListenPhase({ task, onDone, lessonId }: { task: Task; onDone: () => void; lessonId?: string }) {
  const [done, setDone] = useState(false)
  const handleClick = () => { setDone(true); onDone() }
  return (
    <div id="phase-listen">
      <div className="stu-section-label"><span>Listen</span><div className="stu-section-line" /></div>
      <div style={{ marginBottom: 20 }}>
        {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/step-${task.id}-intro.mp3`} />}
        <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--t2)', whiteSpace: 'pre-line' }}>
          {renderMd(task.intro)}
        </div>
      </div>
      <button className={`stu-btn ${done ? 'ghost' : 'pri'}`} onClick={handleClick} disabled={done}>
        {done ? 'Confirmed ✓' : "Got it, let's practice →"}
      </button>
    </div>
  )
}

/* ═══ TAKEAWAY PHASE ═══ */
function TakeawayPhase({ task, onComplete, lessonId }: { task: Task; onComplete: () => void; lessonId?: string }) {
  return (
    <div id="phase-takeaway">
      <div className="stu-section-label"><span>Takeaway</span><div className="stu-section-line" /></div>
      <div style={{ marginBottom: 16 }}>
        {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/step-${task.id}-summary.mp3`} />}
        <div style={{ fontSize: 15, lineHeight: 1.85, color: 'var(--t1)', whiteSpace: 'pre-line' }}>{renderMd(task.summary)}</div>
      </div>
      <BoardInline taskId={task.id} />
      <button className="stu-btn pri" style={{ marginTop: 8 }} onClick={onComplete}>
        {task.id < 5 ? 'Next Task →' : 'Complete Course →'}
      </button>
    </div>
  )
}

/* ═══ TASK VIEW — main component ═══ */
function TaskView({ task, onComplete, lessonId }: { task: Task; onComplete: () => void; lessonId?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activePhase, setActivePhase] = useState('listen')
  const [listenDone, setListenDone] = useState(false)
  const [practiceDone, setPracticeDone] = useState(false)
  const [discussDone, setDiscussDone] = useState(false)

  useEffect(() => { setListenDone(false); setPracticeDone(false); setDiscussDone(false); setActivePhase('listen') }, [task.id])

  /* IntersectionObserver for phase tracking */
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio > 0.15) {
          setActivePhase(e.target.id.replace('phase-', ''))
        }
      })
    }, { root: container, rootMargin: '-40px 0px -60% 0px', threshold: [0.15] })
    const t = setTimeout(() => {
      PHASE_IDS.forEach(id => { const el = container.querySelector(`#phase-${id}`); if (el) observer.observe(el) })
    }, 100)
    return () => { clearTimeout(t); observer.disconnect() }
  }, [task.id, listenDone, practiceDone, discussDone])

  /* Auto-scroll to newly unlocked phase after DOM commits */
  useEffect(() => {
    if (!listenDone) return
    const el = scrollRef.current?.querySelector('#phase-practice')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [listenDone])

  useEffect(() => {
    if (!practiceDone) return
    const el = scrollRef.current?.querySelector('#phase-discuss')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [practiceDone])

  useEffect(() => {
    if (!discussDone) return
    const el = scrollRef.current?.querySelector('#phase-takeaway')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [discussDone])

  const onListenDone = useCallback(() => { setListenDone(true) }, [])
  const onPracticeDone = useCallback(() => { setPracticeDone(true) }, [])
  const onDiscussDone = useCallback(() => { setDiscussDone(true) }, [])

  const jumpTo = (phaseId: string) => {
    if (phaseId === 'practice' && !listenDone) return
    if (phaseId === 'discuss' && !practiceDone) return
    if (phaseId === 'takeaway' && !discussDone) return
    const el = scrollRef.current?.querySelector(`#phase-${phaseId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const phaseVisible = (id: string) => {
    if (id === 'listen') return true
    if (id === 'practice') return listenDone
    if (id === 'discuss') return practiceDone
    if (id === 'takeaway') return discussDone
    return false
  }

  return (
    <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
      {/* Sticky phase nav — inside scroll container so scroll-margin-top works */}
      <div className="stu-phase-nav">
        {PHASE_IDS.map((id, i) => {
          const isAct = activePhase === id
          const vis = phaseVisible(id)
          return (
            <div
              key={id}
              className={`stu-phase-tab${isAct ? ' active' : ''}${!vis ? ' locked' : ''}`}
              onClick={vis ? () => jumpTo(id) : undefined}
            >
              <span>{PHASE_LABELS[i]}</span>
              {!vis && <span style={{ fontSize: 8, marginLeft: 2, color: 'var(--t3)' }}>🔒</span>}
            </div>
          )
        })}
      </div>

      <div className="stu-task-inner">
        <div style={{ paddingTop: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
            Task {task.id} · {task.name} — {task.time}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.4px', lineHeight: 1.3, marginBottom: 8, color: 'var(--t1)' }}>
            {task.subtitle}
          </div>
        </div>
        <ListenPhase key={`l${task.id}`} task={task} onDone={onListenDone} lessonId={lessonId} />
        {listenDone && <PracticePhase key={`p${task.id}`} task={task} onDone={onPracticeDone} />}
        {!listenDone && <div className="stu-phase-locked-msg">Complete Listen to unlock Practice</div>}
        {practiceDone && <DiscussPhase key={`d${task.id}`} task={task} onDone={onDiscussDone} />}
        {listenDone && !practiceDone && <div className="stu-phase-locked-msg">Complete Practice to unlock Discuss</div>}
        {discussDone && <TakeawayPhase task={task} onComplete={onComplete} lessonId={lessonId} />}
        {practiceDone && !discussDone && <div className="stu-phase-locked-msg">Complete Discuss to unlock Takeaway</div>}
        <div style={{ height: 80 }} />
      </div>
    </div>
  )
}

/* ═══ CUSTOM HOOK — useStudentTask ═══ */
export function useStudentTask() {
  const [screen, setScreen] = useState<string>('intro')
  const [doneSet, setDoneSet] = useState<Set<number>>(new Set())

  let taskId = 0
  if (screen !== 'intro' && screen !== 'summary') taskId = parseInt(screen)
  const task = TASKS.find(t => t.id === taskId)

  // Listen for sync messages from parent (demo orchestrator)
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      const d = e.data
      if (!d || typeof d !== 'object') return
      if (d.type === 'sync' && typeof d.step === 'number') {
        setScreen(String(d.step + 1))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const completeTask = useCallback((tid: number) => {
    setDoneSet(d => { const n = new Set(d); n.add(tid); return n })
    if (tid < 5) setScreen(String(tid + 1)); else setScreen('summary')
  }, [])

  const currentFocus = task ? task.focus : []

  return { taskId, task, currentFocus, doneSet, screen, setScreen, completeTask }
}

/* ═══ TASK COLUMN — rendered as a proper component ═══ */
export function TaskColumn({ screen, setScreen, task, completeTask, lessonId }: {
  screen: string
  setScreen: (s: string) => void
  task: Task | undefined
  completeTask: (tid: number) => void
  lessonId?: string
}) {
  return (
    <div className="stu-left-col">
      {screen === 'intro' && (
        <div className="stu-task-inner" style={{ paddingTop: 32 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Welcome</div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 16 }}>Ideal Beauty</div>
            {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/lesson-intro.mp3`} />}
            <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--t2)', whiteSpace: 'pre-line' }}>{renderMd(LESSON_INTRO)}</div>
          </div>
          <button className="stu-btn pri" onClick={() => setScreen('1')}>Start Task 1 →</button>
        </div>
      )}
      {screen === 'summary' && (
        <div className="stu-task-inner" style={{ paddingTop: 32 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Complete</div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 16 }}>Great job today!</div>
            {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/lesson-summary.mp3`} />}
            <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--t2)', whiteSpace: 'pre-line' }}>{renderMd(LESSON_SUMMARY)}</div>
          </div>
        </div>
      )}
      {task && <TaskView key={task.id} task={task} onComplete={() => completeTask(task.id)} lessonId={lessonId} />}
    </div>
  )
}

/* default export kept for backwards compat — re-export the hook */
export default useStudentTask
