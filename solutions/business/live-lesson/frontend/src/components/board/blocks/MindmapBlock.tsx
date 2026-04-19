import type { MindmapData, BlockStyle } from '../../../types/reading'

export default function MindmapBlock({ data, style }: { data: MindmapData; style?: BlockStyle }) {
  return (
    <div className={`bk bk-mindmap tone-${style?.tone || 'neutral'}`}>
      <div className="bk-mm-grid">
        <div className="bk-mm-center">
          <div className="bk-mm-c-label">{data.center.label}</div>
          {data.center.note && <div className="bk-mm-c-note">{data.center.note}</div>}
        </div>
        {data.branches.map((br, i) => (
          <div key={i} className="bk-mm-branch">
            <div className="bk-mm-b-label">{br.label}</div>
            {br.leaves && (
              <ul className="bk-mm-leaves">
                {br.leaves.map((leaf, j) => <li key={j}>{leaf}</li>)}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
