import { Brain } from 'lucide-react'

interface ThinkingIndicatorProps {
  content?: string
}

export function ThinkingIndicator({ content }: ThinkingIndicatorProps) {
  return (
    <div className="flex items-start gap-2 px-4 py-2">
      <div className="w-6 h-6 rounded-full bg-accent-light flex items-center justify-center shrink-0 mt-0.5">
        <Brain size={14} className="text-accent animate-pulse" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <span className="text-xs font-medium text-accent">思考中...</span>
        {content && (
          <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">{content}</p>
        )}
      </div>
    </div>
  )
}
