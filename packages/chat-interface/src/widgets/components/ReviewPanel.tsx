import { useState } from 'react'
import type { WidgetComponentProps } from '@/types/widget'
import { cn } from '@/lib/utils'

interface ReviewItem {
  id: string
  content: string
  metadata?: Record<string, string>
}

interface ReviewAction {
  key: string
  label: string
  style?: 'primary' | 'default' | 'danger'
}

interface ReviewPanelProps {
  title: string
  items: ReviewItem[]
  actions: ReviewAction[]
  submit_action: string
}

export function ReviewPanel({
  props,
  widgetState,
  onStateChange,
  onSubmit,
}: WidgetComponentProps<ReviewPanelProps>) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const decisions = (widgetState.decisions as Record<string, string>) ?? {}
  const items = props.items ?? []
  const currentItem = items[currentIndex]

  const handleAction = (itemId: string, actionKey: string) => {
    const next = { ...decisions, [itemId]: actionKey }
    onStateChange('decisions', next)

    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const allReviewed = Object.keys(decisions).length === items.length
  const reviewedCount = Object.keys(decisions).length

  const handleSubmit = () => {
    onSubmit?.({
      decisions,
      _action: props.submit_action,
    })
  }

  if (!currentItem) return null

  return (
    <div className="border border-ck-b1 rounded-ck-lg bg-ck-bg1 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[15px] font-medium">{props.title}</span>
        <span className="text-xs text-ck-t3">
          {reviewedCount}/{items.length} reviewed
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-ck-bg2 rounded mb-4 overflow-hidden">
        <div
          className="h-full bg-ck-success-t rounded transition-[width]"
          style={{ width: `${(reviewedCount / items.length) * 100}%` }}
        />
      </div>

      {/* Current item */}
      <div className="bg-ck-bg2 rounded-ck p-3 mb-3">
        <div className="text-[13px] leading-relaxed whitespace-pre-wrap">
          {currentItem.content}
        </div>
        {currentItem.metadata && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {Object.entries(currentItem.metadata).map(([k, v]) => (
              <span key={k} className="text-[11px] px-2 py-0.5 rounded-full bg-ck-info-bg text-ck-info-t">
                {k}: {v}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Item navigation */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {items.map((item, i) => (
          <button
            key={item.id}
            onClick={() => setCurrentIndex(i)}
            className={cn(
              'w-7 h-7 rounded text-[11px] border transition-colors focus-visible:ring-2 focus-visible:ring-ck-accent',
              i === currentIndex
                ? 'bg-ck-t1 text-ck-bg1 border-ck-t1'
                : decisions[item.id]
                  ? 'bg-ck-success-bg text-ck-success-t border-transparent'
                  : 'bg-transparent text-ck-t3 border-ck-b1',
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Actions for current item */}
      <div className="flex gap-2 flex-wrap">
        {props.actions.map((action) => {
          const isSelected = decisions[currentItem.id] === action.key
          return (
            <button
              key={action.key}
              onClick={() => handleAction(currentItem.id, action.key)}
              className={cn(
                'text-xs px-3 py-[5px] rounded-ck border transition-colors focus-visible:ring-2 focus-visible:ring-ck-accent',
                isSelected
                  ? 'bg-ck-t1 text-ck-bg1 border-ck-t1'
                  : action.style === 'danger'
                    ? 'border-ck-danger-t text-ck-danger-t hover:bg-ck-danger-t/10'
                    : 'border-ck-b1 text-ck-t2 hover:bg-ck-bg2',
              )}
            >
              {action.label}
            </button>
          )
        })}
      </div>

      {/* Submit */}
      {allReviewed && (
        <button
          onClick={handleSubmit}
          className="mt-4 w-full text-[13px] py-2 rounded-ck bg-ck-t1 text-ck-bg1 border border-ck-t1 transition-colors focus-visible:ring-2 focus-visible:ring-ck-accent"
        >
          Submit Review
        </button>
      )}
    </div>
  )
}
