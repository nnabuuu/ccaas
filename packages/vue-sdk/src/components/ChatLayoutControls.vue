<script setup lang="ts">
/**
 * ChatLayoutControls - Mode switcher buttons (default/overlay/side-by-side)
 *
 * Displays a mode switcher with icons and labels, plus a collapse toggle
 * that appears in overlay and side-by-side modes.
 *
 * @example
 * ```vue
 * <ChatLayoutControls
 *   :mode="mode"
 *   :is-collapsed="isCollapsed"
 *   @mode-change="setMode"
 *   @toggle-collapse="toggleCollapse"
 * />
 * ```
 */

import type { ChatLayoutMode } from '../types/layout'

type ColorScheme = 'blue' | 'primary' | 'indigo' | 'emerald' | 'violet'

interface ColorClasses {
  bg: string
  text: string
  ring: string
  hover: string
  lightBg: string
}

const COLOR_MAP: Record<ColorScheme, ColorClasses> = {
  blue:    { bg: 'bg-blue-500',    text: 'text-blue-600',    ring: 'ring-blue-500',    hover: 'hover:bg-blue-600',    lightBg: 'bg-blue-100' },
  primary: { bg: 'bg-primary-500', text: 'text-primary-600', ring: 'ring-primary-500', hover: 'hover:bg-primary-600', lightBg: 'bg-primary-100' },
  indigo:  { bg: 'bg-indigo-500',  text: 'text-indigo-600',  ring: 'ring-indigo-500',  hover: 'hover:bg-indigo-600',  lightBg: 'bg-indigo-100' },
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-600', ring: 'ring-emerald-500', hover: 'hover:bg-emerald-600', lightBg: 'bg-emerald-100' },
  violet:  { bg: 'bg-violet-500',  text: 'text-violet-600',  ring: 'ring-violet-500',  hover: 'hover:bg-violet-600',  lightBg: 'bg-violet-100' },
}

const modes: { value: ChatLayoutMode; label: string }[] = [
  { value: 'default', label: '固定侧栏' },
  { value: 'overlay', label: '浮层' },
  { value: 'side-by-side', label: '并排' },
]

const props = withDefaults(defineProps<{
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

function getColors() {
  return COLOR_MAP[props.colorScheme]
}
</script>

<template>
  <div class="px-3 py-1.5 bg-white border-b border-gray-200 flex items-center justify-between text-xs flex-shrink-0">
    <!-- Mode switcher -->
    <div class="flex items-center gap-0.5 bg-gray-100 rounded-md p-0.5">
      <button
        v-for="m in modes"
        :key="m.value"
        :class="[
          'flex items-center gap-1 px-2 py-1 rounded transition-colors',
          mode === m.value
            ? `bg-white ${getColors().text} shadow-sm`
            : 'text-gray-500 hover:text-gray-700',
        ]"
        :title="m.label"
        @click="emit('modeChange', m.value)"
      >
        <!-- Default icon -->
        <svg
          v-if="m.value === 'default'"
          class="w-3.5 h-3.5"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <rect x="1" y="2" width="14" height="12" rx="1" />
          <line x1="10" y1="2" x2="10" y2="14" />
        </svg>
        <!-- Overlay icon -->
        <svg
          v-else-if="m.value === 'overlay'"
          class="w-3.5 h-3.5"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <rect x="1" y="2" width="14" height="12" rx="1" />
          <rect x="7" y="3" width="8" height="10" rx="0.5" fill="currentColor" fill-opacity="0.15" />
        </svg>
        <!-- Side-by-side icon -->
        <svg
          v-else
          class="w-3.5 h-3.5"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <rect x="1" y="2" width="14" height="12" rx="1" />
          <line x1="8" y1="2" x2="8" y2="14" stroke-dasharray="2 1" />
        </svg>
        <span class="hidden sm:inline">{{ m.label }}</span>
      </button>
    </div>

    <!-- Collapse toggle -->
    <button
      v-if="mode !== 'default'"
      class="flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors"
      title="收起聊天"
      @click="emit('toggleCollapse')"
    >
      <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="10,3 14,8 10,13" />
      </svg>
    </button>
  </div>
</template>
