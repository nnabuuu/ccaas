import type { WidgetComponentProps } from '@kedge-agentic/chat-interface'

interface Metric {
  label: string
  value: string
  delta?: string
  trend?: 'up' | 'down' | 'neutral'
}

interface BarItem {
  label: string
  value: number
  max_value?: number
  color_thresholds?: { danger: number; warn: number }
}

interface ActionItem {
  label: string
  prompt: string
  primary?: boolean
  skill_hint?: string
}

interface EduMetricDashboardProps {
  title?: string
  badge?: string
  metrics: Metric[]
  section_title?: string
  bar_list?: BarItem[]
  actions?: ActionItem[]
}

function getBarColor(value: number, thresholds?: { danger: number; warn: number }): string {
  if (!thresholds) return 'bg-[var(--info-t)]'
  if (value >= thresholds.danger) return 'bg-[var(--danger-t)]'
  if (value >= thresholds.warn) return 'bg-[var(--warn-t)]'
  return 'bg-[var(--success-t)]'
}

function getBarTextColor(value: number, thresholds?: { danger: number; warn: number }): string {
  if (!thresholds) return 'text-[var(--info-t)]'
  if (value >= thresholds.danger) return 'text-[var(--danger-t)]'
  if (value >= thresholds.warn) return 'text-[var(--warn-t)]'
  return 'text-[var(--success-t)]'
}

export function EduMetricDashboard({
  props,
  onSubmit,
}: WidgetComponentProps<EduMetricDashboardProps>) {
  const metrics = props.metrics ?? []
  const barList = props.bar_list
  const actions = props.actions

  const colCount = Math.min(metrics.length, 4)

  return (
    <div className="border-[0.5px] border-[var(--b1)] rounded-[var(--rl)] bg-[var(--bg1)] overflow-hidden">
      {/* Header */}
      {(props.title || props.badge) && (
        <div className="flex items-center justify-between px-3.5 py-3 border-b-[0.5px] border-[var(--b1)]">
          {props.title && <span className="text-[13px] font-semibold">{props.title}</span>}
          {props.badge && (
            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-[var(--info-bg)] text-[var(--info-t)]">
              {props.badge}
            </span>
          )}
        </div>
      )}

      <div className="p-3.5">
        {/* Metrics grid */}
        {metrics.length > 0 && (
          <div
            className="grid gap-2 mb-4"
            style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}
          >
            {metrics.map((m, i) => (
              <div key={i} className="bg-[var(--bg2)] rounded-lg px-3 py-3">
                <div className="text-[11px] text-[var(--t2)]">{m.label}</div>
                <div className="text-[22px] font-semibold mt-0.5">
                  {m.value}
                  {m.delta && (
                    <span
                      className={`text-[11px] ml-1 font-normal ${
                        m.trend === 'up'
                          ? 'text-[var(--success-t)]'
                          : m.trend === 'down'
                            ? 'text-[var(--danger-t)]'
                            : 'text-[var(--t3)]'
                      }`}
                    >
                      {m.trend === 'up' ? '\u2191' : m.trend === 'down' ? '\u2193' : ''}
                      {m.delta}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Section title */}
        {props.section_title && (
          <div className="text-[12px] font-medium text-[var(--t2)] mb-2.5">
            {props.section_title}
          </div>
        )}

        {/* Bar list */}
        {barList && barList.length > 0 && (
          <div>
            {barList.map((item, i) => {
              const maxVal = item.max_value ?? 100
              const pct = maxVal > 0 ? Math.min((item.value / maxVal) * 100, 100) : 0
              const barColor = getBarColor(item.value, item.color_thresholds)
              const textColor = getBarTextColor(item.value, item.color_thresholds)

              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 py-[7px] text-[12px] ${
                    i < barList.length - 1 ? 'border-b-[0.5px] border-[var(--b2)]' : ''
                  }`}
                >
                  <span className="w-[120px] shrink-0 truncate">{item.label}</span>
                  <div className="flex-1 h-[7px] bg-[var(--bg3)] rounded overflow-hidden">
                    <div
                      className={`h-full rounded transition-[width] duration-300 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={`w-[40px] text-right font-semibold text-[11px] ${textColor}`}>
                    {item.value}%
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Actions */}
        {actions && actions.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-3.5 pt-3 border-t-[0.5px] border-[var(--b1)]">
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={() => onSubmit?.({ _action: 'suggest', prompt: action.prompt, skill_hint: action.skill_hint })}
                className="text-[12px] px-3.5 py-1.5 rounded-[var(--r)] cursor-pointer border-[0.5px] border-[var(--b1)] bg-[var(--bg1)] text-[var(--t2)] hover:bg-[var(--bg2)] transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
