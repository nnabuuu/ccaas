import type { DisplaySegment } from '@ccaas/react-sdk'
import type { ToolActivity } from '../types'

interface SegmentBubbleProps {
  segment: DisplaySegment
  /** Whether this is the last segment in the message (for streaming cursor) */
  isLast: boolean
}

// Import InlineToolCard helper from MessageBubble (same logic)
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
  const rawName = tool.toolName
  const displayName = rawName.replace(/^mcp__[^_]+__/, '')
  const icon = TOOL_ICONS[displayName] || TOOL_ICONS[rawName] || '🔧'
  const summary = getToolSummary(tool)

  const durationText = tool.duration
    ? tool.duration > 1000
      ? `${(tool.duration / 1000).toFixed(1)}s`
      : `${tool.duration}ms`
    : null

  return (
    <div className="my-1">
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white border border-gray-200 rounded-md text-gray-600"
        title={tool.toolError || `${displayName} ${tool.phase}`}
      >
        <span>{icon}</span>
        {tool.nestingLevel != null && tool.nestingLevel >= 1 && tool.agentType && (
          <span className="px-1 py-0.5 rounded bg-indigo-100 text-indigo-600 font-medium leading-none">{tool.agentType}</span>
        )}
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
    </div>
  )
}

/**
 * Renders a single display segment from a split message.
 *
 * **Rendering logic**:
 * - `type: 'text'` → Message bubble (same style as existing MessageBubble)
 * - `type: 'tool'` or `'tool-group'` → InlineToolCard(s), indented, no bubble
 * - Streaming cursor only shown on last segment when `isLast && segment.isStreaming`
 */
export function SegmentBubble({ segment, isLast }: SegmentBubbleProps) {
  // Tool segments: render inline tool cards without bubble
  if (segment.type === 'tool' || segment.type === 'tool-group') {
    return (
      <div className="ml-4">
        {segment.blocks.map((block, i) =>
          block.type === 'tool' ? (
            <InlineToolCard key={block.tool.toolId || i} tool={block.tool} />
          ) : null
        )}
      </div>
    )
  }

  // Text segment: render as bubble
  const textBlocks = segment.blocks.filter(b => b.type === 'text')
  const showStreamingCursor = isLast && segment.isStreaming

  return (
    <div className="message-assistant">
      <div className="text-sm leading-relaxed">
        {textBlocks.map((block, i) => (
          <span key={i} className="whitespace-pre-wrap">
            {block.text}
          </span>
        ))}
        {showStreamingCursor && (
          <span className="inline-block ml-1 w-0.5 h-4 bg-primary-500 animate-pulse" />
        )}
      </div>
    </div>
  )
}
