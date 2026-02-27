<script setup lang="ts">
/**
 * FileTextPreview - Text/code viewer with language detection.
 *
 * Displays text content in monospace font with file metadata.
 * Detects language from filename extension.
 *
 * @example
 * ```vue
 * <FileTextPreview
 *   :preview="previewData"
 *   filename="index.ts"
 * />
 * ```
 */

import { computed } from 'vue'
import type { FilePreviewData } from '../types/files'

const props = defineProps<{
  preview: FilePreviewData
  filename: string
}>()

const languageMap: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  html: 'html',
  css: 'css',
  py: 'python',
  java: 'java',
  go: 'go',
  rs: 'rust',
  cpp: 'cpp',
  c: 'c',
  md: 'markdown',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  sh: 'bash',
}

const extension = computed(() => props.filename.split('.').pop()?.toLowerCase())
const language = computed(() =>
  extension.value ? languageMap[extension.value] || 'text' : 'text'
)
const lineCount = computed(() => props.preview.content.split('\n').length)
</script>

<template>
  <div class="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div class="flex items-center gap-2">
        <svg
          class="w-4 h-4 text-slate-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          stroke-width="2"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">
          {{ filename }}
        </span>
        <span
          v-if="language !== 'text'"
          class="px-2 py-0.5 text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded"
        >
          {{ language }}
        </span>
      </div>
      <span v-if="preview.truncated" class="text-xs text-amber-600 dark:text-amber-400">
        Truncated
      </span>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto">
      <pre class="p-4 text-sm font-mono leading-relaxed text-slate-800 dark:text-slate-200"><code>{{ preview.content }}</code></pre>
    </div>

    <!-- Footer Info -->
    <div class="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div class="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span>{{ lineCount }} lines</span>
        <span>{{ preview.size }} bytes</span>
        <span v-if="preview.truncated" class="text-amber-600 dark:text-amber-400">
          Preview limited to first 100KB
        </span>
      </div>
    </div>
  </div>
</template>
