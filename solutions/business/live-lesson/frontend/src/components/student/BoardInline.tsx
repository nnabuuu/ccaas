import type { BoardData, CompareData, FlowData, MatrixData, MindmapData, ChipRowData, HeadingData } from '../../types/reading'

const MAIN_KINDS = ['compare', 'flow', 'matrix', 'mindmap', 'chip-row'] as const

interface Props {
  taskId: number
  boardData?: BoardData | null
}

export default function BoardInline({ taskId, boardData }: Props) {
  if (!boardData?.blocks) return null

  const stepBlocks = boardData.blocks.filter(b => b.reveal.step === taskId)
  const main = stepBlocks.find(b => (MAIN_KINDS as readonly string[]).includes(b.kind))
  if (!main) return null

  const heading = stepBlocks.find(b => b.kind === 'heading')
  const title = heading ? (heading.data as HeadingData).text : null

  return (
    <div className="board-inline-wrap">
      {title && (
        <div className="board-inline-title">
          <span className="board-inline-dot" />
          {title}
        </div>
      )}

      {main.kind === 'compare' && (() => {
        const d = main.data as CompareData
        return (
          <div className="board-compare-row">
            <div className="board-compare-card board-compare-amber">
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--amber)', marginBottom: 4 }}>{d.left.label}</div>
              {d.left.items.map((x, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--t1)', padding: '1px 0' }}>{x}</div>
              ))}
            </div>
            <div className="board-compare-vs">{d.joiner || 'vs'}</div>
            <div className="board-compare-card board-compare-teal">
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--teal)', marginBottom: 4 }}>{d.right.label}</div>
              {d.right.items.map((x, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--t1)', padding: '1px 0' }}>{x}</div>
              ))}
            </div>
          </div>
        )
      })()}

      {main.kind === 'flow' && (() => {
        const d = main.data as FlowData
        return (
          <div className="board-flow-row">
            {d.steps.map((s, i) => (
              <span key={i} style={{ display: 'contents' }}>
                {i > 0 && <span className="board-flow-arrow">{d.arrow || '→'}</span>}
                <div className="board-flow-item">
                  <div className="board-flow-label">{s.label}</div>
                  {s.sub && <div className="board-flow-sub">{s.sub}</div>}
                </div>
              </span>
            ))}
          </div>
        )
      })()}

      {main.kind === 'matrix' && (() => {
        const d = main.data as MatrixData
        return (
          <table className="board-matrix-table">
            <thead>
              <tr>
                {d.headers.map((h, i) => <th key={i}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.cells.map((c, ci) => <td key={ci}>{c.text || ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )
      })()}

      {main.kind === 'mindmap' && (() => {
        const d = main.data as MindmapData
        return (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 6, textAlign: 'center' }}>
              {d.center.label}
              {d.center.note && <span style={{ fontWeight: 400, color: 'var(--t3)', marginLeft: 6, fontSize: 11 }}>{d.center.note}</span>}
            </div>
            {d.branches.map((b, i) => (
              <div key={i} className="board-chain-item">
                <strong>{b.label}</strong>
                {b.leaves?.length ? `: ${b.leaves.join(', ')}` : ''}
              </div>
            ))}
          </div>
        )
      })()}

      {main.kind === 'chip-row' && (() => {
        const d = main.data as ChipRowData
        return (
          <div className="board-flow-row" style={{ flexWrap: 'wrap' }}>
            {d.items.map((item, i) => (
              <div key={i} className="board-flow-item">
                <div className="board-flow-label">{item.text}</div>
                {item.note && <div className="board-flow-sub">{item.note}</div>}
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}
