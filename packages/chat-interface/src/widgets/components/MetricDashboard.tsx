import type { WidgetComponentProps } from '@/types/widget'

interface Metric {
  label: string
  value: string
  delta?: string
  trend?: 'up' | 'down' | 'neutral'
}

interface ChartData {
  type: 'line' | 'bar'
  data: Array<{ label: string; value: number }>
  x_label?: string
  y_label?: string
}

interface BarItem {
  label: string
  value: number
  max_value?: number
  secondary?: string
}

interface MetricDashboardProps {
  metrics: Metric[]
  chart?: ChartData
  items?: BarItem[]
}

export function MetricDashboard({
  props,
}: WidgetComponentProps<MetricDashboardProps>) {
  const metrics = props.metrics ?? []
  const chart = props.chart
  const items = props.items

  return (
    <div className="border border-ck-b1 rounded-ck-lg bg-ck-bg1 p-4">
      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-2 mb-4" style={{ gridTemplateColumns: `repeat(${Math.min(metrics.length, 4)}, 1fr)` }}>
        {metrics.map((m, i) => (
          <div key={i} className="bg-ck-bg2 rounded-ck px-3 py-2.5">
            <div className="text-[11px] text-ck-t2 mb-1">{m.label}</div>
            <div className="text-[20px] font-medium">{m.value}</div>
            {m.delta && (
              <div className={`text-[11px] mt-0.5 ${
                m.trend === 'up' ? 'text-ck-success-t' :
                m.trend === 'down' ? 'text-ck-danger-t' : 'text-ck-t3'
              }`}>
                {m.trend === 'up' ? '\u2191' : m.trend === 'down' ? '\u2193' : ''} {m.delta}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Simple bar chart */}
      {chart && (
        <div className="mb-4">
          <div className="flex items-end gap-1 h-[120px] px-2">
            {chart.data.map((d, i) => {
              const max = Math.max(...chart.data.map(v => v.value))
              const height = max > 0 ? (d.value / max) * 100 : 0
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <span className="text-[10px] text-ck-t3">{d.value}</span>
                  <div
                    className="w-full rounded-t-sm bg-ck-info-t/60 transition-[height]"
                    style={{ height: `${height}%`, minHeight: d.value > 0 ? 4 : 0 }}
                  />
                  <span className="text-[10px] text-ck-t3 truncate max-w-full">{d.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Distribution list */}
      {items && items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((item, i) => {
            const max = item.max_value ?? Math.max(...items.map(it => it.value))
            const pct = max > 0 ? (item.value / max) * 100 : 0
            return (
              <div key={i} className="flex items-center gap-2 text-[13px]">
                <span className="w-[100px] shrink-0 truncate">{item.label}</span>
                <div className="flex-1 h-[6px] bg-ck-bg2 rounded overflow-hidden">
                  <div
                    className="h-full bg-ck-info-t/50 rounded"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-[40px] text-right text-xs text-ck-t2">{item.value}</span>
                {item.secondary && (
                  <span className="text-[11px] text-ck-t3">{item.secondary}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
