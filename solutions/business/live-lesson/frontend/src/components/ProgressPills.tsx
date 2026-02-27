import type { GlobalBoardNode } from '../types'

interface ProgressPillsProps {
  nodes: GlobalBoardNode[]
  revealedNodeIds: Set<string>
  currentSectionId: string | null
}

export function ProgressPills({ nodes, revealedNodeIds, currentSectionId }: ProgressPillsProps) {
  if (nodes.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
      {nodes.map((node, idx) => {
        const isCurrent = node.id === currentSectionId
        const isRevealed = revealedNodeIds.has(node.id)

        return (
          <div
            key={node.id}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap transition-all duration-500 flex-shrink-0',
              isCurrent
                ? 'bg-accent/15 text-accent font-medium'
                : isRevealed
                  ? 'bg-white/[0.04] text-text-secondary'
                  : 'text-text-tertiary',
            ].join(' ')}
          >
            <span
              className={[
                'flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-medium transition-all duration-500',
                isCurrent
                  ? 'bg-accent text-white'
                  : isRevealed
                    ? 'bg-white/[0.08] text-text-secondary'
                    : 'bg-white/[0.03] text-text-tertiary',
              ].join(' ')}
            >
              {idx + 1}
            </span>
            <span>{node.label}</span>
            {isCurrent && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse flex-shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default ProgressPills
