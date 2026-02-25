import { User, Sparkle } from '@phosphor-icons/react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import type { Message, ContentBlock } from '../../types'
import { ToolCard } from './ToolCard'
import { SyncButton } from './SyncButton'

interface MessageBubbleProps {
  message: Message
  onSync?: (field: string) => void
  onDiscard?: (field: string) => void
  onUndo?: (field: string) => void
  canUndo?: (field: string) => boolean
}

export function MessageBubble({ message, onSync, onDiscard, onUndo, canUndo }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
        isUser ? 'bg-ink text-white' : 'bg-accent-light text-accent'
      }`}>
        {isUser ? <User size={14} weight="bold" /> : <Sparkle size={14} weight="fill" />}
      </div>

      {/* Content */}
      <div className={`min-w-0 max-w-[85%] ${isUser ? 'text-right' : ''}`}>
        {isUser ? (
          <div className="inline-block px-3 py-2 rounded-xl rounded-tr-sm bg-ink text-white text-sm">
            {message.content}
          </div>
        ) : (
          <div className="space-y-1">
            {/* Content blocks (text + tool cards) */}
            {message.contentBlocks && message.contentBlocks.length > 0 ? (
              message.contentBlocks.map((block, idx) => (
                <ContentBlockRenderer key={idx} block={block} />
              ))
            ) : message.content ? (
              <div className="prose prose-sm max-w-none text-ink">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : message.isStreaming ? (
              <div className="flex items-center gap-1.5 text-sm text-ink-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span>正在回复...</span>
              </div>
            ) : null}

            {/* Output update sync buttons */}
            {message.outputUpdates && message.outputUpdates.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {message.outputUpdates.map((update) => (
                  <SyncButton
                    key={update.field}
                    field={update.field}
                    preview={update.preview}
                    synced={update.synced}
                    canUndo={canUndo?.(update.field)}
                    onSync={() => onSync?.(update.field)}
                    onDiscard={() => onDiscard?.(update.field)}
                    onUndo={() => onUndo?.(update.field)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ContentBlockRenderer({ block }: { block: ContentBlock }) {
  if (block.type === 'text') {
    return (
      <div className="prose prose-sm max-w-none text-ink">
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {block.text}
        </ReactMarkdown>
      </div>
    )
  }

  if (block.type === 'tool') {
    return <ToolCard tool={block.tool} />
  }

  return null
}
