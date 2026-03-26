import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import type { ContentBlock } from '@/types/chat'
import { formatRelativeTime } from '@/utils/relative-time'

interface ActionToolbarProps {
  timestamp: string
  content: ContentBlock[]
}

function extractPlainText(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is { type: 'text'; content: string } => b.type === 'text')
    .map((b) => b.content)
    .join('\n')
}

export function ActionToolbar({ timestamp, content }: ActionToolbarProps) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])

  const handleCopy = async () => {
    const text = extractPlainText(content)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('已复制到剪贴板')
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败')
    }
  }

  const relativeTime = formatRelativeTime(timestamp)

  return (
    <div className="flex items-center gap-1 mt-1">
      {relativeTime && (
        <span className="text-xs text-ck-t3 font-sans mr-1">{relativeTime}</span>
      )}
      <button
        onClick={handleCopy}
        className="w-8 h-8 flex items-center justify-center rounded-[4px] text-ck-t3 hover:text-ck-t1 hover:bg-ck-bg3 transition-colors"
        title={copied ? '已复制' : '复制'}
      >
        {copied ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  )
}
