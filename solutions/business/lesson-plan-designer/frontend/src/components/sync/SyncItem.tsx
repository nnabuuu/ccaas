import { ArrowsClockwise, X, Check } from '@phosphor-icons/react'
import type { PendingUpdateWithMeta } from '../../types'

export interface SyncItemProps {
  update: PendingUpdateWithMeta
  onSync: () => void
  onDiscard: () => void
}

// Field label mapping (中文名称)
const FIELD_LABELS: Record<string, string> = {
  title: '课程标题',
  subject: '科目',
  gradeLevel: '年级',
  durationMinutes: '课时',
  lessonPlanCode: '课程代码',
  objectives: '学习目标',
  content: '教学内容',
  teachingMethods: '教学方法',
  materialsNeeded: '教学材料',
  assessmentMethods: '评估方法',
  curriculumRequirements: '课程标准',
  studentAnalysis: '学情分析',
  extraProperties: '扩展属性',
  status: '状态',
  attachments: '附件',
}

// Field icon mapping (emoji)
const FIELD_ICONS: Record<string, string> = {
  title: '📝',
  subject: '📚',
  gradeLevel: '🎓',
  durationMinutes: '⏱️',
  lessonPlanCode: '🔢',
  objectives: '🎯',
  content: '📖',
  teachingMethods: '🧑‍🏫',
  materialsNeeded: '🧰',
  assessmentMethods: '📊',
  curriculumRequirements: '📋',
  studentAnalysis: '👥',
  extraProperties: '⚙️',
  status: '🏷️',
  attachments: '📎',
}

/**
 * SyncItem - 单个待同步字段行
 *
 * 显示：
 * - 字段图标
 * - 字段名称
 * - 预览内容
 * - 已同步/未同步状态
 * - Sync/Resync/Discard 按钮
 */
export function SyncItem({ update, onSync, onDiscard }: SyncItemProps) {
  const fieldLabel = FIELD_LABELS[update.field] || update.field
  const fieldIcon = FIELD_ICONS[update.field] || '📄'
  const isSynced = update.synced

  // 格式化预览文本（限制长度）
  const formatPreview = (preview: string): string => {
    if (preview.length > 60) {
      return preview.slice(0, 60) + '...'
    }
    return preview
  }

  // 格式化时间
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // 已同步状态（绿色）- 与 OutputUpdateCard 一致
  if (isSynced) {
    return (
      <div className="px-4 py-3 bg-green-50 rounded-lg border border-green-200 hover:bg-green-100 transition-colors">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 text-xl" title={fieldLabel}>
            {fieldIcon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Check size={16} weight="regular" className="text-green-600" />
              <span className="text-sm font-medium text-green-800">已同步 · {fieldLabel}</span>
            </div>
            {update.syncedAt && (
              <p className="text-xs text-green-600 mb-1">
                同步时间: {formatTime(update.syncedAt)}
              </p>
            )}
            <p className="text-xs text-green-700 truncate">{formatPreview(update.preview)}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onSync}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
              title="重新同步"
            >
              <ArrowsClockwise size={12} weight="regular" />
              重新同步
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 未同步状态（黄色）- 与 OutputUpdateCard 一致
  return (
    <div className="px-4 py-3 bg-yellow-50 rounded-lg border border-yellow-200 hover:bg-yellow-100 transition-colors">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 text-xl" title={fieldLabel}>
          {fieldIcon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-yellow-800">待同步 · {fieldLabel}</span>
          </div>
          <p className="text-xs text-yellow-700 truncate">{formatPreview(update.preview)}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onSync}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors"
            title="同步到表单"
          >
            <ArrowsClockwise size={12} weight="regular" />
            同步
          </button>

          <button
            onClick={onDiscard}
            className="p-1 text-yellow-600 hover:text-red-600 rounded transition-colors"
            title="忽略此更新"
          >
            <X size={16} weight="regular" />
          </button>
        </div>
      </div>
    </div>
  )
}
