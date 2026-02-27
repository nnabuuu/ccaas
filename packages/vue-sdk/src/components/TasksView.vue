<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TaskGroups, TodoStats } from '../types/tasks'
import TasksHeader from './TasksHeader.vue'
import TasksList from './TasksList.vue'

const props = withDefaults(defineProps<{
  groups: TaskGroups
  todoStats: TodoStats | null
  highlightedTaskId?: string | null
}>(), {
  highlightedTaskId: null,
})

const showCompleted = ref(true)

const hasNoTasks = computed(() => {
  return (
    props.groups.active.length === 0 &&
    props.groups.recentCompleted.length === 0 &&
    props.groups.recentFailed.length === 0
  )
})

function toggleCompleted() {
  showCompleted.value = !showCompleted.value
}
</script>

<template>
  <!-- Empty state -->
  <div v-if="hasNoTasks" class="flex flex-col items-center justify-center h-full text-center p-8">
    <svg
      class="w-24 h-24 mb-4 text-gray-300"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
    <p class="text-lg font-medium text-gray-700">暂无任务</p>
    <p class="mt-2 text-sm text-gray-500 max-w-xs">
      当 AI 开始处理您的请求时，相关任务会在这里显示
    </p>
  </div>

  <!-- Tasks view -->
  <div v-else class="h-full flex flex-col">
    <TasksHeader
      :groups="groups"
      :todo-stats="todoStats"
      :show-completed="showCompleted"
      @toggle-completed="toggleCompleted"
    />
    <div class="flex-1 overflow-y-auto p-4">
      <TasksList
        :groups="groups"
        :show-completed="showCompleted"
        :highlighted-task-id="highlightedTaskId"
      />
    </div>
  </div>
</template>
