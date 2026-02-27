<script setup lang="ts">
/**
 * FilePanel - Main file browser container with 2-column layout.
 *
 * Left: File list with upload button and badge
 * Right: File preview area
 * Responsive: stacks vertically on mobile
 *
 * @example
 * ```vue
 * <FilePanel
 *   :files="files"
 *   :selected-file="selectedFile"
 *   :is-loading="isLoading"
 *   :has-new-files="hasNewFiles"
 *   :new-files-count="newFilesCount"
 *   :error="error"
 *   :preview="preview"
 *   :preview-loading="previewLoading"
 *   @select-file="handleSelect"
 *   @upload-file="handleUpload"
 *   @download-file="handleDownload"
 *   @delete-file="handleDelete"
 *   @mark-all-seen="handleMarkAllSeen"
 *   @retry="handleRetry"
 * />
 * ```
 */

import { ref } from 'vue'
import FileList from './FileList.vue'
import FilePreview from './FilePreview.vue'
import FileUploadButton from './FileUploadButton.vue'
import type { FileMetadata, FilePreviewData } from '../types/files'

defineProps<{
  files: FileMetadata[]
  selectedFile?: FileMetadata | null
  isLoading?: boolean
  hasNewFiles?: boolean
  newFilesCount?: number
  error?: Error | null
  preview?: FilePreviewData | null
  previewLoading?: boolean
}>()

const emit = defineEmits<{
  selectFile: [file: FileMetadata]
  uploadFile: [file: File]
  downloadFile: [file: FileMetadata]
  deleteFile: [file: FileMetadata]
  markAllSeen: []
  retry: []
}>()

defineSlots<{
  uploadButton?: (props: { onUpload: (file: File) => void }) => any
}>()

const showUpload = ref(false)

function handleUpload(file: File) {
  emit('uploadFile', file)
  showUpload.value = false
}
</script>

<template>
  <div class="flex flex-col h-full bg-white dark:bg-slate-900">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Files
        </h2>
        <span
          v-if="hasNewFiles"
          class="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full"
        >
          {{ newFilesCount }} new
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="hasNewFiles"
          class="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          @click="emit('markAllSeen')"
        >
          Mark all seen
        </button>
        <button
          class="px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          @click="showUpload = !showUpload"
        >
          {{ showUpload ? 'Cancel' : 'Upload' }}
        </button>
      </div>
    </div>

    <!-- Upload Area (collapsible) -->
    <div
      v-if="showUpload"
      class="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
    >
      <slot name="uploadButton" :on-upload="handleUpload">
        <FileUploadButton @upload="handleUpload" />
      </slot>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
      <!-- File List (Left Panel) -->
      <div class="w-full md:w-80 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 overflow-hidden">
        <FileList
          :files="files"
          :selected-file-id="selectedFile?.id"
          :is-loading="isLoading"
          @select="(file) => emit('selectFile', file)"
          @download="(file) => emit('downloadFile', file)"
          @delete="(file) => emit('deleteFile', file)"
        />
      </div>

      <!-- Preview Area (Right Panel) -->
      <div class="flex-1 overflow-hidden">
        <FilePreview
          :file="selectedFile || null"
          :preview="preview || null"
          :is-loading="previewLoading"
        />
      </div>
    </div>

    <!-- Error Display -->
    <div
      v-if="error"
      class="absolute bottom-4 right-4 max-w-md p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg shadow-lg"
    >
      <div class="flex items-start gap-3">
        <svg
          class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div class="flex-1">
          <p class="text-sm font-medium text-red-800 dark:text-red-200">
            Error
          </p>
          <p class="text-sm text-red-600 dark:text-red-400 mt-1">
            {{ error.message }}
          </p>
        </div>
        <button
          class="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
          @click="emit('retry')"
        >
          Retry
        </button>
      </div>
    </div>
  </div>
</template>
