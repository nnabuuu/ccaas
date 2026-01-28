import { useState } from 'react'
import type { LessonPlan, SyncField } from '../types'
import FormSection from './FormSection'
import ObjectivesEditor from './ObjectivesEditor'
import ActivitiesEditor from './ActivitiesEditor'

interface LessonPlanFormProps {
  lessonPlan: LessonPlan
  modifiedFields: Set<SyncField>
  canUndo: (field: SyncField) => boolean
  onUndo: (field: SyncField) => void
  onChange: <K extends keyof LessonPlan>(field: K, value: LessonPlan[K]) => void
}

export function LessonPlanForm({
  lessonPlan,
  modifiedFields,
  canUndo,
  onUndo,
  onChange,
}: LessonPlanFormProps) {
  // Track collapsed state for each section
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    basic: false,
    objectives: false,
    activities: false,
    assessment: true,
    differentiation: true,
  })

  const toggleSection = (section: string) => {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }))
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 scrollbar-thin">
      {/* Basic Information */}
      <FormSection
        title="基本信息"
        collapsed={collapsed.basic}
        onToggle={() => toggleSection('basic')}
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
              className={`input-field ${modifiedFields.has('title') ? 'ai-modified' : ''}`}
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
              className={`input-field ${modifiedFields.has('subject') ? 'ai-modified' : ''}`}
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
              className={`input-field ${modifiedFields.has('gradeLevel') ? 'ai-modified' : ''}`}
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
              className={`input-field ${modifiedFields.has('duration') ? 'ai-modified' : ''}`}
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
              className="input-field"
            >
              <option value="draft">草稿</option>
              <option value="review">审核中</option>
              <option value="published">已发布</option>
            </select>
          </div>
        </div>
      </FormSection>

      {/* Learning Objectives */}
      <FormSection
        title="教学目标"
        field="objectives"
        isModified={modifiedFields.has('objectives')}
        canUndo={canUndo('objectives')}
        onUndo={() => onUndo('objectives')}
        collapsed={collapsed.objectives}
        onToggle={() => toggleSection('objectives')}
      >
        <ObjectivesEditor
          objectives={lessonPlan.objectives}
          onChange={(objectives) => onChange('objectives', objectives)}
          isModified={modifiedFields.has('objectives')}
        />
      </FormSection>

      {/* Teaching Activities */}
      <FormSection
        title="教学活动"
        field="activities"
        isModified={modifiedFields.has('activities')}
        canUndo={canUndo('activities')}
        onUndo={() => onUndo('activities')}
        collapsed={collapsed.activities}
        onToggle={() => toggleSection('activities')}
      >
        <ActivitiesEditor
          activities={lessonPlan.activities}
          onChange={(activities) => onChange('activities', activities)}
          isModified={modifiedFields.has('activities')}
        />
      </FormSection>

      {/* Assessment */}
      <FormSection
        title="评估方式"
        field="assessment"
        isModified={modifiedFields.has('assessment')}
        canUndo={canUndo('assessment')}
        onUndo={() => onUndo('assessment')}
        collapsed={collapsed.assessment}
        onToggle={() => toggleSection('assessment')}
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
              className="textarea-field"
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
              className="textarea-field"
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
              className="textarea-field"
            />
          </div>
        </div>
      </FormSection>

      {/* Differentiation */}
      <FormSection
        title="差异化教学"
        field="differentiation"
        isModified={modifiedFields.has('differentiation')}
        canUndo={canUndo('differentiation')}
        onUndo={() => onUndo('differentiation')}
        collapsed={collapsed.differentiation}
        onToggle={() => toggleSection('differentiation')}
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
              className="textarea-field"
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
              className="textarea-field"
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
              className="textarea-field"
            />
          </div>
        </div>
      </FormSection>
    </div>
  )
}

export default LessonPlanForm
