import { useMemo } from 'react'
import type { BoardData, RevealPointer, BoardBlock as BlockType } from '../../types/reading'
import BoardBlock from './BoardBlock'
import ColumnHeader from './ColumnHeader'

function revealKey(r: RevealPointer) { return r.step * 1000 + r.sub }
function atOrBefore(reveal: RevealPointer, pointer: RevealPointer) {
  return revealKey(reveal) <= revealKey(pointer)
}

interface Props {
  board: BoardData
  pointer: RevealPointer
  justRevealedId?: string
}

export default function BoardStage({ board, pointer, justRevealedId }: Props) {
  const byStep = useMemo(() => {
    const map: Record<number, BlockType[]> = {}
    for (const b of board.blocks) {
      (map[b.reveal.step] ??= []).push(b)
    }
    for (const key of Object.keys(map)) {
      map[Number(key)].sort((a, b) => a.reveal.sub - b.reveal.sub)
    }
    return map
  }, [board.blocks])

  return (
    <div className="board-root">
      {board.steps.map(step => {
        const stepBlocks = byStep[step.idx] || []
        const visible = stepBlocks.filter(b => atOrBefore(b.reveal, pointer))
        if (!visible.length) return null

        const isCurrent = step.idx === pointer.step
        const cols = step.layout?.columns

        const fullBleed = visible.filter(b => b.fullBleed)
        const regional = visible.filter(b => !b.fullBleed)

        return (
          <div
            key={step.id}
            className={`step-section${isCurrent ? ' current' : ''}`}
            data-step={step.idx}
          >
            <div className="step-banner">
              <span className="step-banner-num">Step {step.idx}</span>
              <span className="step-banner-label">{step.label}</span>
              <span className="step-banner-sep" />
            </div>

            {fullBleed.length > 0 && (
              <div className="fullbleed-row">
                {fullBleed.map(b => (
                  <BoardBlock key={b.id} block={b} justRevealed={b.id === justRevealedId} />
                ))}
              </div>
            )}

            {cols ? (
              <div
                className={`columns cols-${cols.length}`}
                style={{
                  gridTemplateColumns: cols.map(c => `${c.width || 1}fr`).join(' '),
                }}
              >
                {cols.map((col, ci) => {
                  const colBlocks = regional.filter(b => (b.region || cols[0].id) === col.id)
                  return (
                    <div key={col.id} className={`column tone-${col.tone || 'neutral'}`}>
                      <ColumnHeader column={col} />
                      <div className="col-body">
                        {colBlocks.length === 0 ? (
                          <div className="col-empty">{'\uFF08\u6B64\u680F\u5F85\u5199\u2026\uFF09'}</div>
                        ) : (
                          colBlocks.map(b => (
                            <BoardBlock key={b.id} block={b} justRevealed={b.id === justRevealedId} />
                          ))
                        )}
                      </div>
                      {ci < cols.length - 1 && <div className="column-divider" />}
                    </div>
                  )
                })}
              </div>
            ) : regional.length > 0 ? (
              <div className="board-grid">
                {regional.map(b => (
                  <BoardBlock key={b.id} block={b} justRevealed={b.id === justRevealedId} />
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
