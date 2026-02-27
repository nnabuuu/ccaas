<script setup lang="ts">
/**
 * QuickActions - Predefined prompt buttons
 *
 * Provides a consistent UI for common actions that send predefined prompts.
 * Solutions can customize the actions list and optionally provide custom rendering via slots.
 *
 * @example
 * ```vue
 * <QuickActions
 *   :actions="[
 *     { id: 'objectives', label: '学习目标', prompt: '帮我设计学习目标' },
 *     { id: 'content', label: '学习过程', prompt: '帮我设计学习过程' },
 *   ]"
 *   @select-action="sendMessage"
 * />
 * ```
 */

export interface QuickAction {
  id: string
  label: string
  prompt: string
  disabled?: boolean
}

const props = defineProps<{
  actions: QuickAction[]
}>()

const emit = defineEmits<{
  selectAction: [prompt: string]
}>()

defineSlots<{
  action?: (props: { action: QuickAction; onClick: () => void }) => unknown
}>()

function handleClick(action: QuickAction) {
  if (!action.disabled) {
    emit('selectAction', action.prompt)
  }
}
</script>

<template>
  <div v-if="actions.length > 0" class="flex flex-wrap gap-2">
    <template v-for="action in actions" :key="action.id">
      <!-- Custom slot rendering -->
      <div v-if="$slots.action">
        <slot name="action" :action="action" :on-click="() => handleClick(action)" />
      </div>

      <!-- Default button rendering -->
      <button
        v-else
        :disabled="action.disabled"
        :class="[
          'inline-flex items-center gap-2 px-3 py-1.5',
          'text-sm font-medium rounded-lg',
          'transition-all duration-200',
          action.disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-50 text-blue-700 hover:bg-blue-100 hover:shadow-sm active:scale-95',
        ]"
        @click="handleClick(action)"
      >
        {{ action.label }}
      </button>
    </template>
  </div>
</template>
