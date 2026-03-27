import type { ReactNode } from 'react'
import { useChatCore } from '@/context/ChatCoreContext'

export interface ChatInterfaceEmptyStateProps {
  title?: string
  children?: ReactNode
}

export function ChatInterfaceEmptyState({
  title = '有什么可以帮你的？',
  children,
}: ChatInterfaceEmptyStateProps) {
  const { quickSuggestions, handleSuggestionSelect } = useChatCore()

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 sm:gap-8">
      <h1 className="text-3xl font-serif text-ck-t1">{title}</h1>
      {children ?? (
        quickSuggestions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
            {quickSuggestions.slice(0, 4).map((s, i) => (
              <button
                key={i}
                onClick={() => handleSuggestionSelect(s)}
                className="text-left px-4 py-3 rounded-xl border border-ck-b1 bg-ck-bg1 text-sm text-ck-t2 hover:bg-ck-bg3 hover:text-ck-t1 transition-[color,background-color,transform] ease-claude cursor-pointer active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent"
              >
                {s.label}
              </button>
            ))}
          </div>
        )
      )}
    </div>
  )
}
