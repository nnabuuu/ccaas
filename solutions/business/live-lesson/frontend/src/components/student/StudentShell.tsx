import { useState, useEffect, useCallback, useRef } from 'react'
import type { ReadingManifest } from '../../types/reading'
import { useStudentSession, useStudentStream } from '../../hooks/useClassroom'
import StepTabs from './StepTabs'
import TaskPanel from './TaskPanel'
import TextPanel from './TextPanel'
import BoardDrawer from './BoardDrawer'
import AiPanel from './AiPanel'

interface Props {
  manifest: ReadingManifest
  lessonId: string
  sessionCode: string
  embed?: boolean
}

const AI_PRESETS = [
  { q: '什么是"关键转折词"?', a: '<strong>转折词</strong>是文章结构的<strong>路标</strong>。<br><span class="ex">change over time</span> → 按<strong>时间</strong><br><span class="ex">around the world</span> → 按<strong>地理</strong><br><span class="ex">It appears that</span> → <strong>总结</strong>' },
  { q: 'History 和 Culture 怎么区分?', a: '<strong>History</strong> = 同一地方、不同时代。关键词：<span class="ex">over time</span> <span class="ex">1600s</span><br><strong>Culture</strong> = 同一时代、不同地方。关键词：<span class="ex">around the world</span> <span class="ex">Borneo</span>' },
  { q: '怎么判断是 Conclusion?', a: '1. 信号词开头：<span class="ex">It appears that</span><br>2. 不举新例子<br>3. 回到开头问题<br>¶8 符合全部三条。' },
  { q: '什么是 Skimming?', a: '不逐字读，只读每段<strong>第一句</strong>和<strong>转折词</strong>，快速判断结构。' },
]

