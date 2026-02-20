<script setup lang="ts">
/**
 * SubTasksList - List editor for sub-tasks within a learning task
 *
 * Manages sub-tasks with name, description, and duration fields.
 * Supports add/remove/reorder operations with numbered badges.
 *
 * @example
 * <SubTasksList v-model="subTasks" :readonly="false" />
 */
import { computed, type PropType } from 'vue'
import type { SubTask } from '@/types'

const props = defineProps({
  modelValue: { type: Array as PropType<SubTask[]>, default: () => [] },
  readonly: { type: Boolean, default: false }
})

const emit = defineEmits<{
  'update:modelValue': [value: SubTask[]]
}>()

const subTasks = computed({
  get: () => props.modelValue || [],
  set: (val: SubTask[]) => emit('update:modelValue', val)
})

const addSubTask = () => {
  subTasks.value = [...subTasks.value, {
    id: Date.now(),
    name: '',
    description: '',
    duration: 5
  }]
}

const removeSubTask = (id: number) => {
  subTasks.value = subTasks.value.filter(t => t.id !== id)
}

const updateSubTask = (id: number, field: keyof SubTask, value: unknown) => {
  subTasks.value = subTasks.value.map(t =>
    t.id === id ? { ...t, [field]: value } : t
  )
}

const moveSubTask = (index: number, direction: number) => {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= subTasks.value.length) return
  const arr = [...subTasks.value]
  const [item] = arr.splice(index, 1)
  arr.splice(newIndex, 0, item)
  subTasks.value = arr
}
</script>

<template>
  <div class="subtasks-list">
    <div class="subtasks-header">
      <span class="subtasks-title">子任务</span>
      <span class="subtasks-count">{{ subTasks.length }} 项</span>
    </div>

    <div v-if="subTasks.length > 0" class="subtasks-items">
      <div
        v-for="(task, index) in subTasks"
        :key="task.id"
        class="subtask-item"
      >
        <div class="subtask-number">{{ index + 1 }}</div>

        <div class="subtask-content">
          <template v-if="!readonly">
            <input
              type="text"
              :value="task.name"
              @input="updateSubTask(task.id, 'name', ($event.target as HTMLInputElement).value)"
              placeholder="子任务名称"
              class="subtask-name-input"
            />
            <textarea
              :value="task.description"
              @input="updateSubTask(task.id, 'description', ($event.target as HTMLTextAreaElement).value)"
              placeholder="任务描述（可选）"
              rows="2"
              class="subtask-desc-input"
            />
            <div class="subtask-meta">
              <label class="duration-label">
                <span>时长</span>
                <input
                  type="number"
                  :value="task.duration"
                  @input="updateSubTask(task.id, 'duration', parseInt(($event.target as HTMLInputElement).value) || 0)"
                  min="1"
                  class="duration-input"
                />
                <span>分钟</span>
              </label>
            </div>
          </template>
          <template v-else>
            <div class="subtask-name">{{ task.name || '未命名子任务' }}</div>
            <div v-if="task.description" class="subtask-desc">{{ task.description }}</div>
            <div class="subtask-duration">{{ task.duration }} 分钟</div>
          </template>
        </div>

        <div v-if="!readonly" class="subtask-actions">
          <button
            class="btn-move"
            @click="moveSubTask(index, -1)"
            :disabled="index === 0"
            title="上移"
          >↑</button>
          <button
            class="btn-move"
            @click="moveSubTask(index, 1)"
            :disabled="index === subTasks.length - 1"
            title="下移"
          >↓</button>
          <button
            class="btn-remove"
            @click="removeSubTask(task.id)"
            title="删除"
          >×</button>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      暂无子任务
    </div>

    <button v-if="!readonly" class="btn-add-subtask" @click="addSubTask">
      + 添加子任务
    </button>
  </div>
</template>

<style scoped>
.subtasks-list {
  background: #f8fafc;
  border-radius: 8px;
  padding: 12px;
}

.subtasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.subtasks-title {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

.subtasks-count {
  font-size: 12px;
  color: #94a3b8;
}

.subtasks-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.subtask-item {
  display: flex;
  gap: 12px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
}

.subtask-number {
  width: 24px;
  height: 24px;
  background: #e0e7ff;
  color: #4f46e5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.subtask-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.subtask-name-input {
  width: 100%;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
}

.subtask-name-input:focus {
  outline: none;
  border-color: #4f46e5;
}

.subtask-desc-input {
  width: 100%;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
}

.subtask-desc-input:focus {
  outline: none;
  border-color: #4f46e5;
}

.subtask-meta {
  display: flex;
  gap: 16px;
}

.duration-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
}

.duration-input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 12px;
  text-align: center;
}

.subtask-name {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
}

.subtask-desc {
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}

.subtask-duration {
  font-size: 12px;
  color: #94a3b8;
}

.subtask-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.btn-move {
  width: 24px;
  height: 24px;
  background: #f1f5f9;
  border: none;
  border-radius: 4px;
  color: #64748b;
  cursor: pointer;
  font-size: 12px;
}

.btn-move:hover:not(:disabled) {
  background: #e2e8f0;
  color: #334155;
}

.btn-move:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-remove {
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 16px;
}

.btn-remove:hover {
  color: #ef4444;
}

.empty-state {
  text-align: center;
  padding: 16px;
  color: #94a3b8;
  font-size: 13px;
}

.btn-add-subtask {
  width: 100%;
  padding: 8px;
  margin-top: 8px;
  background: none;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-subtask:hover {
  border-color: #4f46e5;
  color: #4f46e5;
}
</style>
