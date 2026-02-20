import { useState, useEffect } from 'react'
import type { SyncField, PendingUpdateWithMeta } from '../../types'
import { CollapsibleHeader } from './CollapsibleHeader'
import { SyncItemList } from './SyncItemList'

export interface GlobalSyncSectionProps {
  pendingUpdates: Map<SyncField, PendingUpdateWithMeta>
  onSyncAll: () => Promise<void>
  onSyncField: (field: SyncField) => void
  onDiscardField: (field: SyncField) => void
}

/**
 * GlobalSyncSection - 全局折叠式同步区域
 *
 * 显示所有待同步字段的汇总，支持：
 * - 折叠/展开切换（默认折叠）
 * - 一键 Sync All
 * - 单个字段同步/忽略
 * - 自动去重（同一字段只显示最新更新）
 * - 同步完成后自动折叠
 */
export function GlobalSyncSection({
  pendingUpdates,
  onSyncAll,
  onSyncField,
  onDiscardField,
}: GlobalSyncSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // 所有更新（包括已同步和未同步）
  const allUpdates = Array.from(pendingUpdates.values())

  // 计算未同步和已同步的更新数量
  const unsynced = allUpdates.filter(u => !u.synced)
  const synced = allUpdates.filter(u => u.synced)
  const unsyncedCount = unsynced.length
  const syncedCount = synced.length

  // 如果没有任何更新（包括已同步的），不显示
  if (allUpdates.length === 0) {
    return null
  }

  // 当没有待同步更新时，自动折叠（但不隐藏，因为可能还有已同步的）
  useEffect(() => {
    if (unsyncedCount === 0 && isExpanded) {
      setIsExpanded(false)
    }
  }, [unsyncedCount, isExpanded])

  const handleSyncAll = async () => {
    setIsSyncing(true)
    try {
      await onSyncAll()
      // 成功后延迟折叠（让用户看到完成动画）
      setTimeout(() => {
        setIsExpanded(false)
      }, 500)
    } catch (error) {
      console.error('Sync all failed:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="border-t border-gray-200 bg-white">
      <CollapsibleHeader
        isExpanded={isExpanded}
        unsyncedCount={unsyncedCount}
        syncedCount={syncedCount}
        isSyncing={isSyncing}
        onToggle={() => setIsExpanded(!isExpanded)}
        onSyncAll={handleSyncAll}
      />

      {isExpanded && (
        <SyncItemList
          updates={allUpdates}
          onSync={onSyncField}
          onDiscard={onDiscardField}
        />
      )}
    </div>
  )
}
