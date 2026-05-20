import { useState, useRef, useEffect, Fragment } from 'react'

export interface FormulaAnimationProps {
  formula: string
  pairs: { vars: [string, string]; cls: string }[]
  substitution?: string
}

/**
 * Interactive formula expansion animation — highlights variable pairs
 * in sequence, reveals the expanded product terms, then shows substitution.
 *
 * Ported from design/practice-app-v3.jsx FormulaAnimation.
 */
export default function FormulaAnimation({ formula, pairs, substitution }: FormulaAnimationProps) {
  const [stage, setStage] = useState(-1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Parse formula "(a+b)(m+n)" → vars [a, b, m, n] and ops [+, +]
  const parsed = parseFormula(formula)

  useEffect(() => {
    if (stage >= 0 && stage < pairs.length + 1) {
      const delay = stage === 0 ? 800 : 1000
      timerRef.current = setTimeout(() => setStage(s => s + 1), delay)
      return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }
  }, [stage, pairs.length])

  const play = () => setStage(0)
  const totalStages = pairs.length + 1 // pairs.length highlight stages + 1 final "done" stage

  const varClass = (v: string): string => {
    if (stage < 0) return ''
    if (stage >= pairs.length) return 'fv-done'
    const p = pairs[stage]
    if (p && p.vars.includes(v)) return p.cls
    return 'fv-dim'
  }

  const showExpand = stage >= 1
  const showSubst = substitution && stage >= totalStages

  return (
    <div className="sw-formula-box">
      <div className="sw-formula-label-row">
        <span className="sw-formula-rule-label">{parsed.ruleLabel}</span>
      </div>
      <div className="sw-formula-main">
        <span className="sw-fp">(</span>
        <span className={'sw-fv ' + varClass(parsed.vars[0])}>{parsed.vars[0]}</span>
        <span className="sw-fo">{parsed.ops[0]}</span>
        <span className={'sw-fv ' + varClass(parsed.vars[1])}>{parsed.vars[1]}</span>
        <span className="sw-fp">)</span>
        <span className="sw-fp">(</span>
        <span className={'sw-fv ' + varClass(parsed.vars[2])}>{parsed.vars[2]}</span>
        <span className="sw-fo">{parsed.ops[1]}</span>
        <span className={'sw-fv ' + varClass(parsed.vars[3])}>{parsed.vars[3]}</span>
        <span className="sw-fp">)</span>
      </div>
      {showExpand && (
        <div className="sw-formula-expand">
          <span className="sw-feq">=</span>
          {pairs.map((p, i) => (
            <Fragment key={i}>
              {i > 0 && <span className={'sw-fplus' + (stage > i ? ' vis' : '')}> + </span>}
              <span className={'sw-ft ' + p.cls + (stage > i ? ' vis' : '')}>
                {p.vars[0]}{p.vars[1]}
              </span>
            </Fragment>
          ))}
        </div>
      )}
      {showSubst && (
        <div className="sw-formula-subst">
          <div className="sw-formula-subst-label">{substitution}</div>
        </div>
      )}
      <button className="sw-formula-play" onClick={play} type="button">
        {stage < 0
          ? <span>&#x25B6; 演示展开过程</span>
          : stage >= totalStages
            ? <span>&#x21BB; 重新演示</span>
            : <span className="sw-formula-playing">演示中…</span>}
      </button>
    </div>
  )
}

/** Parse "(a+b)(m+n)" → { vars: [a,b,m,n], ops: [+,+], ruleLabel }. Exported for testing. */
export function parseFormula(formula: string): { vars: string[]; ops: string[]; ruleLabel: string } {
  // Match pattern like (X op Y)(X op Y) where op is + or -
  const re = /\(([^()]+?)([+\-−])([^()]+?)\)\s*\(([^()]+?)([+\-−])([^()]+?)\)/
  const m = formula.match(re)
  if (m) {
    const normalize = (op: string) => op === '-' ? '−' : op
    return {
      vars: [m[1].trim(), m[3].trim(), m[4].trim(), m[6].trim()],
      ops: [normalize(m[2]), normalize(m[5])],
      ruleLabel: '乘法分配律',
    }
  }
  // Fallback: just show the raw formula
  return { vars: ['a', 'b', 'm', 'n'], ops: ['+', '+'], ruleLabel: '乘法分配律' }
}
