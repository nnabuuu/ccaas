<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import type { TaskGroups } from '../types/tasks'
import UnifiedTaskCard from './UnifiedTaskCard.vue'

const props = withDefaults(defineProps<{
  groups: TaskGroups
  showCompleted: boolean
  highlightedTaskId?: string | null
}>(), {
  highlightedTaskId: null,
})

const highlightedEl = ref<HTMLDivElement | null>(null)

// Filter groups based on showCompleted toggle
const visibleGroups = computed(() => ({
  active: props.groups.active,
  recentCompleted: props.showCompleted ? props.groups.recentCompleted : [],
  recentFailed: props.groups.recentFailed, // Always show failed tasks
}))

// Auto-scroll to highlighted task
watch(
  () => props.highlightedTaskId,
  async (newId) => {
    if (newId) {
      await nextTick()
      highlightedEl.value?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  },
)

function setHighlightedRef(el: HTMLDivElement | null, taskId: string) {
  if (taskId === props.highlightedTaskId) {
    highlightedEl.value = el
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Active tasks section -->
    <section v-if="visibleGroups.active.length > 0">
      <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        运行中 ({{ visibleGroups.active.length }})
      </h3>
      <div class="space-y-2">
        <div
          v-for="task in visibleGroups.active"
          :key="task.id"
          :ref="(el: any) => setHighlightedRef(el as HTMLDivElement | null, task.id)"
        >
          <UnifiedTaskCard
            :task="task"
            :is-highlighted="task.id === highlightedTaskId"
          />
        </div>
      </div>
    </section>

    <!-- Recent completed section -->
    <section v-if="visibleGroups.recentCompleted.length > 0">
      <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        最近完成 ({{ visibleGroups.recentCompleted.length }})
      </h3>
      <div class="space-y-2">
        <div
          v-for="task in visibleGroups.recentCompleted"
          :key="task.id"
          :ref="(el: any) => setHighlightedRef(el as HTMLDivElement | null, task.id)"
        >
          <UnifiedTaskCard
            :task="task"
            :is-highlighted="task.id === highlightedTaskId"
          />
        </div>
      </div>
    </section>

    <!-- Recent failed section -->
    <section v-if="visibleGroups.recentFailed.length > 0">
      <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        最近失败 ({{ visibleGroups.recentFailed.length }})
      </h3>
      <div class="space-y-2">
        <div
          v-for="task in visibleGroups.recentFailed"
          :key="task.id"
          :ref="(el: any) => setHighlightedRef(el as HTMLDivElement | null, task.id)"
        >
          <UnifiedTaskCard
            :task="task"
            :is-highlighted="task.id === highlightedTaskId"
          />
        </div>
      </div>
    </section>
  </div>
</template>
