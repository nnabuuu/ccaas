import React, { useEffect, useState, useId, type ReactNode } from 'react'
import { extractText } from './CodeBlock'

let mermaidInitialized = false

class MermaidErrorBoundary extends React.Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[MermaidBlock] Render error:', error, info)
  }
  render() { return this.state.hasError ? this.props.fallback : this.props.children }
}

function MermaidBlockInner({ code }: { code: string }) {
  const id = useId()
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string>('')

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
      <pre className="not-prose my-3 p-4 rounded-lg border-[0.5px] border-ck-b1 bg-ck-bg3 text-sm overflow-x-auto">
        <code>{code}</code>
      </pre>
    )
  }

  return (
    <div
      className="not-prose my-3 flex justify-center p-4 rounded-lg border-[0.5px] border-ck-b1 bg-ck-bg1 overflow-x-auto"
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  )
}

export function MermaidBlock({ children }: { children: React.ReactNode }) {
  const code = extractText(children)
  const fallback = (
    <pre className="not-prose my-3 p-4 rounded-lg border-[0.5px] border-ck-b1 bg-ck-bg3 text-sm overflow-x-auto">
      <code>{code}</code>
    </pre>
  )
  return (
    <MermaidErrorBoundary fallback={fallback}>
      <MermaidBlockInner code={code} />
    </MermaidErrorBoundary>
  )
}
