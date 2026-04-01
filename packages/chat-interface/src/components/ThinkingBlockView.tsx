import { useState } from 'react'
import type { ThinkingBlock } from '@/types/chat'

interface ThinkingBlockViewProps {
  block: ThinkingBlock
}

export function ThinkingBlockView({ block }: ThinkingBlockViewProps) {
  const [expanded, setExpanded] = useState(false)
  const hasContent = block.content.length > 0

  // Preview: first 80 chars of thinking content, single line
  const preview = block.content
    ? block.content.slice(0, 80).replace(/\n/g, ' ').trim() + (block.content.length > 80 ? '\u2026' : '')
    : ''

  return (
    <div className="py-0.5">
      {/* Inline row — no border, matches text rhythm */}
      <div
        className={`flex items-center gap-2 py-0.5 ${
          hasContent ? 'cursor-pointer' : ''
        }`}
        onClick={() => hasContent && setExpanded(!expanded)}
      >
        {/* Expand chevron */}
        {hasContent && (
          <svg
            className={`w-3 h-3 text-ck-t3 transition-transform duration-150 flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
        {!hasContent && <span className="w-3 flex-shrink-0" />}

        {/* Thinking icon — monochrome brain/thought */}
        <svg className="w-4 h-4 text-ck-t3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>

        {/* Text — same size as AI text for visual rhythm */}
        <span className="text-ck-t3 text-[14px] leading-[1.6]">
          {block.isStreaming ? '思考中\u2026' : (preview || '思考过程')}
        </span>

        {/* Spacer */}
        <span className="flex-1" />

        {/* Streaming indicator */}
        {block.isStreaming && (
          <span className="inline-block w-3.5 h-3.5 border-[1.5px] border-ck-t3 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}
      </div>

      {/* Expanded thinking content */}
      {expanded && hasContent && (
        <div className="ml-[38px] mt-1.5 rounded-lg bg-ck-bg3 px-3 py-2 max-h-[300px] overflow-y-auto">
          <pre className="whitespace-pre-wrap break-words font-mono text-[12px] text-ck-t3 leading-relaxed italic">
            {block.content}
          </pre>
        </div>
      )}
    </div>
  )
}
