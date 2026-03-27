import { useState, useRef, useEffect, type ComponentPropsWithoutRef } from 'react'
import { Copy, Check } from 'lucide-react'
import { MermaidBlock } from './MermaidBlock'

type CodeProps = ComponentPropsWithoutRef<'code'>

export function CodeBlock({ children, className, ...rest }: CodeProps) {
  const match = /language-(\w+)/.exec(className || '')
  const isBlock = Boolean(match)

  if (!isBlock) {
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    )
  }

  const lang = match![1]
  if (lang === 'mermaid') {
    return <MermaidBlock>{children}</MermaidBlock>
  }

  return <CodeBlockInner language={lang}>{children}</CodeBlockInner>
}

function CodeBlockInner({ language, children }: { language: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const handleCopy = async () => {
    const text = extractText(children)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access denied in restricted contexts
    }
  }

  return (
    <div className="not-prose my-3 rounded-lg overflow-hidden border border-ck-b1 bg-ck-bg3">
      <div className="flex items-center justify-between px-4 py-2 border-b border-ck-b1 text-xs text-ck-t2">
        <span className="font-sans">{language}</span>
        <button
          onClick={handleCopy}
          aria-label={copied ? '已复制' : '复制代码'}
          className="flex items-center gap-1 text-xs text-ck-t2 hover:text-ck-t1 bg-transparent border-none cursor-pointer font-sans transition-colors ease-claude active:scale-[0.98]"
        >
          {copied ? (
            <>
              <Check size={14} /> 已复制
            </>
          ) : (
            <>
              <Copy size={14} /> 复制
            </>
          )}
        </button>
      </div>
      <pre className="m-0 p-4 overflow-x-auto text-sm leading-relaxed font-mono">
        <code>{children}</code>
      </pre>
    </div>
  )
}

export function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    return extractText((node as React.ReactElement).props.children)
  }
  return ''
}

