import { useRef, useEffect } from 'react'
import type { ChalkboardAction } from '../types/blackboard-actions'
import { X, ArrowsOut, ArrowsIn } from '@phosphor-icons/react'

// Import side-effect: registers blackboard-player custom element
import './BlackboardPlayer'

interface BlackboardPlayerEl extends HTMLElement {
  execute(actions: ChalkboardAction[]): void
  reset(): void
}

interface StickerOverlayProps {
  actions: ChalkboardAction[]
  visible: boolean
  expanded: boolean
  onDismiss: () => void
  onToggleExpand: () => void
  onCollapseFromBackdrop: () => void
}

export function StickerOverlay({ actions, visible, expanded, onDismiss, onToggleExpand, onCollapseFromBackdrop }: StickerOverlayProps) {
  const playerRef = useRef<BlackboardPlayerEl | null>(null)
  const prevLenRef = useRef(0)

  // Reset when actions become empty
  useEffect(() => {
    if (actions.length === 0) {
      playerRef.current?.reset()
      prevLenRef.current = 0
    }
  }, [actions])

  // Execute new actions incrementally
  useEffect(() => {
    const player = playerRef.current
    if (!player || actions.length === 0) return
    if (actions.length > prevLenRef.current) {
      const newActions = actions.slice(prevLenRef.current)
      player.execute(newActions)
      prevLenRef.current = actions.length
    }
  }, [actions])

  return (
    <div
      className={[
        'absolute inset-0 z-10 pointer-events-none transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
    >
      {/* Backdrop overlay (expanded only) */}
      <div
        className={[
          'absolute inset-0 transition-opacity duration-300',
          expanded && visible ? 'bg-black/30 pointer-events-auto' : 'bg-transparent pointer-events-none',
        ].join(' ')}
        onClick={expanded ? onCollapseFromBackdrop : undefined}
      />

      {/* Mini-blackboard card */}
      <div
        className="absolute pointer-events-auto rounded-xl shadow-2xl ring-1 ring-white/10 overflow-hidden"
        style={{
          background: '#1A3A32',
          width: expanded ? '85%' : '45%',
          height: expanded ? '85%' : '45%',
          top: expanded ? '50%' : 'calc(100% - 12px)',
          left: expanded ? '50%' : 'calc(100% - 12px)',
          transform: expanded ? 'translate(-50%, -50%)' : 'translate(-100%, -100%)',
          transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={!expanded ? onToggleExpand : undefined}
      >
        {/* Blackboard player fills card */}
        <blackboard-player
          ref={playerRef as unknown as React.RefCallback<HTMLElement>}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />

        {/* "AI 补充" label — top-left */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-accent/80 text-[10px] text-white font-medium pointer-events-none">
          AI 补充
        </div>

        {/* Action buttons — top-right */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {/* Expand / Collapse toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 backdrop-blur text-white/70 hover:text-white hover:bg-white/20 transition-colors"
            aria-label={expanded ? '收起' : '展开'}
          >
            {expanded ? <ArrowsIn size={12} weight="bold" /> : <ArrowsOut size={12} weight="bold" />}
          </button>

          {/* Dismiss button */}
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss() }}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 backdrop-blur text-white/70 hover:text-white hover:bg-white/20 transition-colors"
            aria-label="关闭 AI 补充"
          >
            <X size={12} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default StickerOverlay
