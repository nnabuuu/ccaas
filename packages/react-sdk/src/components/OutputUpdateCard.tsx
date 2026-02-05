import type { ReactNode } from 'react'

export interface OutputUpdateCardProps {
  field: string
  fieldLabel: string
  preview: string
  synced?: boolean
  syncedAt?: Date
  icon?: 'sync' | 'download' | 'attach' | ReactNode
  syncLabel?: string
  onSync: () => void
  onDiscard: () => void
}

/**
 * OutputUpdateCard - Generic version of SyncButton for displaying AI-generated content suggestions
 *
 * Displays pending updates with Sync/Discard actions or synced state with Resync option.
 * Solutions provide field label mappings to customize the display.
 *
 * @example
 * <OutputUpdateCard
 *   field="objectives"
 *   fieldLabel="学习目标"
 *   preview="理解圆的面积公式..."
 *   onSync={() => syncField('objectives')}
 *   onDiscard={() => discardField('objectives')}
 * />
 */
export function OutputUpdateCard({
  field,
  fieldLabel,
  preview,
  synced,
  syncedAt,
  icon = 'sync',
  syncLabel = '同步到表单',
  onSync,
  onDiscard,
}: OutputUpdateCardProps) {
  // Format time as HH:MM:SS
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // Render icon based on type
  const renderIcon = () => {
    if (typeof icon !== 'string') {
      return icon
    }

    switch (icon) {
      case 'download':
      case 'attach':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
            />
          </svg>
        )
      case 'sync':
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        )
    }
  }

  const suggestionLabel = icon === 'attach' || icon === 'download' ? '待添加' : '建议更新'
  const resyncLabel = icon === 'attach' || icon === 'download' ? '重新添加' : '重新同步'
  const syncedPrefix = icon === 'attach' || icon === 'download' ? '已添加' : '已同步到'

  if (synced) {
    return (
      <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {icon === 'attach' || icon === 'download' ? syncedPrefix : `${syncedPrefix}「${fieldLabel}」`}
            </p>
            {syncedAt && (
              <p className="text-xs text-green-600 mt-1">上次同步: {formatTime(syncedAt)}</p>
            )}
          </div>

          <button
            onClick={onSync}
            className="px-3 py-1.5 text-sm rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
          >
            {resyncLabel}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-yellow-800">
            {suggestionLabel}「{fieldLabel}」
          </p>
          <p className="text-sm text-yellow-700 mt-1 truncate">{preview}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onSync}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors"
          >
            {renderIcon()}
            {syncLabel}
          </button>

          <button
            onClick={onDiscard}
            className="p-1.5 text-yellow-600 hover:text-yellow-800 rounded"
            title="忽略"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
