import React, { useState } from 'react'
import type { OutputUpdate } from '../types'

export interface SyncCardPanelProps {
  /** Output updates to display */
  outputUpdates: OutputUpdate[]
  /** Callback when sync button clicked */
  onSync?: (field: string) => void
  /** Callback when discard button clicked */
  onDiscard?: (field: string) => void
  /**
   * Custom render function for sync cards.
   * If not provided, uses default card rendering.
   */
  renderSyncCard?: (update: OutputUpdate, onSync: () => void, onDiscard: () => void) => React.ReactNode
  /** Maximum number of cards to show before collapsing. Defaults to 3 */
  maxVisible?: number
}

/**
 * Sticky panel displaying pending output updates at the bottom of chat.
 *
 * **Features**:
 * - Sticky positioning at bottom
 * - Semi-transparent background with backdrop blur
 * - Collapsible when more than maxVisible cards
 * - Custom card rendering via renderSyncCard prop
 *
 * **Behavior**:
 * - Only renders when there are pending (un-synced) updates
 * - Filters out synced updates automatically
 * - Can be customized per solution
 *
 * @example
 * ```tsx
 * <SyncCardPanel
 *   outputUpdates={outputUpdates}
 *   onSync={handleSync}
 *   onDiscard={handleDiscard}
 *   renderSyncCard={(update, onSync, onDiscard) => (
 *     <div className="p-2 border rounded">
 *       <div>{update.field}: {update.preview}</div>
 *       <button onClick={onSync}>Sync</button>
 *       <button onClick={onDiscard}>×</button>
 *     </div>
 *   )}
 * />
 * ```
 */
export function SyncCardPanel(props: SyncCardPanelProps): React.ReactElement | null {
  const {
    outputUpdates,
    onSync,
    onDiscard,
    renderSyncCard,
    maxVisible = 3,
  } = props

  const [isExpanded, setIsExpanded] = useState(false)

  // Filter out synced updates
  const pendingUpdates = outputUpdates.filter(u => !u.synced)

  // Don't render if no pending updates
  if (pendingUpdates.length === 0) {
    return null
  }

  const hasMore = pendingUpdates.length > maxVisible
  const visibleUpdates = isExpanded ? pendingUpdates : pendingUpdates.slice(0, maxVisible)

  return (
    <div className="sticky bottom-0 left-0 right-0 z-10 border-t border-gray-200 bg-white/90 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              📥 待同步内容
            </span>
            <span className="text-xs text-gray-500">
              ({pendingUpdates.length} 项)
            </span>
          </div>
          {hasMore && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {isExpanded ? '收起' : `展开全部 (${pendingUpdates.length})`}
            </button>
          )}
        </div>

        {/* Cards */}
        <div className="space-y-2">
          {visibleUpdates.map(update => {
            const handleSync = () => onSync?.(update.field)
            const handleDiscard = () => onDiscard?.(update.field)

            return (
              <div key={update.field}>
                {renderSyncCard ? (
                  renderSyncCard(update, handleSync, handleDiscard)
                ) : (
                  <DefaultSyncCard
                    update={update}
                    onSync={handleSync}
                    onDiscard={handleDiscard}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Default Sync Card
// ============================================================================

interface DefaultSyncCardProps {
  update: OutputUpdate
  onSync: () => void
  onDiscard: () => void
}

function DefaultSyncCard({ update, onSync, onDiscard }: DefaultSyncCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-700 truncate">
          {update.field}
        </div>
        <div className="text-xs text-gray-500 truncate">
          {update.preview}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onSync}
          className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
        >
          同步
        </button>
        <button
          onClick={onDiscard}
          className="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          title="忽略"
        >
          ×
        </button>
      </div>
    </div>
  )
}
