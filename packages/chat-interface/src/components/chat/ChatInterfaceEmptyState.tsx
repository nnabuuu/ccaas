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
    <div className="flex-1 flex flex-col items-center justify-end pb-8 sm:pb-10 px-4">
      <h1 className="text-[24px] sm:text-[28px] md:text-[32px] font-serif text-ck-t1 flex items-center gap-2.5 sm:gap-3 tracking-tight leading-tight text-center">
        <svg
          className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-ck-accent animate-ck-sparkle shrink-0"
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
