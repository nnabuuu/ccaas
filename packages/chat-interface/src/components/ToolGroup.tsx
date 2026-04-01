import { useState, useEffect } from 'react'
import type { ToolUseBlock, ThinkingBlock } from '@/types/chat'
import { ToolActivityBlock } from './ToolActivityBlock'
import { ThinkingBlockView } from './ThinkingBlockView'

export interface ToolGroupData {
  type: 'tool_group'
  blocks: (ToolUseBlock | ThinkingBlock)[]
}

interface ToolGroupProps {
  group: ToolGroupData
}

export function ToolGroup({ group }: ToolGroupProps) {
  const toolBlocks = group.blocks.filter((b): b is ToolUseBlock => b.type === 'tool_use')
  const thinkingBlocks = group.blocks.filter((b): b is ThinkingBlock => b.type === 'thinking')

  // Auto-expand if any tool is still running or thinking is streaming
  const hasRunning = toolBlocks.some(b => b.phase === 'start' || b.phase === 'progress')
  const hasStreamingThinking = thinkingBlocks.some(b => b.isStreaming)
  const shouldAutoExpand = hasRunning || hasStreamingThinking

  // Default: expanded only if running; collapsed when all complete
  const allComplete = toolBlocks.length > 0 && toolBlocks.every(b => b.phase === 'end')
  const [expanded, setExpanded] = useState(shouldAutoExpand && !allComplete)

  // Auto-expand when a tool starts running; auto-collapse when all finish
  useEffect(() => {
    if (shouldAutoExpand) setExpanded(true)
    else if (allComplete) setExpanded(false)
  }, [shouldAutoExpand, allComplete])

  // For small groups (1-2 blocks), render inline without group wrapper
  if (group.blocks.length <= 2) {
    return (
      <>
        {group.blocks.map((block, i) =>
          block.type === 'tool_use'
            ? <ToolActivityBlock key={block.toolId || i} block={block} />
            : <ThinkingBlockView key={`thinking-${i}`} block={block} />,
        )}
      </>
    )
  }

  // Build summary: use thinking preview or tool count
  const thinkingPreview = thinkingBlocks.length > 0
    ? thinkingBlocks[0].content.slice(0, 60).replace(/\n/g, ' ').trim()
    : ''
  const toolCount = toolBlocks.length

  const summaryText = thinkingPreview
    ? (thinkingPreview + (thinkingBlocks[0].content.length > 60 ? '\u2026' : ''))
    : (toolCount > 0
      ? `\u4F7F\u7528\u4E86 ${toolCount} \u4E2A\u5DE5\u5177`
      : '\u601D\u8003\u8FC7\u7A0B')

  return (
    <div className="py-0.5">
      {/* Group summary header — inline, no border */}
      <div
        className="flex items-center gap-2 py-0.5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Chevron */}
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

        {/* Status icon */}
        {shouldAutoExpand ? (
          <span className="inline-block w-4 h-4 border-[1.5px] border-ck-t3 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        ) : (
          <svg className="w-4 h-4 text-ck-success-t flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}

        {/* Summary text — same size as AI text for visual rhythm */}
        <span className={`text-[14px] leading-[1.6] ${thinkingPreview ? 'text-ck-t3' : 'text-ck-t2'}`}>
          {summaryText}
        </span>
      </div>

      {/* Expanded: render each block inline */}
      {expanded && (
        <div className="ml-5">
          {group.blocks.map((block, i) =>
            block.type === 'tool_use'
              ? <ToolActivityBlock key={block.toolId || i} block={block} />
              : <ThinkingBlockView key={`thinking-${i}`} block={block} />,
          )}
        </div>
      )}
    </div>
  )
}
