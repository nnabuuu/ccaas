import { useState } from 'react'
import type { LessonPlan, SyncField, LessonPlanStatus, CurriculumStandard } from '../types'
import EditorSection from './EditorSection'
import AttachmentCard from './AttachmentCard'
import api from '../utils/api'

// Grade level labels
const GRADE_LABELS: Record<number, string> = {
  1: '一年级', 2: '二年级', 3: '三年级',
  4: '四年级', 5: '五年级', 6: '六年级',
  7: '初一', 8: '初二', 9: '初三',
  10: '高一', 11: '高二', 12: '高三',
}

// Section definitions for the outline
export const OUTLINE_ITEMS = [
  { id: 'basic', label: '1. 基本信息' },
  { id: 'curriculumRequirements', label: '2. 课程要求' },
  { id: 'objectives', label: '3. 学习目标' },
  { id: 'studentAnalysis', label: '4. 学情分析' },
  { id: 'materialsNeeded', label: '5. 课前准备' },
  { id: 'content', label: '6. 学习过程' },
  { id: 'assessmentMethods', label: '7. 作业检测' },
  { id: 'teachingMethods', label: '8. 教学方法' },
  { id: 'extraProperties', label: '9. 其他' },
  { id: 'attachments', label: '10. 附件' },
] as const

export type SectionId = typeof OUTLINE_ITEMS[number]['id']

// Content section config
const CONTENT_SECTIONS: Array<{
  id: SyncField
  title: string
  placeholder: string
  rows: number
}> = [
  { id: 'objectives', title: '学习目标', placeholder: '输入学习目标...', rows: 6 },
  { id: 'studentAnalysis', title: '学情分析', placeholder: '输入学情分析...', rows: 4 },
  { id: 'materialsNeeded', title: '课前准备', placeholder: '输入课前准备...', rows: 4 },
  { id: 'content', title: '学习过程', placeholder: '输入学习过程...', rows: 10 },
  { id: 'assessmentMethods', title: '作业检测', placeholder: '输入作业检测...', rows: 4 },
  { id: 'teachingMethods', title: '教学方法', placeholder: '输入教学方法...', rows: 4 },
]

/**
 * CurriculumStandards list display
 */
