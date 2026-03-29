import type { ReactNode } from 'react'

export interface ChatInterfaceEmptyStateProps {
  title?: string
  children?: ReactNode
}

export function ChatInterfaceEmptyState({
  title = '有什么可以帮你的？',
  children,
}: ChatInterfaceEmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-end pb-6">
      <h1 className="text-2xl sm:text-3xl font-serif text-ck-t1 flex items-center gap-3">
        <span className="text-orange-400/90 text-2xl sm:text-3xl">✺</span>
        {title}
      </h1>
      {children}
    </div>
  )
}
