import type { WidgetComponentProps } from '@/types/widget'

interface FormField {
  key: string
  label: string
  type: 'select' | 'text' | 'number' | 'toggle' | 'date'
  options?: string[]
  default?: unknown
}

interface FormCollectProps {
  label: string
  fields: FormField[]
}

export function FormCollect({
  props,
  widgetState,
  onStateChange,
}: WidgetComponentProps<FormCollectProps>) {
  const getValue = (key: string, defaultValue?: unknown) => {
    return widgetState[key] ?? defaultValue ?? ''
  }

  return (
    <div>
      <div className="text-xs text-ck-t2 mb-3">{props.label}</div>
      <div className="flex flex-wrap gap-3">
        {props.fields.map((field) => (
          <div key={field.key} className="flex-1 min-w-[140px]">
            <label className="text-xs text-ck-t2 mb-1 block">{field.label}</label>
            {field.type === 'select' && field.options ? (
              <select
                className="w-full px-2.5 py-[7px] border border-ck-b1 rounded-ck text-[13px] bg-ck-bg1 text-ck-t1 font-inherit"
                value={getValue(field.key, field.default) as string}
                onChange={(e) => onStateChange(field.key, e.target.value)}
              >
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.type === 'toggle' ? (
              <button
                className={`px-3 py-[7px] rounded-ck text-[13px] border transition-colors focus-visible:ring-2 focus-visible:ring-ck-accent ${
                  getValue(field.key) === true
                    ? 'bg-ck-success-bg text-ck-success-t border-ck-success-t'
                    : 'bg-transparent text-ck-t2 border-ck-b1'
                }`}
                onClick={() => onStateChange(field.key, !getValue(field.key))}
              >
                {getValue(field.key) === true ? 'On' : 'Off'}
              </button>
            ) : (
              <input
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                className="w-full px-2.5 py-[7px] border border-ck-b1 rounded-ck text-[13px] bg-ck-bg1 text-ck-t1 font-inherit outline-none focus-visible:border-ck-info-t"
                value={getValue(field.key, field.default) as string}
                onChange={(e) => {
                  const val = field.type === 'number' ? Number(e.target.value) : e.target.value
                  onStateChange(field.key, val)
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
