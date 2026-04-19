import { useState, useEffect, useCallback } from 'react'
import type { ReadingManifest } from '../../types/reading'
import StepTabs from './StepTabs'
import TaskPanel from './TaskPanel'
import TextPanel from './TextPanel'
import BoardDrawer from './BoardDrawer'
import AiPanel from './AiPanel'

interface Props {
  manifest: ReadingManifest
  embed?: boolean
}

const AI_PRESETS = [
  { q: '什么是"关键转折词"?', a: '<strong>转折词</strong>是文章结构的<strong>路标</strong>。<br><span class="ex">change over time</span> → 按<strong>时间</strong><br><span class="ex">around the world</span> → 按<strong>地理</strong><br><span class="ex">It appears that</span> → <strong>总结</strong>' },
  { q: 'History 和 Culture 怎么区分?', a: '<strong>History</strong> = 同一地方、不同时代。关键词：<span class="ex">over time</span> <span class="ex">1600s</span><br><strong>Culture</strong> = 同一时代、不同地方。关键词：<span class="ex">around the world</span> <span class="ex">Borneo</span>' },
  { q: '怎么判断是 Conclusion?', a: '1. 信号词开头：<span class="ex">It appears that</span><br>2. 不举新例子<br>3. 回到开头问题<br>¶8 符合全部三条。' },
  { q: '什么是 Skimming?', a: '不逐字读，只读每段<strong>第一句</strong>和<strong>转折词</strong>，快速判断结构。' },
]

export default function StudentShell({ manifest, embed }: Props) {
  const [step, setStep] = useState(0)
  const [boardOpen, setBoardOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  const currentReadingStep = manifest.readingSteps[step]
  const focusParagraphs = currentReadingStep?.focusParagraphs || []

  // Listen for sync messages from parent (demo orchestrator)
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data
      if (!d || typeof d !== 'object') return
      if (d.type === 'sync' && typeof d.step === 'number') {
        setStep(d.step)
        if (d.step >= 1 && !boardOpen) setBoardOpen(true)
      }
    }
    window.addEventListener('message', onMessage)
    // Signal ready
    try { window.parent?.postMessage({ type: 'ready', role: 'student' }, '*') } catch { /* noop */ }
    return () => window.removeEventListener('message', onMessage)
  }, [boardOpen])

  const handleJumpTo = useCallback((_paraId: string) => {
    // Text panel is always visible in the text-primary layout
    // Scroll handled internally by TextPanel
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--rd-bg)', color: 'var(--rd-t1)' }}>
      {/* Top bar */}
      {!embed && (
        <div className="stu-top">
          <div className="stu-top-title">{manifest.title}</div>
          <div className="stu-top-class">高一(3)班</div>
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
                />
              )}
            </div>
          </div>

          {/* AI panel */}
          <AiPanel
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            presets={AI_PRESETS}
          />
        </div>
      </div>
    </div>
  )
}
