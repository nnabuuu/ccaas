import { useState } from 'react'
import type { Message, SyncField, ContentBlock, ToolActivity } from '../types'
import SyncButton from './SyncButton'

interface MessageBubbleProps {
  message: Message
  onSync?: (field: SyncField) => void
  onDiscard?: (field: SyncField) => void
}

const TOOL_ICONS: Record<string, string> = {
  Read: '📖',
  Write: '✍️',
  Edit: '✏️',
  Bash: '💻',
  Glob: '🔍',
  Grep: '🔎',
  Task: '📋',
  WebFetch: '🌐',
  WebSearch: '🔍',
  write_output: '📤',
}

function getToolSummary(tool: ToolActivity): string {
  if (tool.description) return tool.description
  const input = tool.toolInput as Record<string, unknown> | undefined
  if (!input) return ''
  const name = tool.toolName.replace(/^mcp__[^_]+__/, '')
  if (name === 'Read' || name === 'Write' || name === 'Edit') {
    const p = (input.file_path as string) || ''
    if (!p) return ''
    const parts = p.split('/')
    return parts.length <= 2 ? p : '.../' + parts.slice(-2).join('/')
  }
  if (name === 'Bash') {
    const cmd = (input.command as string) || ''
    return cmd.length > 50 ? cmd.slice(0, 47) + '...' : cmd
  }
  if (name === 'Glob' || name === 'Grep') return (input.pattern as string) || ''
  if (name === 'write_output') return (input.field as string) || ''
  if (name === 'Task') return (input.description as string) || ''
  return ''
}

function InlineToolCard({ tool }: { tool: ToolActivity }) {
  const [expanded, setExpanded] = useState(false)
  const rawName = tool.toolName
  const displayName = rawName.replace(/^mcp__[^_]+__/, '')
  const icon = TOOL_ICONS[displayName] || TOOL_ICONS[rawName] || '🔧'
  const summary = getToolSummary(tool)

  const durationText = tool.duration
    ? tool.duration > 1000
      ? `${(tool.duration / 1000).toFixed(1)}s`
      : `${tool.duration}ms`
    : null

  const hasDetails = tool.toolInput || tool.toolOutput || tool.toolError

  return (
    <div className="my-1">
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white border border-gray-200 rounded-md text-gray-600 ${hasDetails ? 'cursor-pointer hover:bg-gray-50' : ''}`}
        title={tool.toolError || `${displayName} ${tool.phase}`}
        onClick={hasDetails ? () => setExpanded(!expanded) : undefined}
      >
        {hasDetails && (
          <svg
            className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M6 4l4 4-4 4z" />
          </svg>
        )}
        <span>{icon}</span>
        <span className="font-medium text-gray-700">{displayName}</span>
        {summary && (
          <span className="text-gray-500 truncate max-w-[180px]">{summary}</span>
        )}
        {tool.phase === 'start' ? (
          <span className="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        ) : tool.success !== false ? (
          <span>✅</span>
        ) : (
          <span>❌</span>
        )}
        {durationText && <span className="text-gray-400">{durationText}</span>}
      </div>
      {expanded && (
        <div className="mt-1 ml-4 p-2 text-xs bg-gray-50 border rounded space-y-2 max-h-[300px] overflow-y-auto">
          {tool.toolInput != null && (
            <div>
              <div className="font-medium text-gray-500 mb-1">Input</div>
              <pre className="whitespace-pre-wrap break-all font-mono text-[11px]">
                {typeof tool.toolInput === 'string' ? tool.toolInput : JSON.stringify(tool.toolInput, null, 2)}
              </pre>
            </div>
          )}
          {tool.toolOutput != null && (
            <div>
              <div className="font-medium text-gray-500 mb-1">Output</div>
              <pre className="whitespace-pre-wrap break-all font-mono text-[11px]">
                {typeof tool.toolOutput === 'string' ? tool.toolOutput : JSON.stringify(tool.toolOutput, null, 2)}
              </pre>
            </div>
          )}
          {tool.toolError && (
            <div>
              <div className="font-medium text-red-500 mb-1">Error</div>
              <pre className="text-red-600 whitespace-pre-wrap break-all font-mono text-[11px]">{tool.toolError}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function MessageBubble({ message, onSync, onDiscard }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Avatar */}
        <div className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              isUser ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-600'
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
            {/* Message Content with inline tool cards */}
            <div className={isUser ? 'message-user' : 'message-assistant'}>
              {message.contentBlocks && message.contentBlocks.length > 0 ? (
                <div className="text-sm leading-relaxed">
                  {message.contentBlocks.map((block: ContentBlock, i: number) =>
                    block.type === 'text' ? (
                      <span key={i} className="whitespace-pre-wrap">{block.text}</span>
                    ) : (
                      <InlineToolCard key={block.tool.toolId || i} tool={block.tool} />
                    )
                  )}
                </div>
              ) : message.content ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>

            {/* Output Updates (Sync Buttons) */}
            {!isUser && message.outputUpdates && message.outputUpdates.length > 0 && (
              <div className="mt-2 space-y-2">
                {message.outputUpdates.map((update) => (
                  <SyncButton
                    key={update.field}
                    field={update.field}
                    preview={update.preview}
                    synced={update.synced}
                    syncedAt={update.syncedAt}
                    onSync={() => onSync?.(update.field)}
                    onDiscard={() => onDiscard?.(update.field)}
                  />
                ))}
              </div>
            )}

            {/* Timestamp */}
            <div className={`mt-1 text-xs text-gray-400 ${isUser ? 'text-right' : ''}`}>
              {message.timestamp.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MessageBubble
