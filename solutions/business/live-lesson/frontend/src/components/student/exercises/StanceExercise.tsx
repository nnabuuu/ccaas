import HelpButton from '../HelpButton'

interface Props {
  stanceQ: string
  stanceQZh?: string
  stanceOpts: string[]
  evidence: string[]
  ans: Record<string, any>
  setAns: (fn: (a: Record<string, any>) => Record<string, any>) => void
  softDone: boolean
}

export function StanceExercise({ stanceQ, stanceQZh, stanceOpts, evidence, ans, setAns, softDone }: Props) {
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
            className={`stu-stance-btn${ans.stance === o ? ' selected' : ''}`}
            onClick={softDone ? undefined : () => setAns(a => ({ ...a, stance: o }))}
          >{o}</button>
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', marginBottom: 6 }}>Select supporting evidence (at least 1):</div>
      {evidence.map((ev, ei) => {
        const sel = (ans.evidence || []).includes(ei)
        return (
          <div
            key={ei}
            className={`stu-evidence-row${sel ? ' selected' : ''}`}
            onClick={softDone ? undefined : () => setAns(a => {
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
