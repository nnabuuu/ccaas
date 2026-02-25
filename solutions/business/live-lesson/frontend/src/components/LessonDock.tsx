import { useState, useEffect, useRef } from 'react'
import { ArrowRight, HandPalm, Play, ChatCircleDots, Chalkboard } from '@phosphor-icons/react'

interface LessonDockProps {
  narratorText: string | null
  canContinue: boolean
  onContinue: () => void
  onRaiseHand: () => void
  tutoringActive: boolean
  onOpenTutoring: () => void
  showStart: boolean
  onStart: () => void
  connected: boolean
  hasCurrentBeat: boolean
  beatProgress: { current: number; total: number } | null
}

export function LessonDock({
  narratorText,
  canContinue,
  onContinue,
  onRaiseHand,
  tutoringActive,
  onOpenTutoring,
  showStart,
  onStart,
  connected,
  hasCurrentBeat,
  beatProgress,
}: LessonDockProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const isExpandable = !!narratorText && narratorText.length > 60

  // Auto-close popover when narrator text changes
  useEffect(() => { setPopoverOpen(false) }, [narratorText])

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [popoverOpen])

  return (
    <div className="relative flex items-center gap-3 px-5 py-3 bg-surface-1 border-t border-white/[0.06] flex-shrink-0">
      {/* Popover for full text */}
      {popoverOpen && narratorText && (
        <div
          ref={popoverRef}
          className="absolute bottom-full left-4 right-4 mb-2 z-30 bg-surface-2 border border-white/[0.08] rounded-xl shadow-lg shadow-black/40 p-4 max-h-[40vh] overflow-y-auto"
        >
          <p className="text-[13px] text-text-secondary leading-relaxed">
            <span className="inline-flex items-center gap-1 text-accent/70 mr-1 align-middle">
              <Chalkboard size={13} weight="fill" />
              <span className="text-[11px] font-medium">老师</span>
            </span>
            {narratorText}
          </p>
        </div>
      )}

      {/* Narrator text (left side, flex-1) */}
      <div className="flex-1 min-w-0">
        {narratorText ? (
          <p
            className={[
              'text-[13px] text-text-secondary leading-relaxed line-clamp-2',
              isExpandable ? 'cursor-pointer' : '',
            ].join(' ')}
            onClick={isExpandable ? () => setPopoverOpen(o => !o) : undefined}
          >
            {beatProgress && (
              <span className="inline-flex items-center text-[11px] text-accent px-2 py-0.5 bg-accent/10 rounded-full align-middle mr-1.5">
                {beatProgress.current} / {beatProgress.total}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-accent/70 mr-1 align-middle">
              <Chalkboard size={13} weight="fill" />
              <span className="text-[11px] font-medium">老师</span>
            </span>
            {narratorText}
          </p>
        ) : (
          <p className="text-[13px] text-text-tertiary">
            {beatProgress && (
              <span className="inline-flex items-center text-[11px] text-accent px-2 py-0.5 bg-accent/10 rounded-full align-middle mr-1.5">
                {beatProgress.current} / {beatProgress.total}
              </span>
            )}
            {showStart ? '准备开始课程' : '等待下一步…'}
          </p>
        )}
      </div>

      {/* Button group (right side) */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Raise hand / return to tutoring */}
        {tutoringActive ? (
          <button
            onClick={onOpenTutoring}
            className={[
              'px-3.5 py-2 rounded-lg text-[13px] font-medium',
              'border border-accent/30 text-accent',
              'hover:bg-accent/10 hover:border-accent/50',
              'transition-all duration-200',
              'flex items-center gap-1.5',
            ].join(' ')}
          >
            <ChatCircleDots size={15} weight="regular" />
            返回辅导
          </button>
        ) : (
          <button
            onClick={onRaiseHand}
            disabled={!connected || !hasCurrentBeat}
            className={[
              'px-3.5 py-2 rounded-lg text-[13px] font-medium',
              'border border-white/[0.08] text-text-secondary',
              'hover:border-accent/30 hover:text-accent hover:bg-accent/5',
              'disabled:opacity-25 disabled:cursor-not-allowed',
              'transition-all duration-200',
              'flex items-center gap-1.5',
            ].join(' ')}
          >
            <HandPalm size={15} weight="regular" />
            举手提问
          </button>
        )}

        {/* Primary CTA: Start or Continue */}
        {showStart ? (
          <button
            onClick={onStart}
            className={[
              'px-5 py-2.5 rounded-lg text-sm font-semibold',
              'bg-accent text-white',
              'hover:bg-accent-muted',
              'transition-all duration-200',
              'flex items-center gap-1.5',
            ].join(' ')}
          >
            <Play size={15} weight="fill" />
            开始课程
          </button>
        ) : (
          <button
            onClick={onContinue}
            disabled={!canContinue}
            className={[
              'px-5 py-2.5 rounded-lg text-sm font-semibold',
              'bg-accent text-white',
              'hover:bg-accent-muted',
              'disabled:opacity-30',
              'disabled:cursor-not-allowed',
              'transition-all duration-200',
              'flex items-center gap-1.5',
            ].join(' ')}
          >
            继续 <ArrowRight size={14} weight="bold" />
          </button>
        )}
      </div>
    </div>
  )
}

export default LessonDock
