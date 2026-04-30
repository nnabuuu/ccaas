import { HintBanner } from '../HelpButton'

interface Props {
  items: string[]
  ans: Record<string, any>
  setAns: (fn: (a: Record<string, any>) => Record<string, any>) => void
  done: boolean
  wrongPositions: Set<number>
  attemptCount: number
}

export function OrderExercise({ items, ans, setAns, done, wrongPositions, attemptCount }: Props) {
  const order: number[] = ans.order || []
  const rem = items.map((_, i) => i).filter(i => !order.includes(i))

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        Click to select the correct order:
        {attemptCount > 0 && !done && <span style={{ fontSize: 9, color: 'var(--amber)' }}>{attemptCount === 1 ? '1 attempt' : `${attemptCount} attempts`}</span>}
      </div>
      {done && order.map((idx, pos) => (
        <div key={`s${pos}`} className="stu-order-slot" style={{ borderColor: 'var(--green)', background: 'var(--green-bg)' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', marginRight: 6 }}>{pos + 1}.</span>{items[idx]}
        </div>
      ))}
      {!done && order.map((idx, pos) => (
        <div key={`s${pos}`} className="stu-order-slot">
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', marginRight: 6 }}>{pos + 1}.</span>
          {items[idx]}
          <span
            style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--t3)', cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); setAns(a => ({ ...a, order: (a.order || []).filter((_: number, i: number) => i !== pos) })) }}
          >✕</span>
        </div>
      ))}
      {!done && rem.map(idx => (
        <div key={`c${idx}`} className="stu-order-choice" onClick={() => setAns(a => ({ ...a, order: [...(a.order || []), idx] }))}>
          {items[idx]}
        </div>
      ))}
      {!done && wrongPositions.size > 0 && (
        <HintBanner
          hint="The order isn't quite right. Think about the reading process: what do you do FIRST when you see a new text?"
          hintZh="顺序不太对。想想阅读流程：看到新文章你第一步做什么？"
        />
      )}
    </div>
  )
}
