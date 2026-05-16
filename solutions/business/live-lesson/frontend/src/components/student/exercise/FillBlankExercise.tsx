import { RenderMath } from '../../../utils/render-math'

interface Sentence { id: string; template: string }

export function FillBlankExercise({
  sentences, ans, setAns, blankResults, allDone,
}: {
  sentences: Sentence[]
  ans: Record<string, string>
  setAns: (updater: (prev: Record<string, string>) => Record<string, string>) => void
  blankResults?: Record<string, boolean>
  allDone: boolean
}) {
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
                const value = ans[key] || ''
                const result = blankResults?.[key]
                const borderColor = result === true ? '#22c55e' : result === false ? '#ef4444' : 'var(--border)'
                const bgColor = result === true ? '#f0fdf4' : result === false ? '#fef2f2' : 'transparent'

                return (
                  <input
                    key={i}
                    type="text"
                    value={value}
                    onChange={e => handleChange(key, e.target.value)}
                    disabled={allDone}
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
            {allDone && blankResults && (() => {
              const blanksForSentence = Object.entries(blankResults).filter(([k]) => k.startsWith(`${s.id}_`))
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
