import type { ChipRowData, BlockStyle } from '../../../types/reading'

export default function ChipRowBlock({ data, style }: { data: ChipRowData; style?: BlockStyle }) {
  const baseTone = style?.tone || 'neutral'
  return (
    <div className={`bk bk-chiprow tone-${baseTone}`}>
      {data.items.map((item, i) => (
        <div key={i} className={`bk-chip tone-${item.tone || baseTone}`}>
          <span className="bk-chip-text">{item.text}</span>
          {item.note && <span className="bk-chip-note">{item.note}</span>}
        </div>
      ))}
    </div>
  )
}
