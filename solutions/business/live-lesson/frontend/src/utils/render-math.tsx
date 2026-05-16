import katex from 'katex'
import 'katex/dist/katex.min.css'

export function RenderMath({ text }: { text: string }) {
  const parts: Array<{ type: 'text' | 'inline' | 'display'; content: string }> = []

  const regex = /\$\$([\s\S]*?)\$\$|\$((?!\$)[^\$]*?)\$/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    if (match[1] !== undefined) {
      parts.push({ type: 'display', content: match[1] })
    } else if (match[2] !== undefined) {
      parts.push({ type: 'inline', content: match[2] })
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return <span key={i}>{part.content.split('\n').map((line, j, arr) => (
            <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
          ))}</span>
        }
        try {
          const html = katex.renderToString(part.content, {
            displayMode: part.type === 'display',
            throwOnError: false,
          })
          return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
        } catch {
          return <span key={i} style={{ color: 'red' }}>{part.content}</span>
        }
      })}
    </>
  )
}
