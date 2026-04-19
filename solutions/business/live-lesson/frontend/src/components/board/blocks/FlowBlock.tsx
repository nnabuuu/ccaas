import type { FlowData, BlockStyle } from '../../../types/reading'

export default function FlowBlock({ data, style }: { data: FlowData; style?: BlockStyle }) {
  const tone = style?.tone || 'neutral'
  return (
    <div className="bk bk-flow">
      {data.steps.map((step, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <div className={`bk-flow-card tone-${tone}`}>
            {step.paragraph && <div className="bk-flow-para">{step.paragraph}</div>}
            <div className="bk-flow-label">{step.label}</div>
            {step.sub && <div className="bk-flow-sub">{step.sub}</div>}
          </div>
          {i < data.steps.length - 1 && <div className="bk-flow-arrow">{'\u2192'}</div>}
        </div>
      ))}
    </div>
  )
}
