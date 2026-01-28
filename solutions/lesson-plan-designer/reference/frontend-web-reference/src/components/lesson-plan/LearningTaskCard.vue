<script setup lang="ts">
/**
 * LearningTaskCard - Expandable card for individual learning task with sub-tasks and assessments
 *
 * Features collapsible card with basic info, linked requirements, sub-tasks list,
 * assessment tasks, and move/delete actions. Supports dropdown for linking course requirements.
 *
 * @example
 * <LearningTaskCard :task="task" :index="0" :available-requirements="reqs" @update="handleUpdate" />
 */
import { ref, computed, type PropType } from 'vue'
import SubTasksList from './SubTasksList.vue'
import AssessmentTasksList from './AssessmentTasksList.vue'
import type { LearningTask, CourseRequirement, SubTask, AssessmentTask } from '@/types'

const props = defineProps({
  task: { type: Object as PropType<LearningTask>, required: true },
  index: { type: Number, required: true },
  availableRequirements: { type: Array as PropType<CourseRequirement[]>, default: () => [] },
  readonly: { type: Boolean, default: false },
  canMoveUp: { type: Boolean, default: true },
  canMoveDown: { type: Boolean, default: true }
})

const emit = defineEmits<{
  update: [task: LearningTask]
  remove: []
  move: [direction: number]
}>()

const expanded = ref(true)
const showRequirementsDropdown = ref(false)

const taskTypes = [
  { value: 'individual', label: '个人任务' },
  { value: 'group', label: '小组任务' },
  { value: 'class', label: '全班活动' }
]

const getTypeLabel = (type: string): string => {
  return taskTypes.find(t => t.value === type)?.label || type
}

const toggleExpand = () => {
  expanded.value = !expanded.value
}

const updateField = <K extends keyof LearningTask>(field: K, value: LearningTask[K]) => {
  emit('update', { ...props.task, [field]: value })
}

const updateSubTasks = (subTasks: SubTask[]) => {
  emit('update', { ...props.task, subTasks })
}

const updateAssessments = (assessmentTasks: AssessmentTask[]) => {
  emit('update', { ...props.task, assessmentTasks })
}

const toggleRequirement = (reqId: number) => {
  const linked = props.task.linkedRequirements || []
  const exists = linked.includes(reqId)
  const newLinked = exists
    ? linked.filter(id => id !== reqId)
    : [...linked, reqId]
  emit('update', { ...props.task, linkedRequirements: newLinked })
}

const isRequirementLinked = (reqId: number): boolean => {
  return props.task.linkedRequirements?.includes(reqId) || false
}

const getRequirementLabel = (reqId: number): string => {
  const req = props.availableRequirements.find(r => r.id === reqId)
  return req?.label || `ID: ${reqId}`
}

const getRequirementType = (reqId: number): string => {
  const req = props.availableRequirements.find(r => r.id === reqId)
  return req?.type || 'unknown'
}

const totalDuration = computed(() => {
  const baseDuration = props.task.duration || 0
  const subTasksDuration = (props.task.subTasks || []).reduce((sum, t) => sum + (t.duration || 0), 0)
  return baseDuration || subTasksDuration
})
</script>

