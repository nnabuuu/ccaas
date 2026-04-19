import type { CompareData } from '../../../types/reading'

export default function CompareBlock({ data }: { data: CompareData }) {
  return (
    <div className="bk bk-compare">
      {/* LEFT = claim under interrogation — muted, italic, quoted */}
      <div className={`bk-cmp-side tone-${data.left.tone || 'cool'}`}>
        <div className="bk-cmp-label">{data.left.label}</div>
        <ul className="bk-cmp-list">
          {data.left.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </div>
      <div className="bk-cmp-vs">{data.joiner || 'vs'}</div>
      {/* RIGHT = evidence — ink-black, solid, confident */}
      <div className={`bk-cmp-side tone-${data.right.tone || 'warm'}`}>
        <div className="bk-cmp-label">{data.right.label}</div>
        <ul className="bk-cmp-list">
          {data.right.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </div>
    </div>
  )
}
