import { useState } from 'react'
import type { NextAction } from '@/types/chat'
import { cn } from '@/lib/utils'

interface NextActionsProps {
  actions: NextAction[]
  onAction: (action: NextAction) => void | Promise<void>
}

export function NextActions({ actions, onAction }: NextActionsProps) {
  const [pending, setPending] = useState(false)

  if (actions.length === 0) return null

  const handleClick = async (action: NextAction) => {
    if (pending) return
    setPending(true)
    try {
      await onAction(action)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex gap-1.5 flex-wrap mt-1">
      {actions.map((action, i) => (
        <button
          key={i}
          disabled={pending}
          onClick={() => handleClick(action)}
          className={cn(
            'text-xs px-3 py-[5px] rounded-ck border font-inherit cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors ease-claude active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent',
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
