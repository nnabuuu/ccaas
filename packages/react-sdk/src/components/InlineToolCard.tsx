import { useState } from 'react'
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

export function InlineToolCard({ tool }: { tool: ToolActivity }) {
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
