import { useState, useRef, useEffect } from 'react'
import { Copy, Check, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import type { ContentBlock } from '@/types/chat'
import { formatRelativeTime } from '@/utils/relative-time'
import { Tooltip } from './Tooltip'

interface ActionToolbarProps {
  timestamp: string
  content: ContentBlock[]
  onRetry?: () => void
}

function extractPlainText(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is { type: 'text'; content: string } => b.type === 'text')
    .map((b) => b.content)
    .join('\n')
}

export function ActionToolbar({ timestamp, content, onRetry }: ActionToolbarProps) {
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
      <Tooltip content={copied ? '已复制' : '复制'}>
        <button
          onClick={handleCopy}
          aria-label={copied ? '已复制' : '复制'}
          className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 w-8 h-8 flex items-center justify-center rounded text-ck-t3 hover:text-ck-t1 hover:bg-ck-bg3 transition-colors focus-visible:text-ck-t1 focus-visible:bg-ck-bg3 focus-visible:ring-2 focus-visible:ring-ck-accent"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </Tooltip>
      {onRetry && (
        <Tooltip content="重试">
          <button
            onClick={onRetry}
            aria-label="重试"
            className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 w-8 h-8 flex items-center justify-center rounded text-ck-t3 hover:text-ck-t1 hover:bg-ck-bg3 transition-colors focus-visible:text-ck-t1 focus-visible:bg-ck-bg3 focus-visible:ring-2 focus-visible:ring-ck-accent"
          >
            <RotateCcw size={16} />
          </button>
        </Tooltip>
      )}
    </div>
  )
}
