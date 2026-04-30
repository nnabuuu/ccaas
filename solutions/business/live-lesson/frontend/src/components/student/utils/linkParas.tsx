/* ── ¶ reference linker ── */

export function scrollToParas(ids: string[]) {
  window.dispatchEvent(new CustomEvent('scroll-to-para', { detail: { ids } }))
}

export function linkParas(text: string): (string | JSX.Element)[] {
  const regex = /¶(\d+)(?:[–-](\d+))?/g
  const result: (string | JSX.Element)[] = []
  let lastIdx = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) result.push(text.slice(lastIdx, match.index))
    const start = parseInt(match[1])
    const end = match[2] ? parseInt(match[2]) : start
    const ids = Array.from({ length: end - start + 1 }, (_, i) => `p${start + i}`)
    result.push(
      <span key={`pl-${match.index}`} className="stu-para-link" onClick={(e) => { e.stopPropagation(); scrollToParas(ids) }}>
        {match[0]}
      </span>
    )
    lastIdx = regex.lastIndex
  }
  if (lastIdx < text.length) result.push(text.slice(lastIdx))
  return result.length > 0 ? result : [text]
}
