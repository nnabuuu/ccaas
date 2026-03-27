import { useId } from 'react'

interface TooltipProps {
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  children: React.ReactNode
}

const placementClasses: Record<NonNullable<TooltipProps['placement']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
}

export function Tooltip({ content, placement = 'top', children }: TooltipProps) {
  const id = useId()

  return (
    <span className="relative inline-flex group/tooltip">
      <span aria-describedby={id}>{children}</span>
      <span
        id={id}
        role="tooltip"
        className={`absolute ${placementClasses[placement]} pointer-events-none z-50 max-w-[208px] bg-ck-t1 text-ck-bg1 text-xs rounded-md px-2 py-1 opacity-0 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 transition-opacity`}
      >
        {content}
      </span>
    </span>
  )
}
