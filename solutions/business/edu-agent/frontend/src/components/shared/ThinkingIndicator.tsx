import { Brain } from '@phosphor-icons/react'

interface ThinkingIndicatorProps {
  content?: string
}

export function ThinkingIndicator({ content }: ThinkingIndicatorProps) {
  return (
    <div className="flex items-start gap-2 px-4 py-2">
      <div className="w-6 h-6 rounded-full bg-accent-light flex items-center justify-center shrink-0 mt-0.5">
        <Brain size={14} className="text-accent animate-pulse" weight="fill" />
      </div>
      <div className="min-w-0">
        <div className="space-y-1.5 animate-pulse">
          <div className="h-3 bg-accent/10 rounded w-16" />
          {content && (
            <div className="h-3 bg-zinc-200 rounded w-48" />
          )}
        </div>
      </div>
    </div>
  )
}
