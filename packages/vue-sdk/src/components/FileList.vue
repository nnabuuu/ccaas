<script setup lang="ts">
/**
 * FileList - Scrollable list of files with selection.
 *
 * Displays a list of files with loading and empty states.
 * Delegates rendering of each item to FileListItem.
 *
 * @example
 * ```vue
 * <FileList
 *   :files="files"
 *   :selected-file-id="selectedId"
 *   :is-loading="loading"
 *   @select="handleSelect"
 *   @download="handleDownload"
 *   @delete="handleDelete"
 * />
 * ```
 */

import FileListItem from './FileListItem.vue'
import type { FileMetadata } from '../types/files'

withDefaults(defineProps<{
  files: FileMetadata[]
  selectedFileId?: string
  isLoading?: boolean
  emptyMessage?: string
}>(), {
  isLoading: false,
  emptyMessage: 'No files yet',
})

const emit = defineEmits<{
  select: [file: FileMetadata]
  download: [file: FileMetadata]
  delete: [file: FileMetadata]
}>()
</script>

<template>
  <!-- Loading state -->
  <div v-if="isLoading" class="flex items-center justify-center h-full">
    <div class="flex flex-col items-center gap-3">
      <div class="w-8 h-8 border-3 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
      <p class="text-sm text-slate-500 dark:text-slate-400">Loading files...</p>
    </div>
  </div>

  <!-- Empty state -->
  <div v-else-if="files.length === 0" class="flex items-center justify-center h-full">
    <div class="flex flex-col items-center gap-3 text-center px-4">
      <svg
        class="w-12 h-12 text-slate-300 dark:text-slate-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        stroke-width="1.5"
      >
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
      <p class="text-sm text-slate-500 dark:text-slate-400">{{ emptyMessage }}</p>
    </div>
  </div>

  <!-- File list -->
  <div v-else class="h-full overflow-y-auto">
    <div class="py-1">
      <FileListItem
        v-for="file in files"
        :key="file.id"
        :file="file"
        :selected="file.id === selectedFileId"
        @select="emit('select', file)"
        @download="emit('download', file)"
        @delete="emit('delete', file)"
      />
    </div>
  </div>
</template>
