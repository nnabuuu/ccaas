import { useEffect, useState, useId } from 'react'
import { extractText } from './CodeBlock'

let mermaidInitialized = false

export function MermaidBlock({ children }: { children: React.ReactNode }) {
  const id = useId()
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string>('')
  const code = extractText(children)

  useEffect(() => {
    let cancelled = false
    import('mermaid').then(async (mod) => {
      const mermaid = mod.default
      if (!mermaidInitialized) {
        mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' })
        mermaidInitialized = true
      }
      try {
        const { svg: rendered } = await mermaid.render(`mermaid-${id.replace(/:/g, '')}`, code)
        if (!cancelled) setSvg(rendered)
      } catch (e) {
        if (!cancelled) setError(String(e))
      }
    })
    return () => { cancelled = true }
  }, [code, id])

  if (error) {
    return (
      <pre className="not-prose my-3 p-4 rounded-lg border border-ck-b1 bg-ck-bg3 text-sm overflow-x-auto">
        <code>{code}</code>
      </pre>
    )
  }

  return (
    <div
      className="not-prose my-3 flex justify-center p-4 rounded-lg border border-ck-b1 bg-ck-bg1 overflow-x-auto"
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  )
}
