/**
 * Tool Activity Item Component
 *
 * Displays a single tool activity as a compact badge/pill.
 */

import type { ToolActivity } from '../types'

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
  AskUserQuestion: '❓',
  NotebookEdit: '📓',
}

interface ToolActivityItemProps {
  tool: ToolActivity
}

export function ToolActivityItem({ tool }: ToolActivityItemProps) {
  const icon = TOOL_ICONS[tool.toolName] || '🔧'
  const statusIcon = tool.phase === 'start'
    ? '⏳'
    : tool.success !== false
      ? '✅'
      : '❌'

  // Format duration if available
  const durationText = tool.duration
    ? tool.duration > 1000
      ? `${(tool.duration / 1000).toFixed(1)}s`
      : `${tool.duration}ms`
    : null

  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded-full"
      title={tool.toolError || `${tool.toolName} ${tool.phase}`}
    >
      <span>{icon}</span>
      <span className="font-medium">{tool.toolName}</span>
      <span>{statusIcon}</span>
      {durationText && (
        <span className="text-gray-500">{durationText}</span>
      )}
    </div>
  )
}