<template>
  <div class="learning-task-card" :class="{ collapsed: !expanded }">
    <!-- Card Header -->
    <div class="card-header" @click="toggleExpand">
      <div class="header-left">
        <span class="task-number">任务 {{ index + 1 }}</span>
        <span class="task-name">{{ task.name || '未命名任务' }}</span>
        <span class="task-type-badge">{{ getTypeLabel(task.type) }}</span>
        <span class="task-duration">{{ totalDuration }} 分钟</span>
      </div>
      <div class="header-right">
        <div v-if="task.linkedRequirements?.length" class="linked-count">
          {{ task.linkedRequirements.length }} 个课标
        </div>
        <div class="summary-counts">
          <span v-if="task.subTasks?.length">{{ task.subTasks.length }} 子任务</span>
          <span v-if="task.assessmentTasks?.length">{{ task.assessmentTasks.length }} 评价</span>
        </div>
        <button class="btn-expand">
          {{ expanded ? '▼' : '▶' }}
        </button>
      </div>
    </div>

    <!-- Card Content -->
    <div v-show="expanded" class="card-content">
      <!-- Basic Info -->
      <div class="section basic-info">
        <template v-if="!readonly">
          <div class="form-row">
            <input
              type="text"
              :value="task.name"
              @input="updateField('name', ($event.target as HTMLInputElement).value)"
              placeholder="任务名称"
              class="task-name-input"
            />
          </div>
          <div class="form-row">
            <textarea
              :value="task.description"
              @input="updateField('description', ($event.target as HTMLTextAreaElement).value)"
              placeholder="任务描述"
              rows="2"
              class="task-desc-input"
            />
          </div>
          <div class="form-row inline">
            <label class="form-label">
              <span>任务类型</span>
              <select
                :value="task.type"
                @change="updateField('type', ($event.target as HTMLSelectElement).value)"
                class="type-select"
              >
                <option v-for="t in taskTypes" :key="t.value" :value="t.value">
                  {{ t.label }}
                </option>
              </select>
            </label>
            <label class="form-label">
              <span>预计时长</span>
              <div class="duration-wrapper">
                <input
                  type="number"
                  :value="task.duration"
                  @input="updateField('duration', parseInt(($event.target as HTMLInputElement).value) || 0)"
                  min="0"
                  class="duration-input"
                />
                <span>分钟</span>
              </div>
            </label>
          </div>
        </template>
        <template v-else>
          <div v-if="task.description" class="task-description">
            {{ task.description }}
          </div>
        </template>
      </div>

      <!-- Linked Requirements -->
      <div class="section requirements-section">
        <div class="section-header">
          <span class="section-title">关联课标要求</span>
        </div>
        <div class="requirement-tags">
          <span
            v-for="reqId in task.linkedRequirements"
            :key="reqId"
            :class="['requirement-tag', getRequirementType(reqId)]"
          >
            {{ getRequirementLabel(reqId) }}
            <button
              v-if="!readonly"
              class="tag-remove"
              @click.stop="toggleRequirement(reqId)"
            >×</button>
          </span>
          <span v-if="!task.linkedRequirements?.length" class="no-links">
            暂未关联课标要求
          </span>
        </div>
        <div v-if="!readonly" class="add-requirement">
          <button
            class="btn-add-link"
            @click.stop="showRequirementsDropdown = !showRequirementsDropdown"
            :disabled="availableRequirements.length === 0"
          >
            + 关联课标
          </button>
          <div
            v-if="showRequirementsDropdown && availableRequirements.length > 0"
            class="requirement-dropdown"
            @mouseleave="showRequirementsDropdown = false"
          >
            <div class="dropdown-section">
              <div class="dropdown-title">内容要求</div>
              <label
                v-for="req in availableRequirements.filter(r => r.type === 'content')"
                :key="req.id"
                class="dropdown-item"
              >
                <input
                  type="checkbox"
                  :checked="isRequirementLinked(req.id)"
                  @change="toggleRequirement(req.id)"
                />
                <span class="item-label">{{ req.label }}</span>
              </label>
              <div v-if="!availableRequirements.some(r => r.type === 'content')" class="no-items">
                暂无内容要求
              </div>
            </div>
            <div class="dropdown-section">
              <div class="dropdown-title">学业要求</div>
              <label
                v-for="req in availableRequirements.filter(r => r.type === 'academic')"
                :key="req.id"
                class="dropdown-item"
              >
                <input
                  type="checkbox"
                  :checked="isRequirementLinked(req.id)"
                  @change="toggleRequirement(req.id)"
                />
                <span class="item-label">{{ req.label }}</span>
              </label>
              <div v-if="!availableRequirements.some(r => r.type === 'academic')" class="no-items">
                暂无学业要求
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sub-tasks -->
      <div class="section">
        <SubTasksList
          :model-value="task.subTasks || []"
          @update:model-value="updateSubTasks"
          :readonly="readonly"
        />
      </div>

      <!-- Assessment Tasks -->
      <div class="section">
        <AssessmentTasksList
          :model-value="task.assessmentTasks || []"
          @update:model-value="updateAssessments"
          :available-sub-tasks="task.subTasks || []"
          :readonly="readonly"
        />
      </div>

      <!-- Card Actions -->
      <div v-if="!readonly" class="card-actions">
        <div class="move-actions">
          <button
            class="btn-move"
            @click="emit('move', -1)"
            :disabled="!canMoveUp"
          >↑ 上移</button>
          <button
            class="btn-move"
            @click="emit('move', 1)"
            :disabled="!canMoveDown"
          >↓ 下移</button>
        </div>
        <button class="btn-delete" @click="emit('remove')">
          删除任务
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.learning-task-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.learning-task-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8fafc;
  cursor: pointer;
  user-select: none;
}

