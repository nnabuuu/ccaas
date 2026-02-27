<script setup lang="ts">
/**
 * ToolActivityIndicator - Animated list of active tools
 *
 * Displays currently executing tools with spinner animations.
 * Shows tool name, description, and a spinning indicator.
 */

import type { ChatToolActivity, ColorScheme } from '../types/chat'
import { COLOR_MAP } from '../types/chat'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  activeTools: Map<string, ChatToolActivity>
  colorScheme?: ColorScheme
}>(), {
  colorScheme: 'blue',
})

const colors = computed(() => COLOR_MAP[props.colorScheme])
const toolList = computed(() => Array.from(props.activeTools.values()))
</script>

<template>
  <div v-if="activeTools.size > 0" class="text-xs text-gray-500 space-y-1 mb-2 px-1">
    <div
      v-for="tool in toolList"
      :key="tool.toolId"
      class="flex items-center gap-2 animate-pulse"
    >
      <svg :class="['w-3 h-3 animate-spin', colors.text]" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span class="truncate">{{ tool.description || tool.toolName }}</span>
    </div>
  </div>
</template>
