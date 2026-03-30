import type { SessionContextChip } from '@/types/session-context'
import { cn } from '@/lib/utils'

interface SessionContextBarProps {
  chips: SessionContextChip[]
  onChipClick?: (chip: SessionContextChip) => void
  leading?: React.ReactNode
  trailing?: React.ReactNode
}

export function SessionContextBar({ chips, onChipClick, leading, trailing }: SessionContextBarProps) {
  if (chips.length === 0 && !leading) return null

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-b border-ck-b2/50 bg-ck-bg2">
      <div className="flex gap-1.5 items-center">
        {leading}
        {chips.map((chip) => (
          <button
            key={chip.key}
            onClick={() => onChipClick?.(chip)}
            title={chip.label}
            className={cn(
              'text-[11px] px-2.5 py-[3px] rounded-xl border max-w-[200px] truncate transition-colors ease-claude active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent',
              chip.active
                ? 'bg-ck-bg3 text-ck-t1 border-ck-b2'
                : 'bg-ck-bg2 text-ck-t2 border-ck-b1 hover:bg-ck-bg3',
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {trailing && <div className="flex gap-1.5 items-center">{trailing}</div>}
    </div>
  )
}
