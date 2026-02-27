import type { GlobalBoardNode } from '../types'

interface GlobalBoardProps {
  nodes: GlobalBoardNode[]
  revealedNodeIds: Set<string>
  currentSectionId: string | null
}

export function GlobalBoard({ nodes, revealedNodeIds, currentSectionId }: GlobalBoardProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-white/[0.04]">
          <span className="text-xs text-text-secondary">课程地图</span>
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.04] flex-shrink-0">
        <span className="text-xs text-text-secondary">课程地图</span>
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {nodes.map((node, idx) => {
          const isRevealed = revealedNodeIds.has(node.id)
          const isCurrent = node.id === currentSectionId

          return (
            <div key={node.id} className="relative">
              {/* Connector line */}
              {idx > 0 && (
                <div
                  className={[
                    'absolute -top-1 left-[15px] w-px h-1 transition-colors duration-500',
                    isRevealed || isCurrent ? 'bg-accent/20' : 'bg-white/[0.04]',
                  ].join(' ')}
                />
              )}

              {/* Node row */}
              <div
                className={[
                  'flex items-center gap-2.5 px-3 py-3 rounded-lg transition-all duration-500',
                  isCurrent
                    ? 'bg-surface-2 border-l-2 border-accent'
                    : isRevealed
                      ? 'border-l-2 border-transparent'
                      : 'border-l-2 border-transparent opacity-50',
                ].join(' ')}
              >
                {/* Step number */}
                <div
                  className={[
                    'flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] font-medium transition-all duration-500',
                    isCurrent
                      ? 'bg-accent text-white'
                      : isRevealed
                        ? 'bg-white/[0.06] text-text-secondary'
                        : 'bg-white/[0.03] text-text-tertiary',
                  ].join(' ')}
                >
                  {idx + 1}
                </div>

                {/* Label */}
                <span
                  className={[
                    'text-[13px] leading-tight transition-colors duration-500',
                    isCurrent ? 'text-text-primary font-medium' : isRevealed ? 'text-text-secondary' : 'text-text-tertiary',
                  ].join(' ')}
                >
                  {node.label}
                </span>

                {/* Current indicator */}
                {isCurrent && (
                  <div className="ml-auto flex-shrink-0 w-1.5 h-1.5 rounded-full bg-accent/70 animate-pulse" />
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
