<script setup lang="ts">
/**
 * ChatSection - Layout wrapper that handles chat positioning with mode controls.
 *
 * Renders ChatLayoutControls at the top, chat content in the middle,
 * and an optional footer at the bottom.
 *
 * @example
 * ```vue
 * <ChatSection
 *   :mode="mode"
 *   :is-collapsed="isCollapsed"
 *   @mode-change="setMode"
 *   @toggle-collapse="toggleCollapse"
 * >
 *   <ChatPanel ... />
 *   <template #footer>
 *     <SyncCardPanel ... />
 *   </template>
 * </ChatSection>
 * ```
 */

import type { ChatLayoutMode } from '../types/layout'
import ChatLayoutControls from './ChatLayoutControls.vue'

type ColorScheme = 'blue' | 'primary' | 'indigo' | 'emerald' | 'violet'

withDefaults(defineProps<{
  mode: ChatLayoutMode
  isCollapsed: boolean
  colorScheme?: ColorScheme
}>(), {
  colorScheme: 'blue',
})

const emit = defineEmits<{
  modeChange: [mode: ChatLayoutMode]
  toggleCollapse: []
}>()

defineSlots<{
  default?: () => any
  footer?: () => any
}>()
</script>

<template>
  <div class="flex flex-col h-full">
    <ChatLayoutControls
      :mode="mode"
      :is-collapsed="isCollapsed"
      :color-scheme="colorScheme"
      @mode-change="(m) => emit('modeChange', m)"
      @toggle-collapse="emit('toggleCollapse')"
    />
    <div class="flex-1 min-h-0">
      <slot />
    </div>
    <div v-if="$slots.footer" class="flex-shrink-0 border-t border-gray-200">
      <slot name="footer" />
    </div>
  </div>
</template>
