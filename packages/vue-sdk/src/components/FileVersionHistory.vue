<script setup lang="ts">
/**
 * FileVersionHistory - Version timeline showing version entries.
 *
 * Displays version history with timeline dots, version numbers, dates,
 * changelogs, and actions (download, rollback, compare).
 *
 * @example
 * ```vue
 * <FileVersionHistory
 *   :versions="versions"
 *   :filename="file.filename"
 *   :is-loading="versionsLoading"
 *   :error="versionsError"
 *   :is-rolling-back="isRollingBack"
 *   :selected-versions="selectedVersions"
 *   :enable-compare="true"
 *   @select-version="handleVersionSelect"
 *   @compare="handleCompare"
 *   @download="handleDownload"
 *   @rollback="handleRollback"
 * />
 * ```
 */

import type { FileVersion } from '../types/files'

const props = withDefaults(defineProps<{
  versions: FileVersion[]
  filename: string
  isLoading?: boolean
  error?: Error | null
  isRollingBack?: boolean
  selectedVersions?: string[]
  enableCompare?: boolean
}>(), {
  isLoading: false,
  isRollingBack: false,
  selectedVersions: () => [],
  enableCompare: false,
})

const emit = defineEmits<{
  selectVersion: [version: string]
  compare: []
  download: [version: string]
  rollback: [version: string]
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
</script>

<template>
  <!-- Loading state -->
  <div v-if="isLoading" class="flex items-center justify-center h-full">
    <div class="flex flex-col items-center gap-3">
      <div class="w-8 h-8 border-3 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
      <p class="text-sm text-slate-500 dark:text-slate-400">Loading versions...</p>
    </div>
  </div>

  <!-- Error state -->
  <div v-else-if="error" class="flex items-center justify-center h-full">
    <div class="flex flex-col items-center gap-3 text-center px-4">
      <svg
        class="w-12 h-12 text-red-400"
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
        Failed to load version history
      </p>
    </div>
  </div>

  <!-- Empty state -->
  <div v-else-if="versions.length === 0" class="flex items-center justify-center h-full">
    <div class="flex flex-col items-center gap-3 text-center px-4">
      <svg
        class="w-12 h-12 text-slate-300 dark:text-slate-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        stroke-width="1.5"
      >
        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        No version history yet
      </p>
    </div>
  </div>

  <!-- Version Timeline -->
  <div v-else class="flex flex-col h-full bg-white dark:bg-slate-900">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Version History
          </h3>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {{ filename }} &middot; {{ versions.length }} versions
          </p>
        </div>
        <button
          v-if="selectedVersions.length === 2"
          class="px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          @click="emit('compare')"
        >
          Compare
        </button>
      </div>
      <p v-if="selectedVersions.length > 0" class="text-xs text-slate-500 dark:text-slate-400 mt-2">
        {{
          selectedVersions.length === 1
            ? 'Select one more version to compare'
            : `Comparing ${selectedVersions[0]} ↔ ${selectedVersions[1]}`
        }}
      </p>
    </div>

    <!-- Version List -->
    <div class="flex-1 overflow-y-auto">
      <div class="p-4">
        <div class="space-y-4">
          <div
            v-for="(version, index) in versions"
            :key="version.id"
            class="relative"
          >
            <!-- Timeline connector -->
            <div
              v-if="index < versions.length - 1"
              class="absolute left-3 top-8 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700"
            />

            <!-- Version Card -->
            <div
              :class="[
                'relative flex gap-4 p-4 rounded-lg border-2 transition-all duration-200',
                selectedVersions.includes(version.version)
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
                enableCompare ? 'cursor-pointer' : '',
              ]"
              @click="enableCompare && emit('selectVersion', version.version)"
            >
              <!-- Timeline dot -->
              <div
                :class="[
                  'flex-shrink-0 w-6 h-6 rounded-full border-4 flex items-center justify-center',
                  index === 0
                    ? 'bg-blue-500 border-blue-100 dark:border-blue-900'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700',
                ]"
              >
                <svg
                  v-if="index === 0"
                  class="w-3 h-3 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <!-- Version Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <h4 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Version {{ version.version }}
                  </h4>
                  <span
                    v-if="index === 0"
                    class="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded"
                  >
                    Latest
                  </span>
                </div>

                <div class="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>{{ formatFileDate(version.createdAt) }}</span>
                  <span>&middot;</span>
                  <span>{{ formatFileSize(version.size) }}</span>
                  <span>&middot;</span>
                  <span class="capitalize">{{ version.uploadedBy }}</span>
                </div>

                <p v-if="version.changelog" class="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {{ version.changelog }}
                </p>

                <!-- Actions -->
                <div class="flex items-center gap-2 mt-3">
                  <button
                    class="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                    @click.stop="emit('download', version.version)"
                  >
                    Download
                  </button>
                  <button
                    v-if="index !== 0"
                    :disabled="isRollingBack"
                    class="px-2 py-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors disabled:opacity-50"
                    @click.stop="emit('rollback', version.version)"
                  >
                    {{ isRollingBack ? 'Rolling back...' : 'Rollback' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
