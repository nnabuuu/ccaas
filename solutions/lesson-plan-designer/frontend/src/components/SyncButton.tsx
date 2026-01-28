import type { SyncField } from '../types'

interface SyncButtonProps {
  field: SyncField
  preview: string
  synced?: boolean
  syncedAt?: Date
  onSync: () => void
  onDiscard: () => void
}

// Field labels in Chinese
const FIELD_LABELS: Record<SyncField, string> = {
  title: '标题',
  subject: '学科',
  gradeLevel: '年级',
  duration: '课时',
  publisher: '出版社',
  volume: '册别',
  chapterId: '章节ID',
  chapterTitle: '章节标题',
  objectives: '教学目标',
  standards: '课程标准',
  materials: '教学材料',
  activities: '教学活动',
  assessment: '评估方式',
  differentiation: '差异化教学',
}

export function SyncButton({ field, preview, synced, syncedAt, onSync, onDiscard }: SyncButtonProps) {
  // Format time as HH:MM:SS
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  if (synced) {
    return (
      <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              已同步到「{FIELD_LABELS[field]}」
            </p>
            {syncedAt && (
              <p className="text-xs text-green-600 mt-1">
                上次同步: {formatTime(syncedAt)}
              </p>
            )}
          </div>

          <button
            onClick={onSync}
            className="px-3 py-1.5 text-sm rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
          >
            重新同步
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
            建议更新「{FIELD_LABELS[field]}」
          </p>
          <p className="text-sm text-yellow-700 mt-1 truncate">
            {preview}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onSync}
            className="sync-button"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            同步到表单
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

export default SyncButton
