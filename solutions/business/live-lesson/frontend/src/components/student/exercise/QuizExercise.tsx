import { useContext } from 'react'
import HelpButton, { HintBanner } from '../HelpButton'
import { renderMd } from '../renderMd'
import { SessionCtx } from '../TaskPanel'
import { scrollToParas } from '../utils/linkParas'
import type { TaskQuestion, ServerHintMap } from '../task-data'
import { useReviewRestore, type ReviewData } from '../../../hooks/useReviewRestore'
import { toIdx } from '../../../utils/parse-helpers'
import { useT, type Locale } from '../../../i18n'

interface Props {
  questions: TaskQuestion[]
  ans: Record<string, any>
  setAns: (fn: (a: Record<string, any>) => Record<string, any>) => void
  correctQs: Set<number>
  wrongQs: Set<number>
  attemptCount: (qi: number) => number
  serverHints?: ServerHintMap
  reviewData?: ReviewData
  locale?: Locale
}

export function parseQuizReview(review: ReviewData, questionCount: number) {
  const { data, checkItems } = review
  const ans: Record<string, any> = {}
  ;((data.answers as unknown[]) || []).forEach((v, i) => { ans[i] = v })
  const correctQs = new Set<number>()
  const wrongQs = new Set<number>()
  if (checkItems?.length) {
    checkItems.forEach(it => {
      const idx = toIdx(it.idx)
      if (it.correct) correctQs.add(idx); else wrongQs.add(idx)
    })
  } else {
    for (let i = 0; i < questionCount; i++) correctQs.add(i)
  }
  return { state: { ans, correctQs, wrongQs }, allDone: true }
}

export function QuizExercise({ questions, ans, setAns, correctQs, wrongQs, attemptCount, serverHints, reviewData, locale }: Props) {
  const restored = useReviewRestore(reviewData, (r) => parseQuizReview(r, questions.length))
  const effectiveAns = restored?.ans ?? ans
  const effectiveCorrectQs = restored?.correctQs ?? correctQs
  const effectiveWrongQs = restored?.wrongQs ?? wrongQs

  const t = useT(locale)
  const { config } = useContext(SessionCtx)
  const mathOpts = { math: config.enableMath }
  return <>
    {questions.map((q, qi) => {
      const locked = effectiveCorrectQs.has(qi)
      const isWrong = effectiveWrongQs.has(qi)
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
            {tries > 0 && !locked && <span style={{ fontSize: 9, color: 'var(--t3)' }}>{t('exercise.attempts', { n: tries, s: tries > 1 ? 's' : '' })}</span>}
            {q.paraRef && !locked && (
              <button className="stu-locate-btn" onClick={e => { e.stopPropagation(); scrollToParas(q.paraRef!.map(n => `p${n}`)) }} title={t('exercise.viewText')}>📖</button>
            )}
            <HelpButton hint={hint} hintZh={hintZh} translate={q.translate} />
          </div>
          {q.opts.map((o, oi) => {
            const sel = effectiveAns[qi] === oi
            // Server-side check path: q.correct is undefined; use the submitted answer (confirmed correct by server)
            const correctIdx = q.correct ?? effectiveAns[qi]
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
