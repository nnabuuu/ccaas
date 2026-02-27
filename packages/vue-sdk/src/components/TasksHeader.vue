<script setup lang="ts">
import { computed } from 'vue'
import type { TaskGroups, TodoStats } from '../types/tasks'

const props = defineProps<{
  groups: TaskGroups
  todoStats: TodoStats | null
  showCompleted: boolean
}>()

const emit = defineEmits<{
  toggleCompleted: []
}>()

const hasActiveTasks = computed(() => props.groups.active.length > 0)
const hasTodos = computed(() => props.todoStats !== null && props.todoStats.total > 0)
const currentTask = computed(() => props.groups.active[0] ?? null)

const progressPercent = computed(() => {
  if (!props.todoStats || props.todoStats.total === 0) return 0
  return (props.todoStats.completed / props.todoStats.total) * 100
})
</script>

<template>
  <div class="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
    <!-- Header row: Active tasks indicator + Toggle button -->
    <div class="flex items-center justify-between mb-3">
      <!-- Left side: Active tasks indicator -->
      <div class="flex items-center gap-2">
        <div
          v-if="hasActiveTasks"
          class="w-2 h-2 bg-green-500 rounded-full animate-pulse"
        />
        <span class="text-sm font-medium text-gray-700">
          {{ hasActiveTasks
            ? `${groups.active.length} 个任务运行中`
            : '暂无活跃任务' }}
        </span>
      </div>

      <!-- Right side: Toggle button -->
      <button
        class="flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-gray-700 rounded hover:bg-white/50 transition-colors"
        :title="showCompleted ? '隐藏已完成任务' : '显示已完成任务'"
        @click="emit('toggleCompleted')"
      >
        <!-- Eye open icon -->
        <svg
          v-if="showCompleted"
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <!-- Eye closed icon -->
        <svg
          v-else
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
        <span class="text-xs hidden sm:inline">
          {{ showCompleted ? '隐藏已完成' : '显示已完成' }}
        </span>
      </button>
    </div>

    <!-- Todo progress bar -->
    <div v-if="hasTodos && todoStats" class="space-y-1">
      <div class="flex justify-between text-xs text-gray-600">
        <span>任务进度</span>
        <span>
          {{ todoStats.completed }} / {{ todoStats.total }}
        </span>
      </div>
      <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          class="h-full bg-blue-500 transition-all duration-300"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
    </div>

    <!-- Current running task preview -->
    <div v-if="currentTask" class="mt-3 p-2 bg-white rounded-lg border border-blue-200">
      <div class="text-xs text-gray-500 mb-1">当前执行</div>
      <div class="text-sm font-medium text-gray-800 truncate">
        {{ currentTask.title }}
      </div>
    </div>
  </div>
</template>
