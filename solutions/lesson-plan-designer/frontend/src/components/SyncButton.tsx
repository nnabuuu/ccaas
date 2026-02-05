import { OutputUpdateCard } from '@ccaas/react-sdk'
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
  durationMinutes: '课时',
  lessonPlanCode: '教案编号',
  objectives: '学习目标',
  content: '学习过程',
  teachingMethods: '教学方法',
  materialsNeeded: '课前准备',
  assessmentMethods: '作业检测',
  curriculumRequirements: '课程要求',
  studentAnalysis: '学情分析',
  extraProperties: '其他属性',
  status: '状态',
  attachments: '附件',
}

export function SyncButton({ field, preview, synced, syncedAt, onSync, onDiscard }: SyncButtonProps) {
  return (
    <OutputUpdateCard
      field={field}
      fieldLabel={FIELD_LABELS[field]}
      preview={preview}
      synced={synced}
      syncedAt={syncedAt}
      icon={field === 'attachments' ? 'attach' : 'sync'}
      syncLabel={field === 'attachments' ? '添加附件' : '同步到表单'}
      onSync={onSync}
      onDiscard={onDiscard}
    />
  )
}

export default SyncButton
