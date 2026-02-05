import type { ReactNode } from 'react'

export interface QuickAction {
  id: string
  label: string
  prompt: string
  icon?: ReactNode
  disabled?: boolean
}

export interface QuickActionsProps {
  actions: QuickAction[]
  onAction: (prompt: string) => void
  renderAction?: (action: QuickAction, onClick: () => void) => ReactNode
}

/**
 * QuickActions - Generic quick action buttons with customizable prompts
 *
 * Provides a consistent UI for common actions that send predefined prompts.
 * Solutions can customize the actions list and optionally provide custom rendering.
 *
 * @example
 * <QuickActions
 *   actions={[
 *     { id: 'objectives', label: '学习目标', prompt: '帮我设计学习目标' },
 *     { id: 'content', label: '学习过程', prompt: '帮我设计学习过程' }
 *   ]}
 *   onAction={(prompt) => sendMessage(prompt)}
 * />
 */
export function QuickActions({ actions, onAction, renderAction }: QuickActionsProps) {
  if (actions.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const handleClick = () => {
          if (!action.disabled) {
            onAction(action.prompt)
          }
        }

        // Use custom renderer if provided
        if (renderAction) {
          return <div key={action.id}>{renderAction(action, handleClick)}</div>
        }

        // Default button rendering
        return (
          <button
            key={action.id}
            onClick={handleClick}
            disabled={action.disabled}
            className={`
              inline-flex items-center gap-2 px-3 py-1.5
              text-sm font-medium rounded-lg
              transition-all duration-200
              ${
                action.disabled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 hover:shadow-sm active:scale-95'
              }
            `}
          >
            {action.icon}
            {action.label}
          </button>
        )
      })}
    </div>
  )
}
