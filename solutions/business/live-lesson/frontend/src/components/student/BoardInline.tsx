const BOARD_CONTENT: Record<number, any> = {
  1: {
    title: 'The Conflict', type: 'compare',
    left: { label: 'Nigeria', items: ['Gaining weight', 'Fattening rooms', 'Fat = wealth'] },
    right: { label: 'Modern Media', items: ['Slim and fair', 'Young models', 'One standard'] },
    vs: 'vs',
  },
  2: {
    title: 'Text Structure', type: 'flow',
    steps: [
      { label: 'Phenomenon', sub: '¶1-2 · Conflict' },
      { label: 'History', sub: '¶3-4 · Across Time' },
      { label: 'Culture', sub: '¶5-7 · Across Space' },
      { label: 'Conclusion', sub: '¶8 · All Beautiful' },
    ],
  },
  3: {
    title: 'Evidence Matrix', type: 'matrix',
    headers: ['Where', 'What', 'Why'],
    rows: [
      ['Ancient Egypt', 'Kohl eye paint', 'Wealth & status'],
      ['1600s Europe', 'Plump & pale', 'Beauty standard'],
      ['Borneo', 'Tattoos', 'Diary of events'],
      ['NZ Maori', 'Tā moko', 'Social position'],
      ['Myanmar', 'Metal neck rings', 'Elegance'],
      ['Indonesia', 'Sharpened teeth', 'Cultural identity'],
    ],
  },
  4: {
    title: 'Evaluate', type: 'chain',
    items: ['Position: I agree / disagree that...', 'Evidence: Based on the matrix...', 'Explanation: This shows that...'],
  },
  5: {
    title: '4 Reading Strategies', type: 'flow',
    steps: [
      { label: 'Predict', sub: 'Title → Questions' },
      { label: 'Skim', sub: 'First sentences → Structure' },
      { label: 'Scan', sub: 'Details → Matrix' },
      { label: 'Evaluate', sub: 'Evidence → Judgment' },
    ],
  },
}

interface Props {
  taskId: number
}

export default function BoardInline({ taskId }: Props) {
  const bc = BOARD_CONTENT[taskId]
  if (!bc) return null

  return (
    <div className="board-inline-wrap">
      <div className="board-inline-title">
        <span className="board-inline-dot" />
        {bc.title}
      </div>

      {bc.type === 'flow' && (
        <div className="board-flow-row">
          {bc.steps.map((s: any, i: number) => (
            <span key={i} style={{ display: 'contents' }}>
              {i > 0 && <span className="board-flow-arrow">→</span>}
              <div className="board-flow-item">
                <div className="board-flow-label">{s.label}</div>
                <div className="board-flow-sub">{s.sub}</div>
              </div>
            </span>
          ))}
        </div>
      )}

      {bc.type === 'compare' && (
        <div className="board-compare-row">
          <div className="board-compare-card board-compare-amber">
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber)', marginBottom: 4 }}>{bc.left.label}</div>
            {bc.left.items.map((x: string, i: number) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--t1)', padding: '1px 0' }}>{x}</div>
            ))}
          </div>
          <div className="board-compare-vs">{bc.vs}</div>
          <div className="board-compare-card board-compare-teal">
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--teal)', marginBottom: 4 }}>{bc.right.label}</div>
            {bc.right.items.map((x: string, i: number) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--t1)', padding: '1px 0' }}>{x}</div>
            ))}
          </div>
        </div>
      )}

      {bc.type === 'matrix' && (
        <table className="board-matrix-table">
          <thead>
            <tr>
              {bc.headers.map((h: string, i: number) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bc.rows.map((r: string[], ri: number) => (
              <tr key={ri}>
                {r.map((c: string, ci: number) => (
                  <td key={ci}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {bc.type === 'chain' && (
        <div>
          {bc.items.map((x: string, i: number) => (
            <div key={i} className="board-chain-item">{x}</div>
          ))}
        </div>
      )}
    </div>
  )
}
