<script setup lang="ts">
/**
 * FileUploadButton - Upload button with drag-and-drop zone support.
 *
 * Provides visual feedback during drag and upload progress.
 * Validates file size before upload.
 *
 * @example
 * ```vue
 * <FileUploadButton
 *   accept="image/*"
 *   :max-size="5 * 1024 * 1024"
 *   @upload="handleUpload"
 * />
 * ```
 */

import { ref } from 'vue'

const props = withDefaults(defineProps<{
  accept?: string
  maxSize?: number
  disabled?: boolean
}>(), {
  maxSize: 10 * 1024 * 1024, // 10MB default
  disabled: false,
})

const emit = defineEmits<{
  upload: [file: File]
}>()

const isDragging = ref(false)
const isUploading = ref(false)
const error = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

function handleDragEnter(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (!props.disabled && !isUploading.value) {
    isDragging.value = true
  }
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = false
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = false

  if (props.disabled || isUploading.value) return

  const files = Array.from(e.dataTransfer?.files || [])
  if (files.length > 0) {
    await handleFile(files[0])
  }
}

async function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    await handleFile(files[0])
  }
}

async function handleFile(file: File) {
  error.value = null

  // Validate file size
  if (file.size > props.maxSize) {
    const maxMB = Math.round(props.maxSize / (1024 * 1024))
    error.value = `File size exceeds ${maxMB}MB limit`
    return
  }

  try {
    isUploading.value = true
    emit('upload', file)
    // Reset input
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  } finally {
    isUploading.value = false
  }
}

function handleClick() {
  if (!props.disabled && !isUploading.value) {
    fileInputRef.value?.click()
  }
}

const maxMB = Math.round(props.maxSize / (1024 * 1024))
</script>

<template>
  <div>
    <!-- Drop Zone -->
    <div
      :class="[
        'relative border-2 border-dashed rounded-lg p-6',
        'transition-all duration-200',
        isDragging
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500',
        disabled || isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ]"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @dragover="handleDragOver"
      @drop="handleDrop"
      @click="handleClick"
    >
      <div class="flex flex-col items-center gap-2 text-center">
        <!-- Upload Icon -->
        <svg
          :class="[
            'w-8 h-8 transition-colors duration-200',
            isDragging
              ? 'text-blue-500'
              : 'text-slate-400 dark:text-slate-500',
          ]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          stroke-width="1.5"
        >
          <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>

        <!-- Upload Text -->
        <div v-if="isUploading" class="flex items-center gap-2">
          <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p class="text-sm text-slate-600 dark:text-slate-400">Uploading...</p>
        </div>
        <template v-else>
          <p class="text-sm font-medium text-slate-700 dark:text-slate-300">
            {{ isDragging ? 'Drop file here' : 'Click to upload or drag and drop' }}
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Max {{ maxMB }}MB
          </p>
        </template>
      </div>

      <!-- Hidden File Input -->
      <input
        ref="fileInputRef"
        type="file"
        :accept="accept"
        :disabled="disabled || isUploading"
        class="hidden"
        aria-label="Upload file"
        @change="handleFileSelect"
      />
    </div>

    <!-- Error Message -->
    <div
      v-if="error"
      class="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400"
    >
      {{ error }}
    </div>
  </div>
</template>