function CurriculumStandardsList({
  standards,
  onRemove,
}: {
  standards: CurriculumStandard[]
  onRemove?: (id: number) => void
}) {
  if (standards.length === 0) {
    return (
      <p className="text-sm text-gray-400">暂无课程要求，请使用AI助手查询并添加</p>
    )
  }

  return (
    <div className="space-y-2">
      {standards.map((s) => (
        <div
          key={s.id}
          className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg group"
        >
          <div className="flex-shrink-0 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-mono rounded">
            {s.standardCode}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800">{s.title}</p>
            <div className="flex gap-2 mt-1">
              <span className="text-xs text-gray-500">{s.stage}</span>
              <span className="text-xs text-gray-400">|</span>
              <span className="text-xs text-gray-500">{s.standardType}</span>
              <span className="text-xs text-gray-400">|</span>
              <span className="text-xs text-gray-500">{s.contentDomain}</span>
            </div>
          </div>
          {onRemove && (
            <button
              onClick={() => onRemove(s.id)}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 p-1"
              title="删除"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

interface LessonPlanContentProps {
  lessonPlan: LessonPlan
  modifiedFields: Set<SyncField>
  editingSections: Set<string>
  savingSections: Set<string>
  canUndo: (field: SyncField) => boolean
  onUndo: (field: SyncField) => void
  onChange: <K extends keyof LessonPlan>(field: K, value: LessonPlan[K]) => void
  onStartEdit: (sectionId: string) => void
  onSaveEdit: (sectionId: string) => void
  onCancelEdit: (sectionId: string) => void
  onAiAssist?: (sectionId: string) => void
}

/**
 * ExtraProperties key-value editor
 */
function ExtraPropertiesEditor({
  extraProperties,
  onChange,
  disabled,
}: {
  extraProperties: Record<string, string>
  onChange: (props: Record<string, string>) => void
  disabled: boolean
}) {
  const [newKey, setNewKey] = useState('')
  const entries = Object.entries(extraProperties)

  const handleAdd = () => {
    const key = newKey.trim()
    if (!key || key in extraProperties) return
    onChange({ ...extraProperties, [key]: '' })
    setNewKey('')
  }

  const handleRemove = (key: string) => {
    const next = { ...extraProperties }
    delete next[key]
    onChange(next)
  }

  const handleValueChange = (key: string, value: string) => {
    onChange({ ...extraProperties, [key]: value })
  }

  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => (
        <div key={key} className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">{key}</span>
            {!disabled && (
              <button
                onClick={() => handleRemove(key)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                删除
              </button>
            )}
          </div>
          <textarea
            value={value}
            onChange={(e) => handleValueChange(key, e.target.value)}
            disabled={disabled}
            rows={3}
            className={`textarea-field ${disabled ? 'bg-gray-50' : ''}`}
          />
        </div>
      ))}

      {!disabled && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="添加新属性名..."
            className="input-field flex-1"
          />
          <button
            onClick={handleAdd}
            disabled={!newKey.trim()}
            className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            添加
          </button>
        </div>
      )}

      {entries.length === 0 && disabled && (
        <p className="text-sm text-gray-400">暂无额外属性</p>
      )}
    </div>
  )
}

/**
 * LessonPlanContent - Main content area with editable sections.
 */
export function LessonPlanContent({
  lessonPlan,
  modifiedFields,
  editingSections,
  savingSections,
  canUndo,
  onUndo,
  onChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onAiAssist,
}: LessonPlanContentProps) {
  const isEditing = (sectionId: string) => editingSections.has(sectionId)
  const isSaving = (sectionId: string) => savingSections.has(sectionId)

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Basic Information */}
      <EditorSection
        id="basic"
        title="基本信息"
        isEditing={isEditing('basic')}
        isSaving={isSaving('basic')}
        onStartEdit={() => onStartEdit('basic')}
        onSave={() => onSaveEdit('basic')}
        onCancel={() => onCancelEdit('basic')}
        onAiAssist={onAiAssist ? () => onAiAssist('basic') : undefined}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Title */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              课程标题
            </label>
            <input
              type="text"
              value={lessonPlan.title}
              onChange={(e) => onChange('title', e.target.value)}
              placeholder="输入课程标题"
              disabled={!isEditing('basic')}
              className={`input-field ${modifiedFields.has('title') ? 'ai-modified' : ''} ${!isEditing('basic') ? 'bg-gray-50' : ''}`}
            />
          </div>

          {/* Lesson Plan Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              教案编号
            </label>
            <input
              type="text"
              value={lessonPlan.lessonPlanCode || ''}
              onChange={(e) => onChange('lessonPlanCode', e.target.value || null)}
              placeholder="教案编号（可选）"
              disabled={!isEditing('basic')}
              className={`input-field ${modifiedFields.has('lessonPlanCode') ? 'ai-modified' : ''} ${!isEditing('basic') ? 'bg-gray-50' : ''}`}
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              学科
            </label>
            <select
              value={lessonPlan.subject}
              onChange={(e) => onChange('subject', e.target.value)}
              disabled={!isEditing('basic')}
              className={`input-field ${modifiedFields.has('subject') ? 'ai-modified' : ''} ${!isEditing('basic') ? 'bg-gray-50' : ''}`}
            >
              <option value="">选择学科</option>
              <option value="语文">语文</option>
              <option value="数学">数学</option>
              <option value="英语">英语</option>
              <option value="物理">物理</option>
              <option value="化学">化学</option>
              <option value="生物">生物</option>
              <option value="历史">历史</option>
              <option value="地理">地理</option>
              <option value="政治">政治</option>
              <option value="音乐">音乐</option>
              <option value="美术">美术</option>
              <option value="体育">体育</option>
              <option value="信息技术">信息技术</option>
            </select>
          </div>

          {/* Grade Level (1-12 select) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              年级
            </label>
            <select
              value={lessonPlan.gradeLevel}
              onChange={(e) => onChange('gradeLevel', Number(e.target.value))}
              disabled={!isEditing('basic')}
              className={`input-field ${modifiedFields.has('gradeLevel') ? 'ai-modified' : ''} ${!isEditing('basic') ? 'bg-gray-50' : ''}`}
            >
              {Object.entries(GRADE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Duration Minutes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              课时（分钟）
            </label>
            <input
              type="number"
              value={lessonPlan.durationMinutes}
              onChange={(e) => onChange('durationMinutes', Number(e.target.value) || 45)}
              min={1}
              max={600}
              disabled={!isEditing('basic')}
              className={`input-field ${modifiedFields.has('durationMinutes') ? 'ai-modified' : ''} ${!isEditing('basic') ? 'bg-gray-50' : ''}`}
            />
          </div>

          {/* Publisher (read-only, set at creation) */}
          {lessonPlan.publisher && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                出版社
              </label>
              <input
                type="text"
                value={lessonPlan.publisher}
                disabled
                className="input-field bg-gray-50"
              />
            </div>
          )}

          {/* Volume (read-only, set at creation) */}
          {lessonPlan.volume && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                册别
              </label>
              <input
                type="text"
                value={lessonPlan.volume}
                disabled
                className="input-field bg-gray-50"
              />
            </div>
          )}

          {/* Chapter (read-only, set at creation) */}
          {lessonPlan.chapterTitle && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                章节
              </label>
              <input
                type="text"
                value={lessonPlan.chapterTitle}
                disabled
                className="input-field bg-gray-50"
              />
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              状态
            </label>
            <select
              value={lessonPlan.status}
              onChange={(e) => onChange('status', e.target.value as LessonPlanStatus)}
              disabled={!isEditing('basic')}
              className={`input-field ${!isEditing('basic') ? 'bg-gray-50' : ''}`}
            >
              <option value="DRAFT">草稿</option>
              <option value="PUBLISHED">已发布</option>
              <option value="ARCHIVED">已归档</option>
            </select>
          </div>
        </div>
      </EditorSection>

      {/* Curriculum Requirements (structured array) */}
      <EditorSection
        id="curriculumRequirements"
        title="课程要求"
        isEditing={false}
        isSaving={isSaving('curriculumRequirements')}
        isModified={modifiedFields.has('curriculumRequirements')}
        canUndo={canUndo('curriculumRequirements')}
        onUndo={() => onUndo('curriculumRequirements')}
        onStartEdit={() => {}}
        onSave={() => {}}
        onCancel={() => {}}
        onAiAssist={onAiAssist ? () => onAiAssist('curriculumRequirements') : undefined}
      >
        <CurriculumStandardsList
          standards={lessonPlan.curriculumRequirements}
          onRemove={(id) => {
            const updated = lessonPlan.curriculumRequirements.filter(s => s.id !== id)
            onChange('curriculumRequirements', updated)
          }}
        />
      </EditorSection>

      {/* Content Sections (6 plain-text sections) */}
      {CONTENT_SECTIONS.map((section) => (
        <EditorSection
          key={section.id}
          id={section.id}
          title={section.title}
          isEditing={isEditing(section.id)}
          isSaving={isSaving(section.id)}
          isModified={modifiedFields.has(section.id)}
          canUndo={canUndo(section.id)}
          onUndo={() => onUndo(section.id)}
          onStartEdit={() => onStartEdit(section.id)}
          onSave={() => onSaveEdit(section.id)}
          onCancel={() => onCancelEdit(section.id)}
          onAiAssist={onAiAssist ? () => onAiAssist(section.id) : undefined}
        >
          <textarea
            value={(lessonPlan[section.id as keyof LessonPlan] as string | null) || ''}
            onChange={(e) => onChange(section.id as keyof LessonPlan, e.target.value as never)}
            placeholder={section.placeholder}
            rows={section.rows}
            disabled={!isEditing(section.id)}
            className={`textarea-field w-full ${modifiedFields.has(section.id) ? 'ai-modified' : ''} ${!isEditing(section.id) ? 'bg-gray-50' : ''}`}
          />
        </EditorSection>
      ))}

      {/* Extra Properties */}
      <EditorSection
        id="extraProperties"
        title="其他"
        isEditing={isEditing('extraProperties')}
        isSaving={isSaving('extraProperties')}
        isModified={modifiedFields.has('extraProperties')}
        canUndo={canUndo('extraProperties')}
        onUndo={() => onUndo('extraProperties')}
        onStartEdit={() => onStartEdit('extraProperties')}
        onSave={() => onSaveEdit('extraProperties')}
        onCancel={() => onCancelEdit('extraProperties')}
        onAiAssist={onAiAssist ? () => onAiAssist('extraProperties') : undefined}
      >
        <ExtraPropertiesEditor
          extraProperties={lessonPlan.extraProperties}
          onChange={(props) => onChange('extraProperties', props)}
          disabled={!isEditing('extraProperties')}
        />
      </EditorSection>

      {/* Attachments */}
      {lessonPlan.attachments && lessonPlan.attachments.length > 0 && (
        <EditorSection
          id="attachments"
          title="附件"
          isEditing={false}
          isSaving={false}
          isModified={false}
          canUndo={false}
          onStartEdit={() => {}}
          onSave={() => {}}
          onCancel={() => {}}
        >
          <div className="space-y-3">
            {lessonPlan.attachments.map((attachment) => (
              <AttachmentCard
                key={attachment.id}
                attachment={attachment}
                onRemove={async (id) => {
                  try {
                    // Call API to delete attachment from backend
                    const updatedPlan = await api.removeAttachment(lessonPlan.id, id)
                    // Update local state with response from backend
                    onChange('attachments', updatedPlan.attachments as never)
                  } catch (error) {
                    console.error('Failed to remove attachment:', error)
                    // TODO: Show error toast to user
                    alert('删除附件失败，请重试')
                  }
                }}
              />
            ))}
          </div>
        </EditorSection>
      )}
    </div>
  )
}

export default LessonPlanContent
