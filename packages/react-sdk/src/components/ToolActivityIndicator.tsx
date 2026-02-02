import type { ToolActivity, ColorScheme } from '../types'
import { COLOR_MAP } from '../types'

export interface ToolActivityIndicatorProps {
  activeTools: Map<string, ToolActivity>
  colorScheme?: ColorScheme
}

export function ToolActivityIndicator({ activeTools, colorScheme = 'blue' }: ToolActivityIndicatorProps) {
  if (activeTools.size === 0) return null

  const colors = COLOR_MAP[colorScheme]

  return (
    <div className="text-xs text-gray-500 space-y-1 mb-2 px-1">
      {Array.from(activeTools.values()).map(tool => (
        <div key={tool.toolId} className="flex items-center gap-2 animate-pulse">
          <svg className={`w-3 h-3 animate-spin ${colors.text}`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="truncate">{tool.description || tool.toolName}</span>
        </div>
      ))}
    </div>
  )
}
