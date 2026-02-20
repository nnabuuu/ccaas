import type { SyncField, PendingUpdateWithMeta } from '../../types'
import { SyncItem } from './SyncItem'

export interface SyncItemListProps {
  updates: PendingUpdateWithMeta[]
  onSync: (field: SyncField) => void
  onDiscard: (field: SyncField) => void
}

/**
 * SyncItemList - 字段列表
 *
 * 显示所有字段（已同步 + 未同步），支持滚动（最大高度 300px）
 * 排序：未同步的在前，已同步的在后，同类按时间倒序
 */
export function SyncItemList({
  updates,
  onSync,
  onDiscard,
}: SyncItemListProps) {
  // 排序规则：
  // 1. 未同步的在前
  // 2. 已同步的在后
  // 3. 同类内按时间倒序
  const sortedUpdates = [...updates].sort((a, b) => {
    // 优先按同步状态排序
    if (a.synced !== b.synced) {
      return a.synced ? 1 : -1 // 未同步 (false) 在前
    }
    // 同步状态相同，按时间倒序
    return b.timestamp - a.timestamp
  })

  return (
    <div className="max-h-[300px] overflow-y-auto border-t border-gray-100">
      <div className="divide-y divide-gray-100">
        {sortedUpdates.map((update) => (
          <SyncItem
            key={update.field}
            update={update}
            onSync={() => onSync(update.field)}
            onDiscard={() => onDiscard(update.field)}
          />
        ))}
      </div>
    </div>
  )
}
