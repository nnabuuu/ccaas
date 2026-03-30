import type { SessionContextChip } from '@/types/session-context'
import { cn } from '@/lib/utils'

interface SessionContextBarProps {
  chips: SessionContextChip[]
  onChipClick?: (chip: SessionContextChip) => void
  leading?: React.ReactNode
  trailing?: React.ReactNode
}

export function SessionContextBar({ chips, onChipClick, leading, trailing }: SessionContextBarProps) {
  if (chips.length === 0 && !leading && !trailing) return null

  // When no chips and no trailing content, the bar only contains the mobile hamburger
  // → hide on desktop (lg:) to avoid empty border strip
  const desktopHidden = chips.length === 0 && !trailing

  return (
    <div className={cn(
      'flex items-center justify-between px-3 sm:px-4 py-1.5 border-b border-ck-b2/50 bg-ck-bg2',
      desktopHidden && 'lg:hidden',
    )}>
      <div className="flex gap-1.5 items-center min-w-0">
        {leading}
        {chips.map((chip) => (
          <button
            key={chip.key}
            onClick={() => onChipClick?.(chip)}
            title={chip.label}
            className={cn(
              'text-[11px] px-2.5 py-[3px] rounded-full border-[0.5px] max-w-[200px] truncate transition-colors ease-claude active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent',
              chip.active
                ? 'bg-ck-info-bg text-ck-info-t border-transparent'
                : 'bg-transparent text-ck-t3 border-ck-b2/50 hover:bg-ck-bg3 hover:text-ck-t2',
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
