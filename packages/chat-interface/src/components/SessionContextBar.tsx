import type { SessionContextChip } from '@/types/session-context'
import { cn } from '@/lib/utils'

interface SessionContextBarProps {
  chips: SessionContextChip[]
  onChipClick?: (chip: SessionContextChip) => void
  trailing?: React.ReactNode
}

export function SessionContextBar({ chips, onChipClick, trailing }: SessionContextBarProps) {
  if (chips.length === 0) return null

  return (
    <div className="flex items-center justify-between px-4 py-[10px] border-b border-ck-b1 bg-ck-bg1">
      <div className="flex gap-[6px] items-center">
        {chips.map((chip) => (
          <button
            key={chip.key}
            onClick={() => onChipClick?.(chip)}
            className={cn(
              'text-[11px] px-[10px] py-[3px] rounded-xl border',
              chip.active
                ? 'bg-ck-info-bg text-ck-info-t border-transparent'
                : 'bg-ck-bg2 text-ck-t2 border-ck-b1 hover:bg-ck-bg2/80',
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {trailing && <div className="flex gap-[6px] items-center">{trailing}</div>}
    </div>
  )
}
