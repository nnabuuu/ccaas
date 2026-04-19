import type { HeadingData, BlockStyle } from '../../../types/reading'

export default function HeadingBlock({ data, style }: { data: HeadingData; style?: BlockStyle }) {
  return (
    <div className={`bk bk-heading tone-${style?.tone || 'neutral'}`}>
      {data.eyebrow && <div className="bk-eyebrow">{data.eyebrow}</div>}
      <div className="bk-h-text">{data.text}</div>
      {data.accent && <div className="bk-h-accent">{data.accent}</div>}
    </div>
  )
}
