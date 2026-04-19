import type { AnnotationData, BlockStyle } from '../../../types/reading'

const ICONS: Record<string, string> = { note: '\u270E', warning: '\u26A0', aha: '\uD83D\uDCA1' }

export default function AnnotationBlock({ data, style }: { data: AnnotationData; style?: BlockStyle }) {
  const kind = data.kind || 'note'
  return (
    <div className={`bk bk-anno anno-${kind} tone-${style?.tone || 'neutral'}`}>
      <span className="bk-anno-ic">{ICONS[kind] || '\u270E'}</span>
      <span className="bk-anno-text">{data.text}</span>
    </div>
  )
}
