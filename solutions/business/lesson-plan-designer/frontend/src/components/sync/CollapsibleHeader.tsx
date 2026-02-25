import { CaretDown, CaretUp, ArrowsClockwise } from '@phosphor-icons/react'

export interface CollapsibleHeaderProps {
  isExpanded: boolean
  unsyncedCount: number
  syncedCount?: number
  isSyncing: boolean
  onToggle: () => void
  onSyncAll: () => void
}

/**
 * CollapsibleHeader - 折叠式头部
 *
 * 显示：
 * - 展开/折叠图标
 * - 待同步数量 + 已同步数量
 * - Sync All 按钮
 */
export function CollapsibleHeader({
  isExpanded,
  unsyncedCount,
  syncedCount = 0,
  isSyncing,
  onToggle,
  onSyncAll,
}: CollapsibleHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors">
      {/* Left: Expand icon + Summary */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        {isExpanded ? (
          <CaretUp size={16} weight="regular" />
        ) : (
          <CaretDown size={16} weight="regular" />
        )}
        <span>
          待同步 ({unsyncedCount})
          {syncedCount > 0 && (
            <span className="text-green-600 ml-2">· 已同步 ({syncedCount})</span>
          )}
        </span>
      </button>

      {/* Right: Sync All button (只在有未同步字段时显示) */}
      {unsyncedCount > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSyncAll()
          }}
          disabled={isSyncing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowsClockwise size={14} weight="regular" className={isSyncing ? 'animate-spin' : ''} />
          {isSyncing ? '同步中...' : '全部同步'}
        </button>
      )}
    </div>
  )
}
