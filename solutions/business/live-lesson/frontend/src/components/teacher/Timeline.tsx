import type { ReadingStep } from '../../types/reading'

export function Timeline({ steps }: { steps: ReadingStep[] }) {
  const markers = steps.map((_, i) => ((i + 1) / steps.length) * 100)
  return (
    <div className="timeline">
      <button className="tl-btn">◀</button>
      <div className="tl-time">00:00</div>
      <div className="tl-track-wrap">
        <div className="tl-track">
          {markers.slice(0, -1).map((pos, i) => (
            <div key={i} className="tl-marker task" style={{ left: `${pos}%` }} />
          ))}
          <div className="tl-fill" style={{ width: '0%' }} />
        </div>
        <div className="tl-thumb" style={{ left: '0%' }} />
      </div>
      <div className="tl-total">45:00</div>
      <div className="tl-label" style={{ color: 'var(--green)' }}>实时</div>
      <button className="tl-btn">▶</button>
    </div>
  )
}
