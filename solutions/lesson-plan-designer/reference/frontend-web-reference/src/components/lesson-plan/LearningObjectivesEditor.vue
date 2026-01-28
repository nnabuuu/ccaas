<script setup lang="ts">
/**
 * LearningObjectivesEditor - Editor for learning objectives with course requirements linking
 *
 * Manages a list of learning objectives, each linkable to content and academic requirements
 * via a dropdown selector. Supports add/remove operations and readonly display mode.
 *
 * @example
 * <LearningObjectivesEditor v-model="objectives" :available-requirements="requirements" :readonly="false" />
 */
import { ref, computed, type PropType } from 'vue'
import type { LearningObjective, CourseRequirement } from '@/types'

const props = defineProps({
  modelValue: { type: Array as PropType<LearningObjective[]>, default: () => [] },
  availableRequirements: { type: Array as PropType<CourseRequirement[]>, default: () => [] },
  readonly: { type: Boolean, default: false }
})

const emit = defineEmits<{
  'update:modelValue': [value: LearningObjective[]]
}>()

// Local copy for editing
const objectives = computed({
  get: () => props.modelValue || [],
  set: (val: LearningObjective[]) => emit('update:modelValue', val)
})

// Track which objective has dropdown open
const openDropdownId = ref<number | null>(null)

const addObjective = () => {
  const newId = Date.now()
  objectives.value = [...objectives.value, {
    id: newId,
    content: '',
    linkedRequirements: []
  }]
}

const removeObjective = (id: number) => {
  objectives.value = objectives.value.filter(obj => obj.id !== id)
}

const updateObjectiveContent = (id: number, content: string) => {
  objectives.value = objectives.value.map(obj =>
    obj.id === id ? { ...obj, content } : obj
  )
}

const toggleRequirement = (objectiveId: number, reqId: number) => {
  objectives.value = objectives.value.map(obj => {
    if (obj.id !== objectiveId) return obj
    const linked = obj.linkedRequirements || []
    const exists = linked.includes(reqId)
    return {
      ...obj,
      linkedRequirements: exists
        ? linked.filter(id => id !== reqId)
        : [...linked, reqId]
    }
  })
}

const isRequirementLinked = (objectiveId: number, reqId: number): boolean => {
  const obj = objectives.value.find(o => o.id === objectiveId)
  return obj?.linkedRequirements?.includes(reqId) || false
}

const getRequirementLabel = (reqId: number): string => {
  const req = props.availableRequirements.find(r => r.id === reqId)
  return req?.label || req?.description || `ID: ${reqId}`
}

const getRequirementType = (reqId: number): string => {
  const req = props.availableRequirements.find(r => r.id === reqId)
  return req?.type || 'unknown'
}

const toggleDropdown = (id: number) => {
  openDropdownId.value = openDropdownId.value === id ? null : id
}

const closeDropdown = () => {
  openDropdownId.value = null
}
</script>

<template>
  <div class="learning-objectives-editor">
    <!-- Objectives List -->
    <div v-if="objectives.length > 0" class="objectives-list">
      <div
        v-for="(objective, index) in objectives"
        :key="objective.id"
        class="objective-item"
      >
        <div class="objective-header">
          <span class="objective-number">目标 {{ index + 1 }}</span>
          <button
            v-if="!readonly"
            class="btn-remove"
            @click="removeObjective(objective.id)"
            title="删除目标"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Content Input -->
        <div class="objective-content">
          <textarea
            v-if="!readonly"
            :value="objective.content"
            @input="updateObjectiveContent(objective.id, ($event.target as HTMLTextAreaElement).value)"
            placeholder="请输入学习目标内容..."
            rows="2"
            class="objective-textarea"
          />
          <p v-else class="objective-text">{{ objective.content || '暂无内容' }}</p>
        </div>

        <!-- Linked Requirements -->
        <div class="linked-requirements">
          <div class="linked-label">关联课程要求：</div>

          <!-- Tags for linked requirements -->
          <div class="requirement-tags">
            <span
              v-for="reqId in objective.linkedRequirements"
              :key="reqId"
              :class="['requirement-tag', getRequirementType(reqId)]"
            >
              {{ getRequirementLabel(reqId) }}
              <button
                v-if="!readonly"
                class="tag-remove"
                @click="toggleRequirement(objective.id, reqId)"
              >×</button>
            </span>
            <span v-if="!objective.linkedRequirements?.length" class="no-links">
              暂未关联
            </span>
          </div>

          <!-- Add requirement dropdown -->
          <div v-if="!readonly && availableRequirements.length > 0" class="add-requirement">
            <button
              class="btn-add-link"
              @click="toggleDropdown(objective.id)"
            >
              + 关联要求
            </button>

            <div
              v-if="openDropdownId === objective.id"
              class="requirement-dropdown"
              @mouseleave="closeDropdown"
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
                    :checked="isRequirementLinked(objective.id, req.id)"
                    @change="toggleRequirement(objective.id, req.id)"
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
                    :checked="isRequirementLinked(objective.id, req.id)"
                    @change="toggleRequirement(objective.id, req.id)"
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
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <p>暂无学习目标</p>
    </div>

    <!-- Add Button -->
    <button v-if="!readonly" class="btn-add-objective" @click="addObjective">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      添加学习目标
    </button>
  </div>
</template>

<style scoped>
.learning-objectives-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.objectives-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.objective-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
}

.objective-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.objective-number {
  font-weight: 600;
  color: #0f172a;
  font-size: 14px;
}

.btn-remove {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-remove:hover {
  background: #fee2e2;
  color: #ef4444;
}

.objective-content {
  margin-bottom: 12px;
}

.objective-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  font-family: inherit;
}

.objective-textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.objective-text {
  color: #334155;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}

.linked-requirements {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.linked-label {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

.requirement-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
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

.requirement-tag.unknown {
  background: #f1f5f9;
  color: #64748b;
}

.tag-remove {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0;
  margin-left: 2px;
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
}

.btn-add-link {
  background: none;
  border: 1px dashed #cbd5e1;
  color: #64748b;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-link:hover {
  border-color: #2563eb;
  color: #2563eb;
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
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: #f8fafc;
}

.dropdown-item input[type="checkbox"] {
  margin-top: 2px;
  flex-shrink: 0;
}

.item-label {
  font-size: 13px;
  color: #334155;
  line-height: 1.4;
}

.no-items {
  padding: 8px 12px;
  font-size: 12px;
  color: #94a3b8;
  font-style: italic;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: #94a3b8;
  font-size: 14px;
}

.btn-add-objective {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  background: white;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #64748b;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-objective:hover {
  border-color: #2563eb;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.05);
}
</style>
