import { useContext } from 'react'
import HelpButton, { HintBanner } from '../HelpButton'
import { renderMd } from '../renderMd'
import { SessionCtx } from '../TaskPanel'
import { scrollToParas } from '../utils/linkParas'
import type { TaskQuestion, ServerHintMap } from '../task-data'

interface Props {
  questions: TaskQuestion[]
  ans: Record<string, any>
  setAns: (fn: (a: Record<string, any>) => Record<string, any>) => void
  correctQs: Set<number>
  wrongQs: Set<number>
  attemptCount: (qi: number) => number
  serverHints?: ServerHintMap
}

export function QuizExercise({ questions, ans, setAns, correctQs, wrongQs, attemptCount, serverHints }: Props) {
  const { config } = useContext(SessionCtx)
  const mathOpts = { math: config.enableMath }
  return <>
    {questions.map((q, qi) => {
      const locked = correctQs.has(qi)
      const isWrong = wrongQs.has(qi)
      const tries = attemptCount(qi)
      const sh = serverHints?.[qi]
      const hint = sh?.hint ?? q.hint
      const hintZh = sh?.hintZh ?? q.hintZh
      const wt = sh?.walkthrough ?? q.walkthrough
      const wtZh = sh?.walkthroughZh ?? q.walkthroughZh
      return (
        <div key={qi} className={`stu-quiz-card${locked ? ' correct' : ''}`}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1 }}>{renderMd(q.q, mathOpts)}</span>
            {locked && <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>✓</span>}
            {tries > 0 && !locked && <span style={{ fontSize: 9, color: 'var(--t3)' }}>{tries === 1 ? '1 attempt' : `${tries} attempts`}</span>}
            {q.paraRef && !locked && (
              <button className="stu-locate-btn" onClick={e => { e.stopPropagation(); scrollToParas(q.paraRef!.map(n => `p${n}`)) }} title="查看原文">📖</button>
            )}
            <HelpButton hint={hint} hintZh={hintZh} translate={q.translate} />
          </div>
          {q.opts.map((o, oi) => {
            const sel = ans[qi] === oi
            // Server-side check path: q.correct is undefined; use the submitted answer (confirmed correct by server)
            const correctIdx = q.correct ?? ans[qi]
            const isCorrectLocked = locked && oi === correctIdx
            return (
              <div
                key={oi}
                className={`stu-quiz-opt${isCorrectLocked ? ' opt-correct' : sel ? ' selected' : ''}`}
                style={locked && oi !== correctIdx ? { opacity: 0.5, cursor: 'default' } : locked ? { cursor: 'default' } : undefined}
                onClick={locked ? undefined : () => setAns(a => ({ ...a, [qi]: oi }))}
              >
                <span className="stu-quiz-radio" />{isCorrectLocked ? <><span>✓ </span>{renderMd(o, mathOpts)}</> : renderMd(o, mathOpts)}
              </div>
            )
          })}
          {isWrong && <HintBanner hint={hint} hintZh={hintZh} walkthrough={tries >= 2 ? wt : undefined} walkthroughZh={tries >= 2 ? wtZh : undefined} />}
        </div>
      )
    })}
  </>
}
