import { Fragment } from 'react'
import katex from 'katex'
import { linkParas } from './utils/linkParas'

/* ═══ MARKDOWN-LITE RENDERER ═══ */
export function renderMd(text: string, opts?: { math?: boolean }) {
  if (!text) return null
  const lines = text.split('\n')
  return lines.map((line, i) => {
    let parts: (string | JSX.Element)[] = [line]
    // inline math $...$  (before bold/italic so * inside math isn't consumed)
    if (opts?.math) {
      parts = parts.flatMap((p, pi) => {
        if (typeof p !== 'string') return [p]
        const segs: (string | JSX.Element)[] = []
        const re = /\$([^$]+)\$/g
        let last = 0
        let m: RegExpExecArray | null
        while ((m = re.exec(p)) !== null) {
          if (m.index > last) segs.push(p.slice(last, m.index))
          try {
            const html = katex.renderToString(m[1], { throwOnError: false })
            segs.push(<span key={`m${pi}${m.index}`} dangerouslySetInnerHTML={{ __html: html }} />)
          } catch {
            segs.push(m[0])
          }
          last = m.index + m[0].length
        }
        if (last < p.length) segs.push(p.slice(last))
        return segs.length ? segs : [p]
      })
    }
    // bold **...**
    parts = parts.flatMap((p, pi) => {
      if (typeof p !== 'string') return [p]
      const segs: (string | JSX.Element)[] = []
      let rest = p
      while (rest.includes('**')) {
        const a = rest.indexOf('**')
        const b = rest.indexOf('**', a + 2)
        if (b === -1) { segs.push(rest); rest = ''; break }
        if (a > 0) segs.push(rest.slice(0, a))
        segs.push(<strong key={`b${pi}${a}`}>{rest.slice(a + 2, b)}</strong>)
        rest = rest.slice(b + 2)
      }
      if (rest) segs.push(rest)
      return segs
    })
    // italic *...*
    parts = parts.flatMap((p, pi) => {
      if (typeof p !== 'string') return [p]
      const segs: (string | JSX.Element)[] = []
      let rest = p
      while (rest.includes('*')) {
        const a = rest.indexOf('*')
        const b = rest.indexOf('*', a + 1)
        if (b === -1) { segs.push(rest); rest = ''; break }
        if (a > 0) segs.push(rest.slice(0, a))
        segs.push(<em key={`i${pi}${a}`}>{rest.slice(a + 1, b)}</em>)
        rest = rest.slice(b + 1)
      }
      if (rest) segs.push(rest)
      return segs
    })
    // para links ¶N, ¶N-M
    parts = parts.flatMap((p) => {
      if (typeof p !== 'string') return [p]
      return linkParas(p)
    })
    // bullet
    if (line.startsWith('• ')) {
      return <div key={i} style={{ paddingLeft: 12, position: 'relative', lineHeight: 1.7 }}>• {parts.map((p) => typeof p === 'string' ? p.replace('• ', '') : p)}</div>
    }
    return <Fragment key={i}>{i > 0 && <br />}{parts}</Fragment>
  })
}
