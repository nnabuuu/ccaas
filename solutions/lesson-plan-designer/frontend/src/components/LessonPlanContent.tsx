import type { LessonPlan, SyncField } from '../types'
import EditorSection from './EditorSection'
import ObjectivesEditor from './ObjectivesEditor'
import ActivitiesEditor from './ActivitiesEditor'

// Section definitions for the outline
export const OUTLINE_ITEMS = [
  { id: 'basic', label: '1. 基本信息' },
  { id: 'objectives', label: '2. 教学目标' },
  { id: 'activities', label: '3. 教学活动' },
  { id: 'assessment', label: '4. 评估方式' },
  { id: 'differentiation', label: '5. 差异化教学' },
] as const

export type SectionId = typeof OUTLINE_ITEMS[number]['id']

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
 * LessonPlanContent - Main content area with editable sections.
 * Each section has independent edit/save/cancel controls.
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

          {/* Grade Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              年级
            </label>
            <select
              value={lessonPlan.gradeLevel}
              onChange={(e) => onChange('gradeLevel', e.target.value)}
              disabled={!isEditing('basic')}
              className={`input-field ${modifiedFields.has('gradeLevel') ? 'ai-modified' : ''} ${!isEditing('basic') ? 'bg-gray-50' : ''}`}
            >
              <option value="">选择年级</option>
              <option value="一年级">一年级</option>
              <option value="二年级">二年级</option>
              <option value="三年级">三年级</option>
              <option value="四年级">四年级</option>
              <option value="五年级">五年级</option>
              <option value="六年级">六年级</option>
              <option value="初一">初一</option>
              <option value="初二">初二</option>
              <option value="初三">初三</option>
              <option value="高一">高一</option>
              <option value="高二">高二</option>
              <option value="高三">高三</option>
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              课时
            </label>
            <select
              value={lessonPlan.duration}
              onChange={(e) => onChange('duration', e.target.value)}
              disabled={!isEditing('basic')}
              className={`input-field ${modifiedFields.has('duration') ? 'ai-modified' : ''} ${!isEditing('basic') ? 'bg-gray-50' : ''}`}
            >
              <option value="">选择课时</option>
              <option value="1课时（40分钟）">1课时（40分钟）</option>
              <option value="1课时（45分钟）">1课时（45分钟）</option>
              <option value="2课时">2课时</option>
              <option value="3课时">3课时</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              状态
            </label>
            <select
              value={lessonPlan.status}
              onChange={(e) => onChange('status', e.target.value as LessonPlan['status'])}
              disabled={!isEditing('basic')}
              className={`input-field ${!isEditing('basic') ? 'bg-gray-50' : ''}`}
            >
              <option value="draft">草稿</option>
              <option value="review">审核中</option>
              <option value="published">已发布</option>
            </select>
          </div>
        </div>
      </EditorSection>

      {/* Learning Objectives */}
      <EditorSection
        id="objectives"
        title="教学目标"
        isEditing={isEditing('objectives')}
        isSaving={isSaving('objectives')}
        isModified={modifiedFields.has('objectives')}
        canUndo={canUndo('objectives')}
        onUndo={() => onUndo('objectives')}
        onStartEdit={() => onStartEdit('objectives')}
        onSave={() => onSaveEdit('objectives')}
        onCancel={() => onCancelEdit('objectives')}
        onAiAssist={onAiAssist ? () => onAiAssist('objectives') : undefined}
      >
        <ObjectivesEditor
          objectives={lessonPlan.objectives}
          onChange={(objectives) => onChange('objectives', objectives)}
          isModified={modifiedFields.has('objectives')}
        />
      </EditorSection>

      {/* Teaching Activities */}
      <EditorSection
        id="activities"
        title="教学活动"
        isEditing={isEditing('activities')}
        isSaving={isSaving('activities')}
        isModified={modifiedFields.has('activities')}
        canUndo={canUndo('activities')}
        onUndo={() => onUndo('activities')}
        onStartEdit={() => onStartEdit('activities')}
        onSave={() => onSaveEdit('activities')}
        onCancel={() => onCancelEdit('activities')}
        onAiAssist={onAiAssist ? () => onAiAssist('activities') : undefined}
      >
        <ActivitiesEditor
          activities={lessonPlan.activities}
          onChange={(activities) => onChange('activities', activities)}
          isModified={modifiedFields.has('activities')}
        />
      </EditorSection>

      {/* Assessment */}
      <EditorSection
        id="assessment"
        title="评估方式"
        isEditing={isEditing('assessment')}
        isSaving={isSaving('assessment')}
        isModified={modifiedFields.has('assessment')}
        canUndo={canUndo('assessment')}
        onUndo={() => onUndo('assessment')}
        onStartEdit={() => onStartEdit('assessment')}
        onSave={() => onSaveEdit('assessment')}
        onCancel={() => onCancelEdit('assessment')}
        onAiAssist={onAiAssist ? () => onAiAssist('assessment') : undefined}
      >
        <div className="space-y-4">
          {/* Formative Assessment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              形成性评估
            </label>
            <textarea
              value={lessonPlan.assessment.formative.join('\n')}
              onChange={(e) => onChange('assessment', {
                ...lessonPlan.assessment,
                formative: e.target.value.split('\n').filter(s => s.trim()),
              })}
              placeholder="每行一项评估方式..."
              rows={3}
              disabled={!isEditing('assessment')}
              className={`textarea-field ${!isEditing('assessment') ? 'bg-gray-50' : ''}`}
            />
          </div>

          {/* Summative Assessment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              总结性评估
            </label>
            <textarea
              value={lessonPlan.assessment.summative.join('\n')}
              onChange={(e) => onChange('assessment', {
                ...lessonPlan.assessment,
                summative: e.target.value.split('\n').filter(s => s.trim()),
              })}
              placeholder="每行一项评估方式..."
              rows={3}
              disabled={!isEditing('assessment')}
              className={`textarea-field ${!isEditing('assessment') ? 'bg-gray-50' : ''}`}
            />
          </div>

          {/* Rubric */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              评分标准
            </label>
            <textarea
              value={lessonPlan.assessment.rubric || ''}
              onChange={(e) => onChange('assessment', {
                ...lessonPlan.assessment,
                rubric: e.target.value,
              })}
              placeholder="描述评分标准..."
              rows={2}
              disabled={!isEditing('assessment')}
              className={`textarea-field ${!isEditing('assessment') ? 'bg-gray-50' : ''}`}
            />
          </div>
        </div>
      </EditorSection>

      {/* Differentiation */}
      <EditorSection
        id="differentiation"
        title="差异化教学"
        isEditing={isEditing('differentiation')}
        isSaving={isSaving('differentiation')}
        isModified={modifiedFields.has('differentiation')}
        canUndo={canUndo('differentiation')}
        onUndo={() => onUndo('differentiation')}
        onStartEdit={() => onStartEdit('differentiation')}
        onSave={() => onSaveEdit('differentiation')}
        onCancel={() => onCancelEdit('differentiation')}
        onAiAssist={onAiAssist ? () => onAiAssist('differentiation') : undefined}
      >
        <div className="space-y-4">
          {/* Struggling */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              学困生支持
            </label>
            <textarea
              value={lessonPlan.differentiation.struggling.join('\n')}
              onChange={(e) => onChange('differentiation', {
                ...lessonPlan.differentiation,
                struggling: e.target.value.split('\n').filter(s => s.trim()),
              })}
              placeholder="每行一项支持策略..."
              rows={2}
              disabled={!isEditing('differentiation')}
              className={`textarea-field ${!isEditing('differentiation') ? 'bg-gray-50' : ''}`}
            />
          </div>

          {/* On Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              普通学生
            </label>
            <textarea
              value={lessonPlan.differentiation.onLevel.join('\n')}
              onChange={(e) => onChange('differentiation', {
                ...lessonPlan.differentiation,
                onLevel: e.target.value.split('\n').filter(s => s.trim()),
              })}
              placeholder="每行一项教学策略..."
              rows={2}
              disabled={!isEditing('differentiation')}
              className={`textarea-field ${!isEditing('differentiation') ? 'bg-gray-50' : ''}`}
            />
          </div>

          {/* Advanced */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              优秀学生拓展
            </label>
            <textarea
              value={lessonPlan.differentiation.advanced.join('\n')}
              onChange={(e) => onChange('differentiation', {
                ...lessonPlan.differentiation,
                advanced: e.target.value.split('\n').filter(s => s.trim()),
              })}
              placeholder="每行一项拓展策略..."
              rows={2}
              disabled={!isEditing('differentiation')}
              className={`textarea-field ${!isEditing('differentiation') ? 'bg-gray-50' : ''}`}
            />
          </div>
        </div>
      </EditorSection>
    </div>
  )
}

export default LessonPlanContent
