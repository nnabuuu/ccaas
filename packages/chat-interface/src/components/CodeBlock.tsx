import { useState, type ComponentPropsWithoutRef } from 'react'

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

  return <CodeBlockInner language={match![1]}>{children}</CodeBlockInner>
}

function CodeBlockInner({ language, children }: { language: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const text = extractText(children)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
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
          className="flex items-center gap-1 text-xs text-ck-t2 hover:text-ck-t1 bg-transparent border-none cursor-pointer font-sans transition-colors ease-claude active:scale-[0.98]"
        >
          {copied ? (
            <>
              <CheckIcon /> 已复制
            </>
          ) : (
            <>
              <CopyIcon /> 复制
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

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    return extractText((node as React.ReactElement).props.children)
  }
  return ''
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
