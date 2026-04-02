import { useMemo } from 'react'
import type { ChatMessage, ContentBlock, NextAction, ToolUseBlock, ThinkingBlock } from '@/types/chat'
import { useChatInterfaceContext } from '@/context/ChatInterfaceContext'
import { WidgetRenderer } from './WidgetRenderer'
import { SkillBadge } from './SkillBadge'
import { FileCard } from './FileCard'
import { NextActions } from './NextActions'
import { ActionToolbar } from './ActionToolbar'
import { ToolActivityBlock } from './ToolActivityBlock'
import { ThinkingBlockView } from './ThinkingBlockView'
import { ToolGroup, type ToolGroupData } from './ToolGroup'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import { CodeBlock } from './CodeBlock'
import type { PluggableList } from 'unified'

const REMARK_PLUGINS = [remarkGfm, remarkMath]
const REHYPE_PLUGINS: PluggableList = [[rehypeHighlight, { detect: false }], rehypeKatex]
const MD_COMPONENTS = { code: CodeBlock }

interface MessageRendererProps {
  message: ChatMessage
  widgetState: Record<string, unknown>
  onWidgetStateChange: (key: string, value: unknown) => void
  onAction?: (action: NextAction) => void
  onWidgetSubmit?: (params: Record<string, unknown>) => void
  onRetry?: () => void
}

/** Group adjacent tool_use/thinking blocks into ToolGroupData for collapsed rendering */
function groupBlocks(blocks: ContentBlock[]): (ContentBlock | ToolGroupData)[] {
  const result: (ContentBlock | ToolGroupData)[] = []
  let currentGroup: (ToolUseBlock | ThinkingBlock)[] = []

  const flushGroup = () => {
    if (currentGroup.length > 0) {
      result.push({ type: 'tool_group', blocks: [...currentGroup] })
      currentGroup = []
    }
  }

  for (const block of blocks) {
    if (block.type === 'tool_use' || block.type === 'thinking') {
      currentGroup.push(block)
    } else {
      flushGroup()
      result.push(block)
    }
  }
  flushGroup()

  return result
}

export function MessageRenderer({ message, widgetState, onWidgetStateChange, onAction, onWidgetSubmit, onRetry }: MessageRendererProps) {
  const isUser = message.role === 'user'

  // Group adjacent tool/thinking blocks for assistant messages
  const groupedBlocks = useMemo(() => {
    if (isUser) return null
    return groupBlocks(message.content)
  }, [message.content, isUser])

  return isUser ? (
    // User message: right-aligned, inline-flex bubble
    <div data-ck="user-msg" className="mt-3 mb-2 flex flex-col items-end gap-1">
      <div className="inline-flex max-w-[88%] bg-ck-user-bubble text-ck-t1 py-2.5 px-3.5 rounded-[18px_18px_4px_18px] text-[14px] leading-[1.5]">
        {message.content.map((block, i) => (
          <ContentBlockView key={i} block={block} />
        ))}
      </div>
    </div>
  ) : (
    // Assistant message: no bubble, plain text
    <div data-ck="ai-msg" className="pb-2 group">
      {message.activeSkill && (
        <SkillBadge name={message.activeSkill} />
      )}

      <div className="text-[14px] text-ck-t1 leading-[1.5]">
        {groupedBlocks!.map((item, i) => {
          if ('type' in item && item.type === 'tool_group') {
            return <ToolGroup key={`tg-${i}`} group={item as ToolGroupData} />
          }
          const block = item as ContentBlock
          return (
            <ContentBlockView
              key={i}
              block={block}
              widgetState={widgetState}
              onWidgetStateChange={onWidgetStateChange}
              onWidgetSubmit={onWidgetSubmit}
            />
          )
        })}

        {message.isStreaming && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-ck-t3 py-2" aria-label="思考中">
            <span className="flex gap-[3px]">
              <span className="w-[5px] h-[5px] rounded-full bg-ck-t3 animate-ck-dot1" />
              <span className="w-[5px] h-[5px] rounded-full bg-ck-t3 animate-ck-dot2" />
              <span className="w-[5px] h-[5px] rounded-full bg-ck-t3 animate-ck-dot3" />
            </span>
            正在处理...
          </span>
        )}

        {/* Next actions */}
        {message.nextActions && message.nextActions.length > 0 && onAction && (
          <NextActions actions={message.nextActions} onAction={onAction} />
        )}
      </div>

      {/* Action toolbar: visible on mobile, hover-only on desktop, hidden during streaming */}
      {!message.isStreaming && (
        <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150 ease-claude">
          <ActionToolbar timestamp={message.timestamp} content={message.content} onRetry={onRetry} />
        </div>
      )}
    </div>
  )
}

interface ContentBlockViewProps {
  block: ContentBlock
  widgetState?: Record<string, unknown>
  onWidgetStateChange?: (key: string, value: unknown) => void
  onWidgetSubmit?: (params: Record<string, unknown>) => void
}

function ContentBlockView({ block, widgetState, onWidgetStateChange, onWidgetSubmit }: ContentBlockViewProps) {
  const { blockRenderers } = useChatInterfaceContext()

  switch (block.type) {
    case 'text':
      return (
        <div className="prose max-w-[680px] ck-prose">
          <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={MD_COMPONENTS}>{block.content}</ReactMarkdown>
        </div>
      )

    case 'widget':
      return (
        <WidgetRenderer
          spec={block.spec}
          widgetState={widgetState ?? {}}
          onStateChange={onWidgetStateChange}
          onSubmit={onWidgetSubmit}
        />
      )

    case 'file':
      return <FileCard file={block} />

    case 'mcp_result':
      if (!block.visible) return null
      return (
        <details className="text-xs text-ck-t2 my-1">
          <summary className="cursor-pointer hover:text-ck-t1">
            MCP: {block.toolName}
          </summary>
          <pre className="bg-ck-bg3 p-2 rounded-ck mt-1 overflow-x-auto">
            {JSON.stringify(block.result, null, 2)}
          </pre>
        </details>
      )

    case 'tool_use':
      return <ToolActivityBlock block={block} />

    case 'thinking':
      return <ThinkingBlockView block={block} />

    default: {
      const customBlock = block as import('@/types/chat').CustomBlock
      const renderer = blockRenderers[customBlock.type]
      if (renderer) return <>{renderer(customBlock)}</>
      return null
    }
  }
}
