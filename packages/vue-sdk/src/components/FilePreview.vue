<script setup lang="ts">
/**
 * FilePreview - Preview router that selects appropriate preview component based on file type.
 *
 * Routes to FileImagePreview for images, FileTextPreview for text/code files.
 * Handles loading, error, empty, and no-file-selected states.
 *
 * @example
 * ```vue
 * <FilePreview
 *   :file="selectedFile"
 *   :preview="previewData"
 *   :is-loading="previewLoading"
 *   :error="previewError"
 * />
 * ```
 */

import { computed } from 'vue'
import FileTextPreview from './FileTextPreview.vue'
import FileImagePreview from './FileImagePreview.vue'
import type { FileMetadata, FilePreviewData } from '../types/files'

const props = defineProps<{
  file: FileMetadata | null
  preview?: FilePreviewData | null
  isLoading?: boolean
  error?: Error | null
}>()

const isImage = computed(() =>
  props.preview?.encoding === 'base64' && props.file?.mimeType?.startsWith('image/')
)
</script>

<template>
  <!-- No file selected -->
  <div v-if="!file" class="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
    <div class="flex flex-col items-center gap-3 text-center px-4">
      <svg
        class="w-16 h-16 text-slate-300 dark:text-slate-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        stroke-width="1"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Select a file to preview
      </p>
    </div>
  </div>

  <!-- Loading state -->
  <div v-else-if="isLoading" class="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
    <div class="flex flex-col items-center gap-3">
      <div class="w-8 h-8 border-3 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
      <p class="text-sm text-slate-500 dark:text-slate-400">Loading preview...</p>
    </div>
  </div>

  <!-- Error state -->
  <div v-else-if="error" class="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
    <div class="flex flex-col items-center gap-3 text-center px-4">
      <svg
        class="w-12 h-12 text-red-400 dark:text-red-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        stroke-width="1.5"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p class="text-sm text-red-600 dark:text-red-400">
        Failed to load preview
      </p>
      <p class="text-xs text-slate-500 dark:text-slate-400">
        {{ error.message }}
      </p>
    </div>
  </div>

  <!-- No preview available -->
  <div v-else-if="!preview" class="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
    <div class="flex flex-col items-center gap-3 text-center px-4">
      <svg
        class="w-12 h-12 text-slate-300 dark:text-slate-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        stroke-width="1.5"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Preview not available
      </p>
    </div>
  </div>

  <!-- Image preview -->
  <FileImagePreview
    v-else-if="isImage"
    :preview="preview"
    :filename="file.filename"
  />

  <!-- Default: text preview -->
  <FileTextPreview
    v-else
    :preview="preview"
    :filename="file.filename"
  />
</template>
