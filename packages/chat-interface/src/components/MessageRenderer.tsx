import type { ChatMessage, ContentBlock, NextAction } from '@/types/chat'
import { useChatInterfaceContext } from '@/context/ChatInterfaceContext'
import { WidgetRenderer } from './WidgetRenderer'
import { SkillBadge } from './SkillBadge'
import { FileCard } from './FileCard'
import { NextActions } from './NextActions'
import ReactMarkdown from 'react-markdown'

interface MessageRendererProps {
  message: ChatMessage
  widgetState: Record<string, unknown>
  onWidgetStateChange: (key: string, value: unknown) => void
  onAction?: (action: NextAction) => void
  onWidgetSubmit?: (params: Record<string, unknown>) => void
}

export function MessageRenderer({ message, widgetState, onWidgetStateChange, onAction, onWidgetSubmit }: MessageRendererProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`max-w-[88%] leading-relaxed ${isUser ? 'self-end' : 'self-start'}`}>
      {/* Skill badge for assistant messages */}
      {!isUser && message.activeSkill && (
        <SkillBadge name={message.activeSkill} />
      )}

      {isUser ? (
        <div className="bg-ck-t1 text-ck-bg1 px-[14px] py-[10px] rounded-[16px_16px_4px_16px] text-sm">
          {message.content.map((block, i) => (
            <ContentBlockView key={i} block={block} />
          ))}
        </div>
      ) : (
        <div className="py-[2px] text-sm text-ck-t1">
          {message.content.map((block, i) => (
            <ContentBlockView
              key={i}
              block={block}
              widgetState={widgetState}
              onWidgetStateChange={onWidgetStateChange}
              onWidgetSubmit={onWidgetSubmit}
            />
          ))}

          {/* Next actions */}
          {message.nextActions && message.nextActions.length > 0 && onAction && (
            <NextActions actions={message.nextActions} onAction={onAction} />
          )}
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
        <div className="prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_code]:text-xs [&_code]:bg-ck-bg2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-ck-bg2 [&_pre]:p-3 [&_pre]:rounded-ck [&_pre]:text-xs [&_pre]:overflow-x-auto [&_a]:text-ck-info-t [&_a]:no-underline [&_a:hover]:underline">
          <ReactMarkdown>{block.content}</ReactMarkdown>
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
        <details className="text-xs text-ck-t3 my-1">
          <summary className="cursor-pointer hover:text-ck-t2">
            MCP: {block.toolName}
          </summary>
          <pre className="bg-ck-bg2 p-2 rounded-ck mt-1 overflow-x-auto">
            {JSON.stringify(block.result, null, 2)}
          </pre>
        </details>
      )

    default: {
      const customBlock = block as import('@/types/chat').CustomBlock
      const renderer = blockRenderers[customBlock.type]
      if (renderer) return <>{renderer(customBlock)}</>
      return null
    }
  }
}
