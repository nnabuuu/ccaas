import { useContext } from 'react'
import HelpButton, { HintBanner } from '../HelpButton'
import { renderMd } from '../renderMd'
import { SessionCtx } from '../TaskPanel'
import { scrollToParas } from '../utils/linkParas'
import type { TaskMatchPair, ServerHintMap } from '../task-data'

interface Props {
  pairs: TaskMatchPair[]
  ans: Record<string, any>
  setAns: (fn: (a: Record<string, any>) => Record<string, any>) => void
  correctQs: Set<number>
  wrongQs: Set<number>
  attemptCount: (pi: number) => number
  serverHints?: ServerHintMap
}

export function MatchExercise({ pairs, ans, setAns, correctQs, wrongQs, attemptCount, serverHints }: Props) {
  const { config } = useContext(SessionCtx)
  const mathOpts = { math: config.enableMath }
  return <>
    {pairs.map((p, pi) => {
      const locked = correctQs.has(pi)
      const isWrong = wrongQs.has(pi)
      const tries = attemptCount(pi)
      const sh = serverHints?.[pi]
      const hint = sh?.hint ?? p.hint
      const hintZh = sh?.hintZh ?? p.hintZh
      const wt = sh?.walkthrough ?? p.walkthrough
      const wtZh = sh?.walkthroughZh ?? p.walkthroughZh
      return (
        <div key={pi}>
          <div className="stu-match-row">
            <div className="stu-match-left" style={locked ? { color: 'var(--green)' } : undefined}>{locked ? '✓' : renderMd(p.left, mathOpts)}</div>
            <div style={{ display: 'flex', gap: 5, flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              {p.opts.map((o, oi) => {
                const sel = ans[pi] === oi
                const correctIdx = p.correct ?? ans[pi]
                const isCorrectLocked = locked && oi === correctIdx
                let cls = 'stu-match-opt'
                if (isCorrectLocked) cls += ' correct'
                else if (sel) cls += ' selected'
                return (
                  <div
                    role="button" tabIndex={locked ? -1 : 0}
                    key={oi} className={cls}
                    style={locked && oi !== correctIdx ? { opacity: 0.4, cursor: 'default' } : locked ? { cursor: 'default' } : undefined}
                    onClick={locked ? undefined : () => setAns(a => ({ ...a, [pi]: oi }))}
                    onKeyDown={locked ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAns(a => ({ ...a, [pi]: oi })) } }}
                  >{renderMd(o, mathOpts)}</div>
                )
              })}
              {p.paraRef && !locked && (
                <button className="stu-locate-btn" onClick={e => { e.stopPropagation(); scrollToParas(p.paraRef!.map(n => `p${n}`)) }} title="查看原文">📖</button>
              )}
              {!locked && <HelpButton hint={hint} hintZh={hintZh} />}
              {tries > 0 && !locked && <span style={{ fontSize: 9, color: 'var(--t3)' }}>{tries === 1 ? '1 attempt' : `${tries} attempts`}</span>}
            </div>
          </div>
          {isWrong && <HintBanner hint={hint} hintZh={hintZh} walkthrough={tries >= 2 ? wt : undefined} walkthroughZh={tries >= 2 ? wtZh : undefined} />}
        </div>
      )
    })}
  </>
}
