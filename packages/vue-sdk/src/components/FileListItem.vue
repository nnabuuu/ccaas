<script setup lang="ts">
/**
 * FileListItem - Individual file row with icon, name, size, status badge, and actions.
 *
 * Follows minimalist VS Code file explorer aesthetic.
 * Shows pulsing red dot for new files, yellow dot for modified.
 * Download/delete actions appear on hover.
 *
 * @example
 * ```vue
 * <FileListItem
 *   :file="file"
 *   :selected="file.id === selectedFileId"
 *   @select="handleSelect"
 *   @download="handleDownload"
 *   @delete="handleDelete"
 * />
 * ```
 */

import type { FileMetadata } from '../types/files'

const props = withDefaults(defineProps<{
  file: FileMetadata
  selected?: boolean
}>(), {
  selected: false,
})

const emit = defineEmits<{
  select: []
  download: []
  delete: []
}>()

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatFileDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function handleDeleteClick(e: MouseEvent) {
  e.stopPropagation()
  if (confirm(`Delete ${props.file.filename}?`)) {
    emit('delete')
  }
}

function handleDownloadClick(e: MouseEvent) {
  e.stopPropagation()
  emit('download')
}
</script>

<template>
  <div
    :class="[
      'group relative flex items-center gap-3 px-3 py-2',
      'border-l-2 transition-all duration-200',
      'cursor-pointer',
      selected
        ? 'bg-slate-100 dark:bg-slate-800 border-l-blue-500'
        : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50',
    ]"
    @click="emit('select')"
  >
    <!-- Status Badge - Pulsing red dot for new, yellow for modified -->
    <div v-if="file.status === 'new'" class="absolute -left-1 top-1/2 -translate-y-1/2">
      <div class="relative">
        <div class="w-2 h-2 bg-red-500 rounded-full" />
        <div class="absolute inset-0 w-2 h-2 bg-red-500 rounded-full animate-ping opacity-75" />
      </div>
    </div>
    <div v-if="file.status === 'modified'" class="absolute -left-1 top-1/2 -translate-y-1/2">
      <div class="w-2 h-2 bg-yellow-500 rounded-full" />
    </div>

    <!-- File Icon -->
    <div class="flex-shrink-0 text-slate-500">
      <svg
        class="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    </div>

    <!-- File Info -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <p class="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
          {{ file.filename }}
        </p>
        <span
          v-if="file.uploadedBy === 'user'"
          class="flex-shrink-0 text-xs text-slate-500 dark:text-slate-400"
        >
          (you)
        </span>
      </div>
      <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{{ formatFileSize(file.size) }}</span>
        <span>&middot;</span>
        <span>{{ formatFileDate(file.createdAt) }}</span>
      </div>
    </div>

    <!-- Actions (show on hover) -->
    <div class="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <button
        class="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        aria-label="Download file"
        @click="handleDownloadClick"
      >
        <svg
          class="w-4 h-4 text-slate-600 dark:text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          stroke-width="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
      <button
        class="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
        aria-label="Delete file"
        @click="handleDeleteClick"
      >
        <svg
          class="w-4 h-4 text-red-600 dark:text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          stroke-width="2"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  </div>
</template>
