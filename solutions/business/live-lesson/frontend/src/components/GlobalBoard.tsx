import type { GlobalBoardNode } from '../types'

interface GlobalBoardProps {
  nodes: GlobalBoardNode[]
  revealedNodeIds: Set<string>
  currentSectionId: string | null
}

export function GlobalBoard({ nodes, revealedNodeIds, currentSectionId }: GlobalBoardProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col h-full bg-background-dark/80">
        <div className="px-3 py-3 border-b border-white/8">
          <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-[0.18em]">课程地图</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-5 h-5 skeleton-shimmer rounded-full" />
            <div className="w-16 h-2.5 skeleton-shimmer rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background-dark/80">
      {/* Header */}
      <div className="px-3 py-3 border-b border-white/8 flex-shrink-0">
        <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-[0.18em]">课程地图</span>
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-3">
        {nodes.map((node, idx) => {
          const isRevealed = revealedNodeIds.has(node.id)
          const isCurrent = node.id === currentSectionId

          return (
            <div key={node.id} className="relative">
              {/* Connector line — tinted when revealed */}
              {idx > 0 && (
                <div
                  className={[
                    'absolute -top-3 left-4 w-px h-3 transition-colors duration-500',
                    isRevealed || isCurrent ? 'bg-primary/20' : 'bg-white/8',
                  ].join(' ')}
                />
              )}

              {/* Node box */}
              <div
                className={[
                  'flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
                  isCurrent
                    ? 'bg-primary/[0.09] border-primary/35 shadow-[inset_0_1px_0_rgba(19,236,91,0.12)]'
                    : isRevealed
                      ? 'bg-white/[0.05] border-white/15'
                      : 'bg-white/[0.02] border-white/6',
                ].join(' ')}
              >
                {/* Step indicator */}
                <div
                  className={[
                    'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all duration-500',
                    isCurrent
                      ? 'bg-primary text-background-dark border-primary/70'
                      : isRevealed
                        ? 'bg-primary/15 text-primary/60 border-primary/25'
                        : 'bg-white/[0.04] text-gray-700 border-white/8',
                  ].join(' ')}
                >
                  {idx + 1}
                </div>

                {/* Label */}
                <span
                  className={[
                    'text-xs font-medium leading-tight transition-colors duration-500',
                    isCurrent ? 'text-primary' : isRevealed ? 'text-gray-300' : 'text-gray-700',
                  ].join(' ')}
                >
                  {node.label}
                </span>

                {/* Current indicator — breathing dot */}
                {isCurrent && (
                  <div className="ml-auto flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default GlobalBoard
