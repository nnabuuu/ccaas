import type { ChatMessage, ContentBlock, NextAction } from '@/types/chat'
import { useChatInterfaceContext } from '@/context/ChatInterfaceContext'
import { WidgetRenderer } from './WidgetRenderer'
import { SkillBadge } from './SkillBadge'
import { FileCard } from './FileCard'
import { NextActions } from './NextActions'
import { ActionToolbar } from './ActionToolbar'
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

export function MessageRenderer({ message, widgetState, onWidgetStateChange, onAction, onWidgetSubmit, onRetry }: MessageRendererProps) {
  const isUser = message.role === 'user'

  return isUser ? (
    // User message: right-aligned, inline-flex bubble (Claude Web: mb-1 mt-6, bg-bg-300, !px-4)
    <div className="mt-6 mb-1 flex flex-col items-end gap-1">
      <div className="inline-flex max-w-[min(75ch,85%)] bg-ck-bg3 text-ck-t1 py-2.5 px-3.5 rounded-[16px_16px_4px_16px] text-sm leading-[1.5]">
        {message.content.map((block, i) => (
          <ContentBlockView key={i} block={block} />
        ))}
      </div>
    </div>
  ) : (
    // Assistant message: no bubble, serif font, generous bottom margin
    <div className="pb-3 pl-2 pr-4 md:pr-8 group">
      {message.activeSkill && (
        <SkillBadge name={message.activeSkill} />
      )}

      <div className="font-serif text-base text-ck-t1 leading-[1.65rem]">
        {message.content.map((block, i) => (
          <ContentBlockView
            key={i}
            block={block}
            widgetState={widgetState}
            onWidgetStateChange={onWidgetStateChange}
            onWidgetSubmit={onWidgetSubmit}
          />
        ))}

        {message.isStreaming && (
          <span className="animate-ck-blink inline-block ml-0.5 text-ck-t2" aria-hidden="true">&#9612;</span>
        )}

        {/* Next actions */}
        {message.nextActions && message.nextActions.length > 0 && onAction && (
          <NextActions actions={message.nextActions} onAction={onAction} />
        )}
      </div>

      {/* Action toolbar: visible on mobile, hover-only on desktop, hidden during streaming */}
      {!message.isStreaming && (
        <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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
        <div className="prose max-w-none ck-prose">
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

    default: {
      const customBlock = block as import('@/types/chat').CustomBlock
      const renderer = blockRenderers[customBlock.type]
      if (renderer) return <>{renderer(customBlock)}</>
      return null
    }
  }
}
