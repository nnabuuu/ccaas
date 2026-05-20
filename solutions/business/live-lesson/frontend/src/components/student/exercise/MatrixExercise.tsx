import { useState, useRef, useMemo } from 'react'
import HelpButton from '../HelpButton'
import { scrollToParas } from '../utils/linkParas'
import MatrixGuide from './MatrixGuide'
import { readGuideSeen, markGuideSeen } from './guide-helpers'
import { useReviewRestore, type ReviewData } from '../../../hooks/useReviewRestore'
import { toIdx } from '../../../utils/parse-helpers'

import type { TaskMatrixRow, ServerHintMap } from '../task-data'

interface Props {
  rows: TaskMatrixRow[]
  practiceCount?: number
  studentId?: string
  stepIdx?: number
  serverHints?: ServerHintMap
  ans?: Record<number, { what?: string; why?: string }>
  onAnsChange?: (rowIdx: number, field: 'what' | 'why', value: string) => void
  disabled?: boolean
  rowResults?: Record<number, boolean>
  reviewData?: ReviewData
}

/** Simple deterministic hash for student+step → consistent row selection */
function hashCode(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** Select N indices from candidates using deterministic seed */
function selectPracticeRows(nonDemoIndices: number[], count: number, seed: string): Set<number> {
  if (count >= nonDemoIndices.length) return new Set(nonDemoIndices)
  const h = hashCode(seed)
  const shuffled = [...nonDemoIndices]
  let s = h
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = ((s * 1664525 + 1013904223) & 0x7fffffff)
    const j = s % (i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return new Set(shuffled.slice(0, count))
}

export function parseMatrixReview(review: ReviewData) {
  const { data, checkItems } = review
  const ans = (data.rows || {}) as Record<number, { what?: string; why?: string }>
  const rowResults: Record<number, boolean> = {}
  checkItems?.forEach(it => { rowResults[toIdx(it.idx)] = it.correct })
  return { state: { ans, rowResults }, allDone: true }
}

export function MatrixExercise({ rows, practiceCount, studentId, stepIdx, serverHints, ans = {}, onAnsChange, disabled, rowResults, reviewData }: Props) {
  const restored = useReviewRestore(reviewData, parseMatrixReview)
  const effectiveAns = restored?.ans ?? ans
  const effectiveRowResults = restored?.rowResults ?? rowResults
  const effectiveDisabled = restored ? true : disabled

  const [guideOpen, setGuideOpen] = useState(false)
  const guideSeen = useRef(readGuideSeen('guide-seen-matrix'))

  // Determine which rows are practice vs extra-demo
  const { practiceIndices, extraDemoIndices } = useMemo(() => {
    const nonDemoIndices = rows.map((r, i) => ({ r, i })).filter(x => !x.r.demo).map(x => x.i)
    if (!practiceCount || practiceCount >= nonDemoIndices.length) {
      return { practiceIndices: new Set(nonDemoIndices), extraDemoIndices: new Set<number>() }
    }
    const seed = `${studentId || 'anon'}-${stepIdx ?? 0}`
    const selected = selectPracticeRows(nonDemoIndices, practiceCount, seed)
    const extra = new Set(nonDemoIndices.filter(i => !selected.has(i)))
    return { practiceIndices: selected, extraDemoIndices: extra }
  }, [rows, practiceCount, studentId, stepIdx])

  // Ordered practice rows (by original row order)
  const orderedPractice = useMemo(() =>
    rows.map((_, i) => i).filter(i => practiceIndices.has(i)),
    [rows, practiceIndices]
  )

  // Derive active row index from ans — single source of truth, no stale closures
  const activeRowIdx = useMemo(() => {
    for (let i = 0; i < orderedPractice.length; i++) {
      const ri = orderedPractice[i]
      const a = effectiveAns[ri]
      if ((a?.what?.length ?? 0) < 3 || (a?.why?.length ?? 0) < 3) return i
    }
    return orderedPractice.length - 1
  }, [orderedPractice, effectiveAns])

  const unlockedPractice = new Set(orderedPractice.slice(0, activeRowIdx + 1))

  return (
    <div className="stu-mat-wrap">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>Matrix</span>
        <button
          className={`se-guide-btn${!guideSeen.current && !guideOpen ? ' pulse' : ''}`}
          aria-label="Matrix exercise guide"
          onClick={() => {
            setGuideOpen(true)
            markGuideSeen('guide-seen-matrix')
            guideSeen.current = true
          }}
        >?</button>
      </div>
      <MatrixGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th className="stu-mat-th" style={{ width: '22%' }}>Where / When</th>
            <th className="stu-mat-th" style={{ width: '39%' }}>What they do</th>
            <th className="stu-mat-th" style={{ width: '39%' }}>Why</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => {
            const isOriginalDemo = !!r.demo
            const isExtraDemo = extraDemoIndices.has(ri)
            const showAsDemo = isOriginalDemo || isExtraDemo
            const isPractice = practiceIndices.has(ri)
            const isUnlocked = unlockedPractice.has(ri)
            const isActive = ri === orderedPractice[activeRowIdx]
            const sh = serverHints?.[ri]

            if (showAsDemo) {
              return (
                <tr key={ri} style={{ background: 'rgba(13,82,69,.03)' }}>
                  <td className="stu-mat-td" style={{ fontWeight: 500, fontSize: 12 }}>{r.place}</td>
                  <td className="stu-mat-td">{r.practice}</td>
                  <td className="stu-mat-td">{r.reason}</td>
                </tr>
              )
            }

            if (isPractice && !isUnlocked) {
              return (
                <tr key={ri} style={{ opacity: 0.4 }}>
                  <td className="stu-mat-td" style={{ fontWeight: 500, fontSize: 12 }}>{r.place}</td>
                  <td className="stu-mat-td" colSpan={2} style={{ color: 'var(--t3)', fontStyle: 'italic', fontSize: 11 }}>
                    Complete above first
                  </td>
                </tr>
              )
            }

            const rowResultClass = effectiveDisabled && effectiveRowResults && ri in effectiveRowResults
              ? (effectiveRowResults[ri] ? 'stu-mat-row-ok' : 'stu-mat-row-wrong')
              : undefined

            return (
              <tr key={ri} className={rowResultClass} style={isActive && !effectiveDisabled ? { background: 'rgba(58,49,133,.03)' } : undefined}>
                <td className="stu-mat-td" style={{ fontWeight: 500, fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{r.place}</span>
                    {r.paraRef && (
                      <button className="stu-locate-btn" onClick={e => { e.stopPropagation(); scrollToParas(r.paraRef!.map(n => `p${n}`)) }} title="查看原文">📖</button>
                    )}
                  </div>
                </td>
                <td className="stu-mat-td">
                  <div>
                    <input
                      className="stu-mat-in"
                      placeholder={r.whatPrompt || 'What?'}
                      value={effectiveAns[ri]?.what || ''}
                      onChange={e => onAnsChange?.(ri, 'what', e.target.value)}
                      disabled={effectiveDisabled}
                    />
                    <div style={{ marginTop: 2 }}><HelpButton hint={sh?.hint ?? r.hint} hintZh={sh?.hintZh ?? r.hintZh} /></div>
                  </div>
                </td>
                <td className="stu-mat-td">
                  <input
                    className="stu-mat-in"
                    placeholder={r.whyPrompt || 'Why?'}
                    value={effectiveAns[ri]?.why || ''}
                    onChange={e => onAnsChange?.(ri, 'why', e.target.value)}
                    disabled={effectiveDisabled}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
