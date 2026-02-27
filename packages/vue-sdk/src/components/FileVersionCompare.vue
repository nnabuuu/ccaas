<script setup lang="ts">
/**
 * FileVersionCompare - Side-by-side or unified diff viewer.
 *
 * Displays comparison metadata (size difference, content changed status)
 * with download buttons for both versions.
 *
 * @example
 * ```vue
 * <FileVersionCompare
 *   filename="index.ts"
 *   from-version="v1"
 *   to-version="v2"
 *   :comparison="comparisonData"
 *   :is-loading="isLoading"
 *   :error="error"
 *   @close="handleClose"
 *   @download-version="handleDownload"
 * />
 * ```
 */

import { ref } from 'vue'

const props = defineProps<{
  filename: string
  fromVersion: string
  toVersion: string
  comparison?: {
    sizeDiff: number
    hashChanged: boolean
  } | null
  isLoading?: boolean
  error?: Error | null
}>()

const emit = defineEmits<{
  close: []
  downloadVersion: [version: string]
}>()

const diffMode = ref<'unified' | 'split'>('unified')

function formatSizeDiff(sizeDiff: number): { text: string; color: 'green' | 'red' | 'gray' } {
  if (sizeDiff === 0) {
    return { text: 'No change', color: 'gray' }
  }

  const absSize = Math.abs(sizeDiff)
  const sizeStr =
    absSize < 1024
      ? `${absSize} B`
      : absSize < 1024 * 1024
      ? `${(absSize / 1024).toFixed(1)} KB`
      : `${(absSize / (1024 * 1024)).toFixed(1)} MB`

  if (sizeDiff > 0) {
    return { text: `+${sizeStr}`, color: 'green' }
  } else {
    return { text: `-${sizeStr}`, color: 'red' }
  }
}
</script>

<template>
  <!-- Loading state -->
  <div
    v-if="isLoading"
    class="flex items-center justify-center h-full bg-white dark:bg-slate-900"
  >
    <div class="flex flex-col items-center gap-3">
      <div class="w-8 h-8 border-3 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
      <p class="text-sm text-slate-500 dark:text-slate-400">Loading comparison...</p>
    </div>
  </div>

  <!-- Error state -->
  <div
    v-else-if="error || !comparison"
    class="flex items-center justify-center h-full bg-white dark:bg-slate-900"
  >
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
        Failed to load comparison
      </p>
    </div>
  </div>

  <!-- Comparison View -->
  <div v-else class="flex flex-col h-full bg-white dark:bg-slate-900">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Compare Versions
          </h3>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {{ filename }} &middot; {{ fromVersion }} &#8596; {{ toVersion }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded p-1">
            <button
              :class="[
                'px-2 py-1 text-xs rounded transition-colors',
                diffMode === 'unified'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100',
              ]"
              @click="diffMode = 'unified'"
            >
              Unified
            </button>
            <button
              :class="[
                'px-2 py-1 text-xs rounded transition-colors',
                diffMode === 'split'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100',
              ]"
              @click="diffMode = 'split'"
            >
              Split
            </button>
          </div>
          <button
            class="p-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            aria-label="Close"
            @click="emit('close')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Comparison Stats -->
    <div class="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
      <div class="flex items-center gap-6 text-sm">
        <div class="flex items-center gap-2">
          <span class="text-slate-600 dark:text-slate-400">Size:</span>
          <span
            :class="[
              'font-medium',
              formatSizeDiff(comparison.sizeDiff).color === 'green'
                ? 'text-green-600 dark:text-green-400'
                : formatSizeDiff(comparison.sizeDiff).color === 'red'
                ? 'text-red-600 dark:text-red-400'
                : 'text-slate-600 dark:text-slate-400',
            ]"
          >
            {{ formatSizeDiff(comparison.sizeDiff).text }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-slate-600 dark:text-slate-400">Content:</span>
          <span
            :class="[
              'font-medium',
              comparison.hashChanged
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-600 dark:text-slate-400',
            ]"
          >
            {{ comparison.hashChanged ? 'Changed' : 'Identical' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Diff Content -->
    <div class="flex-1 overflow-auto">
      <!-- Content Changed -->
      <div v-if="comparison.hashChanged" class="p-4">
        <div class="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
          <svg
            class="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            stroke-width="1.5"
          >
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-sm text-slate-600 dark:text-slate-400">
            Detailed line-by-line comparison
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-500 mt-2">
            Download both versions to compare in your editor
          </p>
          <div class="flex items-center justify-center gap-3 mt-4">
            <button
              class="px-3 py-1.5 text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded transition-colors"
              @click="emit('downloadVersion', fromVersion)"
            >
              Download {{ fromVersion }}
            </button>
            <button
              class="px-3 py-1.5 text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded transition-colors"
              @click="emit('downloadVersion', toVersion)"
            >
              Download {{ toVersion }}
            </button>
          </div>
        </div>
      </div>

      <!-- Content Identical -->
      <div v-else class="p-4">
        <div class="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 text-center">
          <svg
            class="w-12 h-12 mx-auto text-green-500 dark:text-green-400 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            stroke-width="1.5"
          >
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-sm text-green-700 dark:text-green-400 font-medium">
            Files are identical
          </p>
          <p class="text-xs text-green-600 dark:text-green-500 mt-1">
            No differences detected between these versions
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
