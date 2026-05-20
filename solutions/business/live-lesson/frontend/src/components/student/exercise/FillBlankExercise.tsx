import { RenderMath } from '../../../utils/render-math'
import { useReviewRestore, type ReviewData } from '../../../hooks/useReviewRestore'

interface Sentence { id: string; template: string }

export function parseFillBlankReview(review: ReviewData) {
  const { data, checkItems } = review
  const ans = (data.blanks ?? {}) as Record<string, string>
  const blankResults: Record<string, boolean> = {}
  checkItems?.forEach(it => { blankResults[it.idx as string] = it.correct })
  return { state: { ans, blankResults }, allDone: true }
}

export function FillBlankExercise({
  sentences, ans, setAns, blankResults, allDone, reviewData,
}: {
  sentences: Sentence[]
  ans: Record<string, string>
  setAns: (updater: (prev: Record<string, string>) => Record<string, string>) => void
  blankResults?: Record<string, boolean>
  allDone: boolean
  reviewData?: ReviewData
}) {
  const restored = useReviewRestore(reviewData, parseFillBlankReview)
  const effectiveAns = restored?.ans ?? ans
  const effectiveBlankResults = restored?.blankResults ?? blankResults
  const effectiveAllDone = restored ? true : allDone
  const handleChange = (key: string, value: string) => {
    setAns(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {sentences.map((s) => {
        const parts = s.template.split(/(\{\{\d+\}\})/)

        return (
          <div key={s.id} style={{ fontSize: 14, lineHeight: 2.2 }}>
            {parts.map((part, i) => {
              const blankMatch = part.match(/^\{\{(\d+)\}\}$/)
              if (blankMatch) {
                const blankId = blankMatch[1]
                const key = `${s.id}_${blankId}`
                const value = effectiveAns[key] || ''
                const result = effectiveBlankResults?.[key]
                const borderColor = result === true ? '#22c55e' : result === false ? '#ef4444' : 'var(--border)'
                const bgColor = result === true ? '#f0fdf4' : result === false ? '#fef2f2' : 'transparent'

                return (
                  <input
                    key={i}
                    type="text"
                    value={value}
                    onChange={e => handleChange(key, e.target.value)}
                    disabled={effectiveAllDone}
                    placeholder="___"
                    style={{
                      display: 'inline-block',
                      width: Math.max(60, value.length * 16 + 24),
                      padding: '2px 8px',
                      margin: '0 4px',
                      border: `2px solid ${borderColor}`,
                      borderRadius: 6,
                      fontSize: 14,
                      textAlign: 'center',
                      outline: 'none',
                      background: bgColor,
                      verticalAlign: 'middle',
                    }}
                  />
                )
              }
              return <RenderMath key={i} text={part} />
            })}
            {effectiveAllDone && effectiveBlankResults && (() => {
              const blanksForSentence = Object.entries(effectiveBlankResults).filter(([k]) => k.startsWith(`${s.id}_`))
              const allCorrect = blanksForSentence.every(([, v]) => v)
              return allCorrect
                ? <span style={{ color: '#22c55e', marginLeft: 4 }}>{'\u2713'}</span>
                : <span style={{ color: '#ef4444', marginLeft: 4 }}>{'\u2717'}</span>
            })()}
          </div>
        )
      })}
    </div>
  )
}
