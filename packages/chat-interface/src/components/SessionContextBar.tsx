import type { SessionContextChip } from '@/types/session-context'
import { cn } from '@/lib/utils'

/** Extended chip with optional variant for solution-level styling */
type ChipVariant = 'active' | 'tenant' | 'clickable' | 'default'

interface ExtendedChip extends SessionContextChip {
  variant?: ChipVariant
}

interface SessionContextBarProps {
  chips: SessionContextChip[]
  onChipClick?: (chip: SessionContextChip) => void
  leading?: React.ReactNode
  trailing?: React.ReactNode
}

function getChipVariant(chip: SessionContextChip): ChipVariant {
  const ext = chip as ExtendedChip
  if (ext.variant) return ext.variant
  if (chip.active) return 'active'
  return 'default'
}

const CHIP_STYLES: Record<ChipVariant, string> = {
  active: 'bg-ck-info-bg text-ck-info-t border-transparent',
  tenant: 'bg-ck-purple-bg text-ck-purple-t border-transparent',
  clickable: 'bg-transparent text-ck-t2 border-ck-b1 cursor-pointer hover:bg-ck-bg3',
  default: 'bg-transparent text-ck-t3 border-ck-b2/50 hover:bg-ck-bg3 hover:text-ck-t2',
}

export function SessionContextBar({ chips, onChipClick, leading, trailing }: SessionContextBarProps) {
  if (chips.length === 0 && !leading && !trailing) return null

  const desktopHidden = chips.length === 0 && !trailing

  return (
    <div data-ck="context-bar" className={cn(
      'flex items-center justify-between px-3 sm:px-4 py-1.5 border-b-[0.5px] border-ck-b1 bg-ck-bg2',
      desktopHidden && 'lg:hidden',
    )}>
      <div className="flex gap-1.5 items-center min-w-0">
        {leading}
        {chips.map((chip) => {
          const variant = getChipVariant(chip)
          return (
            <button
              key={chip.key}
              onClick={() => onChipClick?.(chip)}
              title={chip.label}
              className={cn(
                'text-[11px] px-2.5 py-[3px] rounded-full border-[0.5px] max-w-[200px] truncate transition-colors ease-claude active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent',
                CHIP_STYLES[variant],
              )}
            >
              {chip.label}
            </button>
          )
        })}
      </div>
      {trailing && <div className="flex gap-1.5 items-center">{trailing}</div>}
    </div>
  )
}
