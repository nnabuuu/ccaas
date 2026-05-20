import HelpButton from '../HelpButton'
import { useReviewRestore, type ReviewData } from '../../../hooks/useReviewRestore'

interface Props {
  stanceQ: string
  stanceQZh?: string
  stanceOpts: string[]
  evidence: string[]
  ans: Record<string, any>
  setAns: (fn: (a: Record<string, any>) => Record<string, any>) => void
  softDone: boolean
  reviewData?: ReviewData
}

export function parseStanceReview(review: ReviewData) {
  const { data } = review
  return {
    state: {
      // Submission stores 'position'; component state uses 'stance'
      ans: { stance: data.position, evidence: data.evidence || [] },
      softDone: true,
    },
    allDone: true,
  }
}

export function StanceExercise({ stanceQ, stanceQZh, stanceOpts, evidence, ans, setAns, softDone, reviewData }: Props) {
  const restored = useReviewRestore(reviewData, parseStanceReview)
  const effectiveAns = restored?.ans ?? ans
  const effectiveSoftDone = restored?.softDone ?? softDone
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        {stanceQ}
        <HelpButton translate={stanceQZh} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {stanceOpts.map((o, oi) => (
          <button
            key={oi}
            className={`stu-stance-btn${effectiveAns.stance === o ? ' selected' : ''}`}
            onClick={effectiveSoftDone ? undefined : () => setAns(a => ({ ...a, stance: o }))}
          >{o}</button>
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', marginBottom: 6 }}>Select supporting evidence (at least 1):</div>
      {evidence.map((ev, ei) => {
        const sel = (effectiveAns.evidence || []).includes(ei)
        return (
          <div
            key={ei}
            className={`stu-evidence-row${sel ? ' selected' : ''}`}
            onClick={effectiveSoftDone ? undefined : () => setAns(a => {
              const c = a.evidence || []
              return { ...a, evidence: sel ? c.filter((x: number) => x !== ei) : [...c, ei] }
            })}
          >
            <span style={{ flexShrink: 0 }}>{sel ? '✓' : '○'}</span> {ev}
          </div>
        )
      })}
    </div>
  )
}
