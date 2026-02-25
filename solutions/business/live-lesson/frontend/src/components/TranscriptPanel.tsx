import { useEffect, useRef } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import type { TimelineItem } from '../types/blackboard-actions'
import type { BeatState } from '../types'

interface TranscriptPanelProps {
  timeline: TimelineItem[]
  beatState: BeatState | null
  canContinue: boolean
  onContinue: () => void
}

export function TranscriptPanel({
  timeline,
  beatState,
  canContinue,
  onContinue,
}: TranscriptPanelProps) {
  const endRef = useRef<HTMLDivElement>(null)

  // Filter to only narrator items
  const narratorItems = timeline.filter(item => item.type === 'narrator')

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [narratorItems.length])

  const currentBeatId = beatState?.currentBeatId

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] flex-shrink-0">
        <span className="text-xs text-text-secondary">课程讲义</span>
        {beatState && beatState.totalBeats > 0 && (
          <span className="text-[11px] text-accent px-2 py-0.5 bg-accent/10 rounded-full">
            {beatState.currentBeatIndex + 1} / {beatState.totalBeats}
          </span>
        )}
      </div>

      {/* Narrator entries */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {narratorItems.length === 0 && (
          <div className="flex h-full items-center justify-center pointer-events-none">
            <p className="text-xs text-text-tertiary text-center leading-relaxed px-4">
              点击"开始课程"<br />开启动态教学
            </p>
          </div>
        )}

        {narratorItems.map(item => {
          const isCurrent = item.beatId === currentBeatId
          return (
            <div
              key={item.id}
              className={[
                'px-3 py-2.5 rounded-lg text-[13px] leading-relaxed transition-all duration-300',
                isCurrent
                  ? 'bg-surface-2 border-l-2 border-accent text-text-primary'
                  : 'text-text-tertiary',
              ].join(' ')}
            >
              {item.content}
            </div>
          )
        })}

        <div ref={endRef} />
      </div>

      {/* Continue button */}
      {canContinue && (
        <div className="px-3 py-2.5 border-t border-white/[0.04] flex-shrink-0 flex justify-end">
          <button
            onClick={onContinue}
            className={[
              'px-4 py-2 rounded-lg text-sm font-medium',
              'bg-accent text-white',
              'hover:bg-accent-muted',
              'transition-all duration-200',
              'flex items-center gap-1.5',
            ].join(' ')}
          >
            继续 <ArrowRight size={13} weight="bold" />
          </button>
        </div>
      )}
    </div>
  )
}

export default TranscriptPanel
