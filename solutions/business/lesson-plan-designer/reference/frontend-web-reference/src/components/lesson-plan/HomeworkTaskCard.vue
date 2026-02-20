<script setup lang="ts">
/**
 * HomeworkTaskCard - Comprehensive homework task card with GRASPS authenticity design
 *
 * Expandable card supporting task metadata, linked objectives, evaluation criteria,
 * and optional GRASPS authenticity framework (Situation, Role, Audience, Product).
 *
 * @example
 * <HomeworkTaskCard :task="task" :index="0" :available-objectives="objectives" @update="handleUpdate" />
 */
import { ref, computed, type PropType } from 'vue'
import type { HomeworkTask, LearningObjective, HomeworkTaskAuthenticity } from '@/types'

const props = defineProps({
  task: { type: Object as PropType<HomeworkTask>, required: true },
  index: { type: Number, required: true },
  availableObjectives: { type: Array as PropType<LearningObjective[]>, default: () => [] },
  readonly: { type: Boolean, default: false },
  canMoveUp: { type: Boolean, default: false },
  canMoveDown: { type: Boolean, default: false }
})

const emit = defineEmits<{
  update: [task: HomeworkTask]
  remove: []
  move: [direction: number]
}>()

const isExpanded = ref(true)
const showAdvanced = ref(false)
const showAuthenticity = ref(false)

const taskLevels = [
  { value: 'basic', label: '基础', color: '#10b981' },
  { value: 'proficient', label: '熟练', color: '#3b82f6' },
  { value: 'advanced', label: '拓展', color: '#8b5cf6' }
]

const taskTypes = [
  { value: 'practice', label: '练习', icon: '📝' },
  { value: 'application', label: '应用', icon: '🎯' },
  { value: 'inquiry', label: '探究', icon: '🔍' },
  { value: 'creation', label: '创作', icon: '💡' }
]

const currentLevel = computed(() => {
  return taskLevels.find(l => l.value === props.task.level) || taskLevels[0]
})

const currentType = computed(() => {
  return taskTypes.find(t => t.value === props.task.type) || taskTypes[0]
})

const updateField = <K extends keyof HomeworkTask>(field: K, value: HomeworkTask[K]) => {
  emit('update', { ...props.task, [field]: value })
}

const toggleObjective = (objId: number) => {
  const current = props.task.linkedObjectives || []
  const updated = current.includes(objId)
    ? current.filter(id => id !== objId)
    : [...current, objId]
  updateField('linkedObjectives', updated)
}

const isObjectiveLinked = (objId: number): boolean => {
  return (props.task.linkedObjectives || []).includes(objId)
}

const getObjectiveLabel = (objId: number): string => {
  const obj = props.availableObjectives.find(o => o.id === objId)
  return obj ? obj.content : `目标 ${objId}`
}

const updateAuthenticity = (field: keyof HomeworkTaskAuthenticity, value: string) => {
  const current: HomeworkTaskAuthenticity = props.task.authenticity || { scenario: '', role: '', audience: '', product: '' }
  emit('update', {
    ...props.task,
    authenticity: { ...current, [field]: value }
  })
}

const hasAuthenticity = computed(() => {
  const auth = props.task.authenticity
  return auth && (auth.scenario || auth.role || auth.audience || auth.product)
})

// Check if advanced options have non-default values
const hasAdvancedValues = computed(() => {
  const t = props.task
  // Default values: type='practice', level='basic', isRequired=true, estimatedTime=10
  const hasCustomType = t.type && t.type !== 'practice'
  const hasCustomLevel = t.level && t.level !== 'basic'
  const hasOptional = t.isRequired === false
  const hasCustomTime = t.estimatedTime && t.estimatedTime !== 10
  return hasCustomType || hasCustomLevel || hasOptional || hasCustomTime || hasAuthenticity.value
})
</script>

