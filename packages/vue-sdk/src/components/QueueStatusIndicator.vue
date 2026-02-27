<script setup lang="ts">
import { computed } from 'vue'

/**
 * Processing status from queue
 */
export interface ProcessingStatus {
  status: 'idle' | 'processing' | 'retrying' | 'completed' | 'failed'
  queueItemId?: string
  position?: number
  retryCount?: number
  maxRetries?: number
  nextRetryAt?: Date | null
  error?: string
  durationMs?: number
}

/**
 * Queue depth statistics
 */
export interface QueueDepth {
  total: number
  pending: number
  processing: number
}

const props = withDefaults(defineProps<{
  /** Current processing status */
  processingStatus: ProcessingStatus
  /** Queue depth statistics */
  queueDepth: QueueDepth
  /** Show detailed information */
  showDetails?: boolean
}>(), {
  showDetails: false,
})

const statusConfig = computed(() => {
  const configs: Record<ProcessingStatus['status'], {
    color: string
    icon: string
    label: string
  }> = {
    idle: {
      color: 'bg-gray-100 text-gray-700 border-gray-300',
      icon: '\u23F8\uFE0F',
      label: '\u7B49\u5F85\u4E2D',
    },
    processing: {
      color: 'bg-blue-100 text-blue-700 border-blue-300',
      icon: '\u2699\uFE0F',
      label: '\u5904\u7406\u4E2D',
    },
    retrying: {
      color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      icon: '\uD83D\uDD04',
      label: '\u91CD\u8BD5\u4E2D',
    },
    completed: {
      color: 'bg-green-100 text-green-700 border-green-300',
      icon: '\u2705',
      label: '\u5DF2\u5B8C\u6210',
    },
    failed: {
      color: 'bg-red-100 text-red-700 border-red-300',
      icon: '\u274C',
      label: '\u5931\u8D25',
    },
  }
  return configs[props.processingStatus.status]
})

const isVisible = computed(() => {
  return !(props.processingStatus.status === 'idle' && props.queueDepth.total === 0)
})

const isSpinning = computed(() => {
  return props.processingStatus.status === 'processing' || props.processingStatus.status === 'retrying'
})

const formattedDuration = computed(() => {
  if (props.processingStatus.durationMs !== undefined) {
    return (props.processingStatus.durationMs / 1000).toFixed(1)
  }
  return null
})
</script>

<template>
  <div
    v-if="isVisible"
    :class="[
      'queue-status-indicator flex items-center gap-2 px-3 py-2 rounded-lg border',
      statusConfig.color,
    ]"
    role="status"
    aria-live="polite"
  >
    <!-- Icon -->
    <span class="text-lg" aria-hidden="true">
      {{ statusConfig.icon }}
    </span>

    <!-- Status text -->
    <div class="flex-1">
      <div class="font-medium text-sm">
        {{ statusConfig.label }}
        <span
          v-if="processingStatus.status === 'processing' && processingStatus.position && processingStatus.position > 1"
          class="ml-1 text-xs opacity-75"
        >
          (\u7B2C {{ processingStatus.position }} \u6761)
        </span>
      </div>

      <!-- Details -->
      <div v-if="showDetails" class="text-xs opacity-75 mt-0.5">
        <!-- Queue depth -->
        <span v-if="queueDepth.total > 0">
          \u961F\u5217: {{ queueDepth.pending }} \u5F85\u5904\u7406 / {{ queueDepth.processing }} \u5904\u7406\u4E2D
        </span>

        <!-- Retry info -->
        <span
          v-if="processingStatus.status === 'retrying' && processingStatus.retryCount !== undefined && processingStatus.maxRetries !== undefined"
          class="ml-2"
        >
          \u91CD\u8BD5 {{ processingStatus.retryCount }}/{{ processingStatus.maxRetries }}
        </span>

        <!-- Duration -->
        <span
          v-if="processingStatus.status === 'completed' && formattedDuration !== null"
          class="ml-2"
        >
          \u8017\u65F6 {{ formattedDuration }}\u79D2
        </span>

        <!-- Error -->
        <div
          v-if="processingStatus.status === 'failed' && processingStatus.error"
          class="text-red-600 mt-1 max-w-md truncate"
          :title="processingStatus.error"
        >
          \u9519\u8BEF: {{ processingStatus.error }}
        </div>
      </div>
    </div>

    <!-- Spinner for processing/retrying -->
    <svg
      v-if="isSpinning"
      class="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  </div>
</template>