.card-header:hover {
  background: #f1f5f9;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.task-number {
  font-weight: 700;
  color: #2563eb;
  font-size: 14px;
}

.task-name {
  font-weight: 600;
  color: #0f172a;
  font-size: 15px;
}

.task-type-badge {
  padding: 2px 8px;
  background: #e0e7ff;
  color: #4f46e5;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.task-duration {
  font-size: 12px;
  color: #64748b;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.linked-count {
  font-size: 11px;
  color: #059669;
  background: #d1fae5;
  padding: 2px 8px;
  border-radius: 10px;
}

.summary-counts {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #94a3b8;
}

.btn-expand {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  font-size: 12px;
  padding: 4px;
}

.card-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-top: 1px solid #e2e8f0;
}

.section {
  /* spacing handled by gap */
}

.section-header {
  margin-bottom: 8px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

.form-row {
  margin-bottom: 12px;
}

.form-row.inline {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.form-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #64748b;
}

.task-name-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
}

.task-name-input:focus {
  outline: none;
  border-color: #2563eb;
}

.task-desc-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
  font-family: inherit;
}

.task-desc-input:focus {
  outline: none;
  border-color: #2563eb;
}

.type-select {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  min-width: 120px;
}

.duration-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.duration-input {
  width: 70px;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  text-align: center;
}

.task-description {
  color: #334155;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

/* Requirements Section */
.requirements-section {
  position: relative;
}

.requirement-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.requirement-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
}

.requirement-tag.content {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.requirement-tag.academic {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.tag-remove {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  opacity: 0.7;
}

.tag-remove:hover {
  opacity: 1;
}

.no-links {
  font-size: 12px;
  color: #94a3b8;
  font-style: italic;
}

.add-requirement {
  position: relative;
  display: inline-block;
}

.btn-add-link {
  background: none;
  border: 1px dashed #cbd5e1;
  color: #64748b;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
}

.btn-add-link:hover:not(:disabled) {
  border-color: #2563eb;
  color: #2563eb;
}

.btn-add-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.requirement-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 280px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 100;
}

.dropdown-section {
  padding: 8px 0;
}

.dropdown-section:not(:last-child) {
  border-bottom: 1px solid #e2e8f0;
}

.dropdown-title {
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
}

.dropdown-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
}

.dropdown-item:hover {
  background: #f8fafc;
}

.dropdown-item input[type="checkbox"] {
  margin-top: 2px;
}

.item-label {
  font-size: 13px;
  color: #334155;
}

.no-items {
  padding: 8px 12px;
  font-size: 12px;
  color: #94a3b8;
  font-style: italic;
}

/* Card Actions */
.card-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.move-actions {
  display: flex;
  gap: 8px;
}

.btn-move {
  padding: 6px 12px;
  background: #f1f5f9;
  border: none;
  border-radius: 6px;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
}

.btn-move:hover:not(:disabled) {
  background: #e2e8f0;
}

.btn-move:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-delete {
  padding: 6px 16px;
  background: none;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #ef4444;
  font-size: 12px;
  cursor: pointer;
}

.btn-delete:hover {
  background: #fef2f2;
}
</style>
