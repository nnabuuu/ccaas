import React, { useRef, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import type { ChalkboardAction } from '../types/blackboard-actions'

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
  timeScale(s: number): void
}

interface DynamicBoardProps {
  actions: ChalkboardAction[]
  beatId: string | null
  isActive: boolean
  canContinue: boolean
  isLoading: boolean
  onContinue: () => void
}

export function DynamicBoard({ actions, beatId, isActive, canContinue, isLoading, onContinue }: DynamicBoardProps) {
  const playerRef = useRef<BlackboardPlayerEl | null>(null)
  const prevLenRef = useRef(0)
  const prevBeatIdRef = useRef<string | null>(null)

  // Reset canvas when beat changes (beatId-driven, not actions.length-driven)
  useEffect(() => {
    if (beatId !== null && beatId !== prevBeatIdRef.current) {
      playerRef.current?.reset()
      prevLenRef.current = 0
      prevBeatIdRef.current = beatId
    }
  }, [beatId])

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
  // Show "继续 →" when not busy, has actions, and there are more beats
  const showContinueButton = !isActive && actions.length > 0 && canContinue
  const showButton = showStartButton || showContinueButton
  const buttonLabel = beatId === null ? '开始课程' : '继续 →'

  return (
    <div className="relative flex flex-col h-full">
      {/* blackboard-player fills entire area */}
      <blackboard-player
        ref={playerRef as unknown as React.RefCallback<HTMLElement>}
        style={{ display: 'block', width: '100%', height: '100%', flexShrink: 0 }}
      />

      {/* Empty state: loading spinner */}
      {actions.length === 0 && !showStartButton && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-center">
            {isLoading && (
              <>
                <div className="w-8 h-8 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
                <p className="text-gray-500 text-sm">课程加载中...</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Unified start / continue button */}
      <div
        className={[
          'absolute bottom-5 left-1/2 -translate-x-1/2 transition-all duration-500',
          showButton
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none',
        ].join(' ')}
      >
        <button
          onClick={onContinue}
          disabled={isActive}
          className={[
            'px-8 py-3 rounded-xl text-base font-bold',
            'bg-primary text-background-dark',
            'shadow-[0_0_20px_rgba(19,236,91,0.4)]',
            'hover:bg-primary/90 hover:shadow-[0_0_28px_rgba(19,236,91,0.6)]',
            'active:scale-95 transition-all duration-150',
          ].join(' ')}
        >
          {isActive ? (
            <span className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              处理中...
            </span>
          ) : (
            buttonLabel
          )}
        </button>
      </div>
    </div>
  )
}

export default DynamicBoard