export default function StudentShell({ manifest, lessonId, sessionCode, embed }: Props) {
  const [step, setStep] = useState(0)
  const [boardOpen, setBoardOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const session = useStudentSession(sessionCode)
  const stream = useStudentStream(sessionCode)

  // Name input overlay state (for direct /student/:lessonId access without JoinPage)
  const [nameInput, setNameInput] = useState('')

  const currentReadingStep = manifest.readingSteps[step]
  const focusParagraphs = currentReadingStep?.focusParagraphs || []

  const boardOpenRef = useRef(boardOpen)
  boardOpenRef.current = boardOpen

  // Sync step from SSE named event
  useEffect(() => {
    if (stream.currentStep !== null) {
      setStep(stream.currentStep)
    }
  }, [stream.currentStep])

  // Show notification toast from SSE
  useEffect(() => {
    if (stream.notification) {
      setToastMsg(stream.notification.message)
      const timer = setTimeout(() => setToastMsg(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [stream.notification])

  // Listen for sync messages from parent (demo orchestrator)
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      const d = e.data
      if (!d || typeof d !== 'object') return
      if (d.type === 'sync' && typeof d.step === 'number') {
        setStep(d.step)
        if (d.step >= 1 && !boardOpenRef.current) setBoardOpen(true)
      }
    }
    window.addEventListener('message', onMessage)
    try { window.parent?.postMessage({ type: 'ready', role: 'student' }, window.location.origin) } catch { /* noop */ }
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const handleJumpTo = useCallback((_paraId: string) => {
    // Text panel is always visible in the text-primary layout
  }, [])

  const handleSubmit = useCallback(async (stepIdx: number, data: Record<string, any>) => {
    return session.submit(stepIdx, data)
  }, [session])

  const handleJoin = useCallback(async () => {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    await session.join(trimmed)
  }, [nameInput, session])

  // Name input overlay — shown before joining (fallback when accessed without JoinPage)
  if (!session.studentId) {
    return (
      <div className="stu-join-overlay">
        <div className="stu-join-card">
          <div className="stu-join-title">{manifest.title}</div>
          <div className="stu-join-sub">
            课堂码 <span className="session-code-sm">{sessionCode}</span> · 输入姓名加入课堂
          </div>
          <input
            className="stu-join-input"
            placeholder="你的姓名..."
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            autoFocus
          />
          {session.joinError && (
            <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{session.joinError}</div>
          )}
          <button
            className="stu-btn pri"
            onClick={handleJoin}
            disabled={session.joining || !nameInput.trim()}
          >
            {session.joining ? '加入中...' : '加入课堂'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', color: 'var(--t1)' }}>
      {/* Top bar */}
      {!embed && (
        <div className="stu-top">
          <div className="stu-top-title">{manifest.title}</div>
          <div className="session-code-sm">{sessionCode}</div>
          <div className="stu-top-class">· {session.name}</div>
          <StepTabs steps={manifest.readingSteps} current={step} onSelect={setStep} />
          <div className="stu-top-step">{step + 1}/{manifest.readingSteps.length}</div>
        </div>
      )}

      <div className="stu-shell">
        {/* Dock sidebar */}
        <div className="stu-dock">
          <button
            className={`stu-dk dk-board${boardOpen ? ' active' : ''}`}
            onClick={() => setBoardOpen(v => !v)}
          >
            <div className="stu-dk-label">板书</div>
            <div className="stu-dk-mini">
              <div className="stu-mf">
                <div className="stu-mb pre" />
                <div className="stu-ma">›</div>
                <div className="stu-mb lk" />
                <div className="stu-ma">›</div>
                <div className="stu-mb lk" />
              </div>
            </div>
          </button>
          <button
            className="stu-dk dk-text active"
            onClick={() => { /* Text is always visible */ }}
          >
            <div className="stu-dk-label">课文</div>
            <div className="stu-dk-mini">
              <div className="stu-ml s" style={{ width: '65%' }} />
              <div className="stu-ml g" />
              <div className="stu-ml g" style={{ width: '80%' }} />
            </div>
          </button>
          <div className="stu-dk-spacer" />
          <button
            className={`stu-dk dk-ai${aiOpen ? ' active' : ''}`}
            onClick={() => setAiOpen(v => !v)}
          >
            <div className="stu-dk-label">助教</div>
            <div className="stu-dk-mini">
              <div className="stu-mini-ai">
                <div className="stu-mini-ai-chip" style={{ width: '80%' }} />
                <div className="stu-mini-ai-chip" style={{ width: '60%' }} />
                <div className="stu-mini-ai-chip" style={{ width: '70%' }} />
              </div>
            </div>
          </button>
        </div>

        {/* Main area */}
        <div className="stu-main">
          {/* Board drawer */}
          <BoardDrawer
            open={boardOpen}
            onClose={() => setBoardOpen(false)}
            steps={manifest.boardData.steps}
            currentStep={step}
          />

          {/* Lower: text (primary) + task (gutter) */}
          <div className="stu-lower">
            <TextPanel
              title={manifest.article.title}
              paragraphs={manifest.article.paragraphs}
              focusIds={focusParagraphs}
              onClose={() => { /* Text always visible */ }}
            />
            <div className="stu-task-area">
              {currentReadingStep && (
                <TaskPanel
                  step={currentReadingStep}
                  stepIdx={step}
                  onJumpTo={handleJumpTo}
                  onSubmit={handleSubmit}
                  submittedSteps={session.submittedSteps}
                />
              )}
            </div>
          </div>

          {/* AI panel */}
          <AiPanel
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            presets={AI_PRESETS}
            sessionCode={sessionCode}
            studentId={session.studentId || ''}
            step={step}
          />
        </div>
      </div>

      {/* Notification toast */}
      {toastMsg && (
        <div className="stu-toast" onClick={() => setToastMsg(null)}>
          <div className="stu-toast-icon">📢</div>
          <div className="stu-toast-msg">{toastMsg}</div>
        </div>
      )}
    </div>
  )
}
