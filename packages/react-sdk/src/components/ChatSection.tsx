import type { ChatSectionProps } from '../types'
import { ChatLayoutControls } from './ChatLayoutControls'

export function ChatSection({
  mode,
  isCollapsed,
  onModeChange,
  onToggleCollapse,
  colorScheme = 'blue',
  footer,
  children,
}: ChatSectionProps) {
  return (
    <div className="flex flex-col h-full">
      <ChatLayoutControls
        mode={mode}
        isCollapsed={isCollapsed}
        onModeChange={onModeChange}
        onToggleCollapse={onToggleCollapse}
        colorScheme={colorScheme}
      />
      <div className="flex-1 min-h-0">
        {children}
      </div>
      {footer && (
        <div className="flex-shrink-0 border-t border-gray-200">
          {footer}
        </div>
      )}
    </div>
  )
}
