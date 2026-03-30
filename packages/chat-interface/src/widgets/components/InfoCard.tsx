import { Children, isValidElement, cloneElement } from 'react'
import type { WidgetComponentProps } from '@/types/widget'

interface InfoCardProps {
  title: string
  badge?: string
}

export function InfoCard({
  props,
  children,
  widgetState,
  onStateChange,
  onSubmit,
}: WidgetComponentProps<InfoCardProps>) {
  const childArray = Children.toArray(children).filter(isValidElement)

  return (
    <div className="border-[0.5px] border-ck-b1 rounded-ck-lg bg-ck-bg1 p-[14px] my-1.5">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[13px] font-medium">{props.title}</span>
        {props.badge && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-lg bg-ck-info-bg text-ck-info-t">
            {props.badge}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2.5">
        {childArray.map((child, i) => (
          <div key={i}>
            {cloneElement(child as React.ReactElement<Record<string, unknown>>, {
              widgetState,
              onStateChange,
              onSubmit,
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
