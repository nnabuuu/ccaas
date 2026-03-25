import type { WidgetComponentProps } from '@/types/widget'
import { cn } from '@/lib/utils'

interface BarItem {
  id: string
  label: string
  value: number
}

interface BarListProps {
  label: string
  items?: BarItem[]
  toggleable?: boolean
  toggle_label?: string
  color_thresholds?: {
    danger: number
    warning: number
  }
}

export function BarList({
  props,
  widgetState,
  onStateChange,
}: WidgetComponentProps<BarListProps>) {
  const items = props.items ?? []
  const toggleable = props.toggleable ?? false
  const thresholds = props.color_thresholds ?? { danger: 0.35, warning: 0.25 }
  const toggled = (widgetState.toggled as string[]) ?? []

  const getColor = (value: number) => {
    const rate = value / 100
    if (rate >= thresholds.danger) return 'var(--danger-t)'
    if (rate >= thresholds.warning) return 'var(--warn-t)'
    return 'var(--success-t)'
  }

  const handleToggle = (id: string) => {
    const next = toggled.includes(id)
      ? toggled.filter(t => t !== id)
      : [...toggled, id]
    onStateChange('toggled', next)
  }

  return (
    <div>
      <div className="text-xs text-ck-t2 mb-2">{props.label}</div>
      <div className="space-y-2">
        {items.map((item) => {
          const color = getColor(item.value)
          const isToggled = toggled.includes(item.id)

          return (
            <div
              key={item.id}
              className="flex items-center gap-[10px] px-3 py-2 rounded-ck border border-ck-b1 text-[13px]"
            >
              <span className="w-[140px] shrink-0">{item.label}</span>
              <div className="flex-1 h-[6px] bg-ck-bg2 rounded-[3px] overflow-hidden">
                <div
                  className="h-full rounded-[3px]"
                  style={{ width: `${item.value}%`, background: color }}
                />
              </div>
              <span
                className="w-[42px] text-right shrink-0 text-xs font-medium"
                style={{ color }}
              >
                {item.value}%
              </span>
              {toggleable && (
                <button
                  onClick={() => handleToggle(item.id)}
                  className={cn(
                    'w-4 h-4 rounded-[3px] border shrink-0 flex items-center justify-center text-[11px] transition-all',
                    isToggled
                      ? 'bg-ck-warn-bg border-ck-warn-t text-ck-warn-t font-medium'
                      : 'border-ck-b1',
                  )}
                  title={props.toggle_label ?? 'Mark for emphasis'}
                >
                  {isToggled ? '!' : ''}
                </button>
              )}
            </div>
          )
        })}
        {items.length === 0 && (
          <div className="text-xs text-ck-t3 py-4 text-center">No data available</div>
        )}
      </div>
    </div>
  )
}
