import type { WidgetComponentProps } from '@/types/widget'

interface SummaryProps {
  label?: string
}

export function Summary({
  props,
  widgetState,
}: WidgetComponentProps<SummaryProps>) {
  const entries = Object.entries(widgetState).filter(
    ([key]) => !key.startsWith('_'),
  )

  const formatValue = (value: unknown): string => {
    if (Array.isArray(value)) {
      return value.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ')
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  return (
    <div>
      <div className="text-xs text-ck-t2 mb-2">{props.label ?? 'Confirm'}</div>
      <div className="bg-ck-bg2 rounded-ck-lg p-[14px]">
        {entries.length > 0 ? (
          entries.map(([key, value]) => (
            <div key={key} className="flex justify-between py-1 text-[13px]">
              <span className="text-ck-t2">{key}</span>
              <span className="font-medium text-right max-w-[60%]">{formatValue(value)}</span>
            </div>
          ))
        ) : (
          <div className="text-xs text-ck-t3 text-center py-2">No data collected</div>
        )}
      </div>

      {/* JSON preview */}
      <details className="mt-2">
        <summary className="text-[11px] text-ck-t3 cursor-pointer hover:text-ck-t2">
          View raw data
        </summary>
        <pre className="mt-1 bg-ck-bg2 rounded-ck p-3 text-[11px] text-ck-t2 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(widgetState, null, 2)}
        </pre>
      </details>
    </div>
  )
}
