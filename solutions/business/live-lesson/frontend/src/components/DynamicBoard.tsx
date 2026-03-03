import React, { useRef, useEffect, useState } from 'react'
import { Sparkle } from '@phosphor-icons/react'
import type { ChalkboardAction } from '../types/blackboard-actions'
import { StickerOverlay } from './StickerOverlay'

// Import side-effect: registers blackboard-player custom element
import './BlackboardPlayer'

// TypeScript JSX intrinsic element declaration
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'blackboard-player': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
    }
  }
}

interface BlackboardPlayerEl extends HTMLElement {
  execute(actions: ChalkboardAction[]): void
  pause(): void
  resume(): void
  reset(): void
  flush(): void
  timeScale(s: number): void
  snapshot(): string
}

interface DynamicBoardProps {
  actions: ChalkboardAction[]
  beatId: string | null
  isLoading: boolean
  onStart: () => void
  onAnimationChange?: (animating: boolean) => void
  onSnapshot?: (svgHtml: string) => void
  paused?: boolean
  stickerActions?: ChalkboardAction[]
  stickerVisible?: boolean
  stickerExpanded?: boolean
  onDismissSticker?: () => void
  onToggleStickerExpand?: () => void
  onCollapseStickerBackdrop?: () => void
  hasDismissedSticker?: boolean
  onRestoreSticker?: () => void
}

export function DynamicBoard({ actions, beatId, isLoading, onStart, onAnimationChange, onSnapshot, paused, stickerActions, stickerVisible, stickerExpanded, onDismissSticker, onToggleStickerExpand, onCollapseStickerBackdrop, hasDismissedSticker, onRestoreSticker }: DynamicBoardProps) {
  const playerRef = useRef<BlackboardPlayerEl | null>(null)
  const prevLenRef = useRef(0)
  const prevBeatIdRef = useRef<string | null>(null)
  const onSnapshotRef = useRef(onSnapshot)
  onSnapshotRef.current = onSnapshot

  // Track whether canvas animation is currently playing
  const [isAnimating, setIsAnimating] = useState(false)

  // Report animation state changes to parent
  useEffect(() => {
    onAnimationChange?.(isAnimating)
  }, [isAnimating, onAnimationChange])

  // Pause / resume blackboard animation
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    if (paused) player.pause()
    else player.resume()
  }, [paused])

  // Reset canvas when beat changes (beatId-driven, not actions.length-driven)
  // Flush pending animations and capture snapshot of previous beat before resetting
  useEffect(() => {
    if (beatId !== null && beatId !== prevBeatIdRef.current) {
      if (prevBeatIdRef.current !== null && playerRef.current && onSnapshotRef.current) {
        playerRef.current.flush()
        onSnapshotRef.current(playerRef.current.snapshot())
      }
      playerRef.current?.reset()
      prevLenRef.current = 0
      prevBeatIdRef.current = beatId
      setIsAnimating(false)
    }
  }, [beatId])

  // When actions change (new beat's actions arrive), calculate total duration and auto-clear.
  // Only sum durations of actions before the last one — the last action's visual content
  // renders instantly, and its duration only gates (nonexistent) subsequent actions.
  useEffect(() => {
    if (actions.length === 0) {
      setIsAnimating(false)
      return
    }
    setIsAnimating(true)
    // Sum all durations except the last action's (its visual content renders instantly).
    // For single-action arrays, use that action's own duration so we don't under-count.
    const allButLast = actions.length > 1 ? actions.slice(0, -1) : actions
    const totalMs = allButLast.reduce(
      (sum, a) => sum + ((a as { duration?: number }).duration ?? 0.5) * 1000,
      0,
    )
    const timer = setTimeout(() => setIsAnimating(false), totalMs + 100)
    return () => clearTimeout(timer)
  }, [actions])

  // Execute new actions when actions array grows
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    if (actions.length > prevLenRef.current) {
      const newActions = actions.slice(prevLenRef.current)
      player.execute(newActions)
      prevLenRef.current = actions.length
    }
  }, [actions])

  // Show "开始课程" when manifest loaded but no beat started yet
  const showStartButton = !isLoading && beatId === null

  return (
    <div className="relative flex flex-col h-full">
      {/* blackboard-player fills entire area */}
      <blackboard-player
        ref={playerRef as unknown as React.RefCallback<HTMLElement>}
        style={{ display: 'block', width: '100%', height: '100%', flexShrink: 0 }}
      />

      {/* Empty state: skeleton loader */}
      {actions.length === 0 && !showStartButton && isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-3">
              <div className="w-24 h-3 skeleton-shimmer rounded" />
              <div className="w-16 h-3 skeleton-shimmer rounded" />
            </div>
            <div className="w-40 h-3 skeleton-shimmer rounded" />
            <div className="flex gap-3">
              <div className="w-20 h-3 skeleton-shimmer rounded" />
              <div className="w-28 h-3 skeleton-shimmer rounded" />
            </div>
          </div>
        </div>
      )}

      {/* Start button — centered, unmounted when lesson has started */}
      {showStartButton && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={onStart}
            className={[
              'px-8 py-3.5 rounded-xl text-base font-semibold',
              'bg-accent text-white',
              'shadow-lg shadow-accent/20',
              'hover:bg-accent-muted',
              'active:scale-[0.98] transition-all duration-200',
            ].join(' ')}
          >
            开始课程
          </button>
        </div>
      )}

      {/* Sticker overlay for AI execute_dynamic_board responses */}
      {/* Floating pill to restore dismissed sticker */}
      {hasDismissedSticker && onRestoreSticker && (
        <button
          onClick={onRestoreSticker}
          aria-label="恢复 AI 补充面板"
          className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5
                     rounded-lg bg-[#2A5A4A]/80 backdrop-blur border border-white/[0.08]
                     text-[11px] text-amber-300/90 font-medium
                     hover:bg-[#2A5A4A] hover:border-amber-400/30
                     transition-all duration-200 shadow-lg"
        >
          <Sparkle size={12} weight="fill" />
          AI 补充
        </button>
      )}

      {stickerActions && onDismissSticker && onToggleStickerExpand && onCollapseStickerBackdrop && (
        <StickerOverlay
          actions={stickerActions}
          visible={stickerVisible ?? false}
          expanded={stickerExpanded ?? false}
          onDismiss={onDismissSticker}
          onToggleExpand={onToggleStickerExpand}
          onCollapseFromBackdrop={onCollapseStickerBackdrop}
        />
      )}
    </div>
  )
}

export default DynamicBoard
