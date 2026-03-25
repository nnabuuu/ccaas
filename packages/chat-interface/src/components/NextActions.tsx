import type { NextAction } from '@/types/chat'
import { cn } from '@/lib/utils'

interface NextActionsProps {
  actions: NextAction[]
  onAction: (action: NextAction) => void
}

export function NextActions({ actions, onAction }: NextActionsProps) {
  if (actions.length === 0) return null

  return (
    <div className="flex gap-[6px] flex-wrap mt-1">
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={() => onAction(action)}
          className={cn(
            'text-xs px-3 py-[5px] rounded-ck border font-inherit cursor-pointer',
            i === 0
              ? 'bg-ck-t1 text-ck-bg1 border-ck-t1'
              : 'bg-transparent text-ck-t2 border-ck-b1 hover:bg-ck-bg2',
          )}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
