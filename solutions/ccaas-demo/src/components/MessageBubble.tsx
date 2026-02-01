/**
 * Message Bubble Component
 *
 * Displays a chat message with optional file attachment.
 */

import type { Message, FileInfo, ContentBlock } from '../types'
import { FileCard } from './FileCard'
import { ToolActivityItem } from './ToolActivityItem'

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

interface MessageBubbleProps {
  message: Message
  onDownload: (file: FileInfo) => void
}

export function MessageBubble({ message, onDownload }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[80%] ${
          isUser
            ? 'bg-blue-500 text-white rounded-2xl rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md'
        } px-4 py-3`}
      >
        {!isUser && message.skill && (
          <div className="flex items-center gap-2 mb-2 text-sm text-blue-600 font-medium">
            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            Using: {message.skill === 'hello-world' ? 'Hello World' :
                    message.skill === 'report' ? 'Report Generator' :
                    message.skill === 'document' ? 'Document Writer' :
                    message.skill === 'analysis' ? 'Data Analyzer' : message.skill}
          </div>
        )}

        {/* Render content blocks inline if available */}
        {message.contentBlocks && message.contentBlocks.length > 0 ? (
          <div>
            {message.contentBlocks.map((block: ContentBlock, i: number) =>
              block.type === 'text' ? (
                <span key={i} className="whitespace-pre-wrap">{block.text}</span>
              ) : (
                <ToolActivityItem key={block.tool.toolId || i} tool={block.tool} inline />
              )
            )}
            {message.status === 'streaming' && (
              <span className="inline-block w-2 h-4 bg-current animate-blink ml-1">|</span>
            )}
          </div>
        ) : (
          <div className="whitespace-pre-wrap">
            {message.content}
            {message.status === 'streaming' && (
              <span className="inline-block w-2 h-4 bg-current animate-blink ml-1">|</span>
            )}
          </div>
        )}

        {message.files?.map((file, index) => (
          <FileCard key={file.id || index} file={file} onDownload={onDownload} />
        ))}

        {!isUser && message.tokenUsage && message.status === 'complete' && (
          <div className="mt-2 pt-1.5 border-t border-gray-200/60 flex items-center gap-3 text-[11px] text-gray-400">
            <span>{message.tokenUsage.model.replace('claude-', '').replace(/-\d+$/, '')}</span>
            <span>{'\u2193'}{formatTokens(message.tokenUsage.inputTokens)} {'\u2191'}{formatTokens(message.tokenUsage.outputTokens)}</span>
            {message.tokenUsage.cachedInputTokens > 0 && (
              <span>{'\u26A1'}{formatTokens(message.tokenUsage.cachedInputTokens)} cached</span>
            )}
            <span>${message.tokenUsage.estimatedCostUsd.toFixed(4)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
