import { useMemo } from 'react'
import type { Message, ContentBlock, ColorScheme, MessageBubbleProps } from '../types'
import { COLOR_MAP } from '../types'
import { InlineToolCard } from './InlineToolCard'
import { formatDuration } from '../utils/formatDuration'
import { calculateExecutionTime } from '../utils/calculateExecutionTime'

export function MessageBubble({ message, colorScheme = 'blue', renderContent, children }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const colors = COLOR_MAP[colorScheme]
  const executionTime = useMemo(
    () => calculateExecutionTime(message.contentBlocks),
    [message.contentBlocks]
  )

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
        <div className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
          {/* Avatar */}
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              isUser ? `${colors.bg} text-white` : 'bg-gray-200 text-gray-600'
            }`}
          >
            {isUser ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            )}
          </div>

          <div className="flex-1">
            {/* Message content */}
            <div
              className={`rounded-lg px-4 py-2 ${
                isUser
                  ? `${colors.bg} text-white`
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {message.contentBlocks && message.contentBlocks.length > 0 ? (
                <div className="text-sm leading-relaxed">
                  {message.contentBlocks.map((block: ContentBlock, i: number) =>
                    block.type === 'text' ? (
                      renderContent ? (
                        <span key={i}>{renderContent(block.text, isUser)}</span>
                      ) : (
                        <span key={i} className="whitespace-pre-wrap">{block.text}</span>
                      )
                    ) : (
                      <InlineToolCard key={block.tool.toolId || i} tool={block.tool} />
                    )
                  )}
                </div>
              ) : message.content ? (
                renderContent ? (
                  <div className="text-sm leading-relaxed">{renderContent(message.content, isUser)}</div>
                ) : (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
                )
              ) : (
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
              {/* Streaming cursor */}
              {message.isStreaming && message.content && (
                <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5" />
              )}
            </div>

            {/* Extra children (sync buttons, token usage, etc.) */}
            {children}

            {/* Timestamp and metadata */}
            {message.timestamp && (
              <div className={`mt-1 text-xs text-gray-400 ${isUser ? 'text-right' : ''}`}>
                {message.timestamp.toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {/* Execution time - only show for assistant messages with tool execution */}
                {!isUser && executionTime > 0 && (
                  <span className="ml-1">
                    • 执行 {formatDuration(executionTime)}
                  </span>
                )}
                {/* Token usage - only show for assistant messages */}
                {!isUser && message.tokenUsage && (
                  <span className="ml-1">
                    • ↓ {message.tokenUsage.outputTokens.toLocaleString()} tokens
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
