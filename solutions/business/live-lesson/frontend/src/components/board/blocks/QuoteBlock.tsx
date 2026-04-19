import type { QuoteData, BlockStyle } from '../../../types/reading'

function renderWithHighlights(text: string, highlights?: string[]) {
  if (!highlights?.length) return <>{text}</>
  const parts: (string | JSX.Element)[] = [text]
  for (const term of highlights) {
    const next: (string | JSX.Element)[] = []
    for (const part of parts) {
      if (typeof part !== 'string') { next.push(part); continue }
      let remaining = part
      let idx = remaining.indexOf(term)
      while (idx !== -1) {
        if (idx > 0) next.push(remaining.slice(0, idx))
        next.push(<span key={`${term}-${idx}`} className="sig">{term}</span>)
        remaining = remaining.slice(idx + term.length)
        idx = remaining.indexOf(term)
      }
      if (remaining) next.push(remaining)
    }
    parts.length = 0
    parts.push(...next)
  }
  return <>{parts}</>
}

export default function QuoteBlock({ data, style }: { data: QuoteData; style?: BlockStyle }) {
  return (
    <div className={`bk bk-quote tone-${style?.tone || 'neutral'}`}>
      {data.paragraph && <div className="bk-q-para">{data.paragraph}</div>}
      <div className="bk-q-text">{renderWithHighlights(data.text, data.highlights)}</div>
    </div>
  )
}
