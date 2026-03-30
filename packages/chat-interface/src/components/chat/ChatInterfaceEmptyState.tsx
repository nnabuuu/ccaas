import type { ReactNode } from 'react'

export interface ChatInterfaceEmptyStateProps {
  title?: string
  children?: ReactNode
}

export function ChatInterfaceEmptyState({
  title = 'What shall we think through?',
  children,
}: ChatInterfaceEmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-end pb-10">
      <h1 className="text-[28px] sm:text-[32px] font-serif text-ck-t1 flex items-center gap-3 tracking-tight leading-tight">
        <svg
          className="w-7 h-7 sm:w-8 sm:h-8 text-ck-accent animate-ck-sparkle shrink-0"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 1C12.8 8 16 11.2 23 12C16 12.8 12.8 16 12 23C11.2 16 8 12.8 1 12C8 11.2 11.2 8 12 1Z" />
        </svg>
        {title}
      </h1>
      {children}
    </div>
  )
}
