import type { OutputUpdate } from '../types'

export interface DefaultSyncButtonProps {
  update: OutputUpdate
  onSync: () => void
  onDiscard: () => void
}

/**
 * DefaultSyncButton - SDK default sync button component
 *
 * Displays a sync button for output updates with:
 * - Field name and preview
 * - Sync/Discard actions (when not synced)
 * - Synced status display (when synced)
 *
 * Solutions can override this with custom renderSyncButton prop.
 *
 * @example
 * ```tsx
 * import { DefaultSyncButton } from '@ccaas/react-sdk'
 *
 * <DefaultSyncButton
 *   update={outputUpdate}
 *   onSync={() => handleSync(update.field)}
 *   onDiscard={() => handleDiscard(update.field)}
 * />
 * ```
 */
export function DefaultSyncButton({ update, onSync, onDiscard }: DefaultSyncButtonProps) {
  const { field, preview, synced, syncedAt } = update

  return (
    <div className="p-3 bg-white border border-gray-200 rounded-md space-y-2">
      {/* Field and Preview */}
      <div>
        <div className="text-sm font-medium text-gray-700">{field}</div>
        <div className="text-xs text-gray-500 mt-1 line-clamp-2">{preview}</div>
      </div>

      {/* Actions or Synced Status */}
      {synced ? (
        <div className="flex items-center gap-2 text-xs text-green-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>
            已同步
            {syncedAt && ` (${new Date(syncedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })})`}
          </span>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={onSync}
            className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            同步
          </button>
          <button
            onClick={onDiscard}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            忽略
          </button>
        </div>
      )}
    </div>
  )
}