<template>
  <div
    class="homework-task-card"
    :class="{
      'is-collapsed': !isExpanded,
      'is-optional': !task.isRequired,
      'is-readonly': readonly
    }"
  >
    <!-- Card Header -->
    <div class="card-header" @click="isExpanded = !isExpanded">
      <div class="header-left">
        <span class="task-index">{{ index + 1 }}</span>
        <span
          class="level-badge"
          :style="{ backgroundColor: currentLevel.color + '20', color: currentLevel.color }"
        >
          {{ currentLevel.label }}
        </span>
        <span class="type-badge">
          {{ currentType.icon }} {{ currentType.label }}
        </span>
        <span v-if="!task.isRequired" class="optional-badge">选做</span>
      </div>

      <div class="header-center">
        <span class="task-name">{{ task.name || '未命名任务' }}</span>
      </div>

      <div class="header-right">
        <span class="task-time">{{ task.estimatedTime || 0 }} 分钟</span>
        <button class="btn-toggle" :class="{ 'is-expanded': isExpanded }">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Card Body -->
    <div v-show="isExpanded" class="card-body">
      <!-- Basic Info: Name + Description only -->
      <div class="form-group">
        <label>任务名称</label>
        <input
          v-if="!readonly"
          type="text"
          :value="task.name"
          @input="updateField('name', ($event.target as HTMLInputElement).value)"
          placeholder="输入任务名称"
          class="form-input"
        />
        <div v-else class="form-value">{{ task.name || '未命名' }}</div>
      </div>

      <!-- Description -->
      <div class="form-group">
        <label>任务描述</label>
        <textarea
          v-if="!readonly"
          :value="task.description"
          @input="updateField('description', ($event.target as HTMLTextAreaElement).value)"
          placeholder="详细描述任务内容和要求（支持 Markdown 格式）"
          rows="3"
          class="form-textarea"
        />
        <div v-else class="form-value description-text">
          {{ task.description || '暂无描述' }}
        </div>
      </div>

      <!-- Advanced Options Section (Collapsible) -->
      <div class="advanced-section">
        <button
          v-if="!readonly"
          class="advanced-toggle"
          @click="showAdvanced = !showAdvanced"
          :class="{ 'has-content': hasAdvancedValues }"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v4m0 14v4m11-11h-4M5 12H1m16.95 6.95l-2.83-2.83M8.88 8.88L6.05 6.05m12.9 0l-2.83 2.83M8.88 15.12l-2.83 2.83"/>
          </svg>
          高级选项
          <span v-if="hasAdvancedValues" class="has-badge">已配置</span>
          <svg
            class="toggle-icon"
            :class="{ rotated: showAdvanced }"
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <!-- Show advanced summary in readonly mode if has values -->
        <div v-if="readonly && hasAdvancedValues" class="advanced-summary">
          <span class="summary-item" v-if="task.estimatedTime">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            {{ task.estimatedTime }} 分钟
          </span>
          <span
            class="summary-item level-badge-inline"
            :style="{ backgroundColor: currentLevel.color + '20', color: currentLevel.color }"
          >
            {{ currentLevel.label }}
          </span>
          <span class="summary-item">{{ currentType.icon }} {{ currentType.label }}</span>
          <span v-if="!task.isRequired" class="summary-item optional-inline">选做</span>
        </div>

        <div v-show="showAdvanced && !readonly" class="advanced-content">
          <div class="form-row">
            <div class="form-group">
              <label>预计时间</label>
              <div class="time-input-wrapper">
                <input
                  type="number"
                  :value="task.estimatedTime"
                  @input="updateField('estimatedTime', parseInt(($event.target as HTMLInputElement).value) || 0)"
                  min="1"
                  max="120"
                  class="form-input time-input"
                />
                <span class="time-unit">分钟</span>
              </div>
            </div>
            <div class="form-group">
              <label>难度层次</label>
              <select
                :value="task.level"
                @change="updateField('level', ($event.target as HTMLSelectElement).value)"
                class="form-select"
              >
                <option v-for="level in taskLevels" :key="level.value" :value="level.value">
                  {{ level.label }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>任务类型</label>
              <select
                :value="task.type"
                @change="updateField('type', ($event.target as HTMLSelectElement).value)"
                class="form-select"
              >
                <option v-for="type in taskTypes" :key="type.value" :value="type.value">
                  {{ type.icon }} {{ type.label }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>必做/选做</label>
              <div class="toggle-wrapper">
                <button
                  class="toggle-btn"
                  :class="{ active: task.isRequired }"
                  @click="updateField('isRequired', true)"
                >必做</button>
                <button
                  class="toggle-btn"
                  :class="{ active: !task.isRequired }"
                  @click="updateField('isRequired', false)"
                >选做</button>
              </div>
            </div>
          </div>

          <!-- Linked Objectives -->
          <div class="form-group" v-if="availableObjectives.length > 0">
            <label>关联学习目标</label>
            <div class="objectives-selector">
              <button
                v-for="obj in availableObjectives"
                :key="obj.id"
                class="objective-tag"
                :class="{ selected: isObjectiveLinked(obj.id) }"
                @click="toggleObjective(obj.id)"
              >
                {{ obj.content.substring(0, 30) }}{{ obj.content.length > 30 ? '...' : '' }}
              </button>
            </div>
          </div>

          <!-- Criteria -->
          <div class="form-group">
            <label>评价标准</label>
            <textarea
              :value="task.criteria"
              @input="updateField('criteria', ($event.target as HTMLTextAreaElement).value)"
              placeholder="描述成功完成此任务的标准，可包含量规（支持 Markdown 格式）"
              rows="2"
              class="form-textarea"
            />
          </div>

          <!-- Authenticity Section (Nested Collapsible) -->
          <div class="authenticity-section">
            <button
              class="authenticity-toggle"
              @click="showAuthenticity = !showAuthenticity"
              :class="{ 'has-content': hasAuthenticity }"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4"/>
                <path d="M12 8h.01"/>
              </svg>
              真实性设计 (GRASPS)
              <span v-if="hasAuthenticity" class="has-badge">已填写</span>
              <svg
                class="toggle-icon"
                :class="{ rotated: showAuthenticity }"
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            <div v-show="showAuthenticity" class="authenticity-content">
              <div class="form-row">
                <div class="form-group flex-2">
                  <label>情境 (Situation)</label>
                  <input
                    type="text"
                    :value="task.authenticity?.scenario || ''"
                    @input="updateAuthenticity('scenario', ($event.target as HTMLInputElement).value)"
                    placeholder="任务发生的真实情境"
                    class="form-input"
                  />
                </div>
                <div class="form-group">
                  <label>角色 (Role)</label>
                  <input
                    type="text"
                    :value="task.authenticity?.role || ''"
                    @input="updateAuthenticity('role', ($event.target as HTMLInputElement).value)"
                    placeholder="学生扮演的角色"
                    class="form-input"
                  />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>受众 (Audience)</label>
                  <input
                    type="text"
                    :value="task.authenticity?.audience || ''"
                    @input="updateAuthenticity('audience', ($event.target as HTMLInputElement).value)"
                    placeholder="作品的目标受众"
                    class="form-input"
                  />
                </div>
                <div class="form-group">
                  <label>成果 (Product)</label>
                  <input
                    type="text"
                    :value="task.authenticity?.product || ''"
                    @input="updateAuthenticity('product', ($event.target as HTMLInputElement).value)"
                    placeholder="最终成果形式"
                    class="form-input"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Readonly: Show linked objectives and criteria if present -->
      <div v-if="readonly && task.linkedObjectives?.length" class="form-group">
        <label>关联学习目标</label>
        <div class="linked-objectives-display">
          <span
            v-for="objId in task.linkedObjectives"
            :key="objId"
            class="objective-tag selected"
          >
            {{ getObjectiveLabel(objId).substring(0, 30) }}
          </span>
        </div>
      </div>

      <div v-if="readonly && task.criteria" class="form-group">
        <label>评价标准</label>
        <div class="form-value criteria-text">{{ task.criteria }}</div>
      </div>

      <!-- Readonly: Show authenticity if present -->
      <div v-if="readonly && hasAuthenticity" class="authenticity-readonly">
        <label>真实性设计</label>
        <div class="authenticity-grid">
          <div v-if="task.authenticity?.scenario" class="auth-item">
            <span class="auth-label">情境:</span> {{ task.authenticity.scenario }}
          </div>
          <div v-if="task.authenticity?.role" class="auth-item">
            <span class="auth-label">角色:</span> {{ task.authenticity.role }}
          </div>
          <div v-if="task.authenticity?.audience" class="auth-item">
            <span class="auth-label">受众:</span> {{ task.authenticity.audience }}
          </div>
          <div v-if="task.authenticity?.product" class="auth-item">
            <span class="auth-label">成果:</span> {{ task.authenticity.product }}
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div v-if="!readonly" class="card-actions">
        <div class="move-buttons">
          <button
            class="btn-move"
            :disabled="!canMoveUp"
            @click.stop="emit('move', -1)"
            title="上移"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="18 15 12 9 6 15"/>
            </svg>
          </button>
          <button
            class="btn-move"
            :disabled="!canMoveDown"
            @click.stop="emit('move', 1)"
            title="下移"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
        <button class="btn-delete" @click.stop="emit('remove')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          删除
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.homework-task-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s;
}

.homework-task-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.homework-task-card.is-optional {
  border-style: dashed;
}

.card-header {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  background: #f8fafc;
  cursor: pointer;
  user-select: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-index {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.level-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.type-badge {
  padding: 2px 8px;
  background: #f1f5f9;
  color: #64748b;
  border-radius: 12px;
  font-size: 11px;
}

.optional-badge {
  padding: 2px 8px;
  background: #fef3c7;
  color: #d97706;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.header-center {
  flex: 1;
  margin: 0 16px;
}

.task-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 14px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.task-time {
  font-size: 13px;
  color: #64748b;
}

.btn-toggle {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.btn-toggle.is-expanded {
  transform: rotate(180deg);
}

.card-body {
  padding: 16px;
  border-top: 1px solid #e2e8f0;
}

.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.form-group {
  flex: 1;
}

.form-group.flex-2 {
  flex: 2;
}

.form-group label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 6px;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

.form-textarea {
  resize: vertical;
  font-family: inherit;
}

.form-value {
  font-size: 13px;
  color: #334155;
  padding: 8px 0;
}

.description-text,
.criteria-text {
  white-space: pre-wrap;
  line-height: 1.6;
}

.time-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-input {
  width: 80px;
}

.time-unit {
  font-size: 13px;
  color: #64748b;
}

.toggle-wrapper {
  display: flex;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.toggle-btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  background: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn.active {
  background: #3b82f6;
  color: white;
}

.toggle-btn:not(.active):hover {
  background: #f1f5f9;
}

.objectives-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.objective-tag {
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: white;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.objective-tag:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.objective-tag.selected {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #2563eb;
}

.linked-objectives-display {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.no-link {
  font-size: 12px;
  color: #94a3b8;
  font-style: italic;
}

/* Advanced Section */
.advanced-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

.advanced-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 13px;
  cursor: pointer;
  padding: 6px 0;
}

.advanced-toggle:hover {
  color: #64748b;
}

.advanced-toggle.has-content {
  color: #3b82f6;
}

.advanced-content {
  margin-top: 12px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.advanced-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 0;
}

.summary-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #f1f5f9;
  border-radius: 12px;
  font-size: 12px;
  color: #64748b;
}

.level-badge-inline {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.optional-inline {
  background: #fef3c7;
  color: #d97706;
}

.authenticity-section {
  margin-top: 16px;
  border-top: 1px solid #e2e8f0;
  padding-top: 12px;
}

.authenticity-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 0;
}

.authenticity-toggle:hover {
  color: #334155;
}

.authenticity-toggle.has-content {
  color: #2563eb;
}

.has-badge {
  padding: 2px 6px;
  background: #dbeafe;
  color: #2563eb;
  border-radius: 4px;
  font-size: 10px;
}

.toggle-icon {
  margin-left: auto;
  transition: transform 0.2s;
}

.toggle-icon.rotated {
  transform: rotate(180deg);
}

.authenticity-content {
  margin-top: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
}

.card-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.move-buttons {
  display: flex;
  gap: 4px;
}

.btn-move {
  padding: 6px;
  background: #f1f5f9;
  border: none;
  border-radius: 6px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-move:hover:not(:disabled) {
  background: #e2e8f0;
  color: #334155;
}

.btn-move:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-delete {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: none;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #ef4444;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-delete:hover {
  background: #fef2f2;
  border-color: #ef4444;
}

/* Readonly authenticity display */
.authenticity-readonly {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

.authenticity-readonly label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 8px;
}

.authenticity-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.auth-item {
  font-size: 13px;
  color: #475569;
  padding: 6px 10px;
  background: #f8fafc;
  border-radius: 6px;
}

.auth-label {
  font-weight: 500;
  color: #64748b;
}
</style>
