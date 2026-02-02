import { Clock, BookOpen, HelpCircle } from 'lucide-react'

interface HistoryItem {
  id: string
  title: string
  type: 'lesson-plan' | 'problem-explain'
  time: string
}

// Placeholder - in real app, fetch from backend
const mockHistory: HistoryItem[] = []

export function SessionHistory() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="label">历史会话</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {mockHistory.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Clock size={24} className="mx-auto text-ink-muted mb-2" strokeWidth={1.5} />
            <p className="text-xs text-ink-muted">暂无历史记录</p>
          </div>
        ) : (
          <div className="py-1">
            {mockHistory.map((item) => (
              <button
                key={item.id}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-surface-tertiary transition-colors text-left"
              >
                {item.type === 'lesson-plan' ? (
                  <BookOpen size={14} className="text-lesson shrink-0" strokeWidth={1.75} />
                ) : (
                  <HelpCircle size={14} className="text-problem shrink-0" strokeWidth={1.75} />
                )}
                <div className="min-w-0">
                  <p className="text-sm text-ink truncate">{item.title}</p>
                  <p className="text-xs text-ink-muted">{item.time}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
