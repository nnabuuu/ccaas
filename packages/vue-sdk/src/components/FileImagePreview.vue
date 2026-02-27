<script setup lang="ts">
/**
 * FileImagePreview - Image viewer with zoom controls.
 *
 * Displays base64-encoded image with zoom toggle and metadata footer.
 *
 * @example
 * ```vue
 * <FileImagePreview
 *   :preview="previewData"
 *   filename="photo.png"
 * />
 * ```
 */

import { ref, computed } from 'vue'
import type { FilePreviewData } from '../types/files'

const props = defineProps<{
  preview: FilePreviewData
  filename: string
}>()

const zoom = ref(false)

const imageSrc = computed(() =>
  `data:${props.preview.mimeType};base64,${props.preview.content}`
)

const fileSizeKB = computed(() =>
  (props.preview.size / 1024).toFixed(1) + ' KB'
)
</script>

<template>
  <div class="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div class="flex items-center gap-2">
        <svg
          class="w-4 h-4 text-purple-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          stroke-width="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
          {{ filename }}
        </span>
      </div>
      <button
        class="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded transition-colors"
        @click="zoom = !zoom"
      >
        {{ zoom ? 'Fit' : 'Zoom' }}
      </button>
    </div>

    <!-- Image Container -->
    <div class="flex-1 overflow-auto p-4 flex items-center justify-center">
      <img
        :src="imageSrc"
        :alt="filename"
        :class="[
          'transition-all duration-200',
          zoom ? 'max-w-none' : 'max-w-full max-h-full object-contain',
          zoom ? 'cursor-zoom-out' : 'cursor-zoom-in',
        ]"
        @click="zoom = !zoom"
      />
    </div>

    <!-- Footer Info -->
    <div class="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div class="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span>{{ preview.mimeType }}</span>
        <span>{{ fileSizeKB }}</span>
        <span v-if="preview.truncated" class="text-amber-600 dark:text-amber-400">
          Preview may be incomplete
        </span>
      </div>
    </div>
  </div>
</template>
