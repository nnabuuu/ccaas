<script setup lang="ts">
/**
 * OutputUpdateCard - Generic version of SyncButton for displaying AI-generated content suggestions
 *
 * Displays pending updates with Sync/Discard actions or synced state with Resync option.
 * Solutions provide field label mappings to customize the display.
 *
 * @example
 * <OutputUpdateCard
 *   field="objectives"
 *   field-label="学习目标"
 *   preview="理解圆的面积公式..."
 *   @sync="syncField('objectives')"
 *   @discard="discardField('objectives')"
 * />
 */

const props = withDefaults(defineProps<{
  field: string
  fieldLabel: string
  preview: string
  synced?: boolean
  syncedAt?: Date
  icon?: 'sync' | 'download' | 'attach'
  syncLabel?: string
}>(), {
  synced: false,
  icon: 'sync',
  syncLabel: '同步到表单',
})

const emit = defineEmits<{
  sync: []
  discard: []
}>()

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const suggestionLabel = props.icon === 'attach' || props.icon === 'download' ? '待添加' : '建议更新'
const resyncLabel = props.icon === 'attach' || props.icon === 'download' ? '重新添加' : '重新同步'
const syncedPrefix = props.icon === 'attach' || props.icon === 'download' ? '已添加' : '已同步到'
</script>

<template>
  <!-- Synced state -->
  <div v-if="synced" class="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-green-800 flex items-center gap-1">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          {{ icon === 'attach' || icon === 'download' ? syncedPrefix : `${syncedPrefix}「${fieldLabel}」` }}
        </p>
        <p v-if="syncedAt" class="text-xs text-green-600 mt-1">
          上次同步: {{ formatTime(syncedAt) }}
        </p>
      </div>

      <button
        class="px-3 py-1.5 text-sm rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
        @click="emit('sync')"
      >
        {{ resyncLabel }}
      </button>
    </div>
  </div>

  <!-- Pending state -->
  <div v-else class="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-yellow-800">
          {{ suggestionLabel }}「{{ fieldLabel }}」
        </p>
        <p class="text-sm text-yellow-700 mt-1 truncate">{{ preview }}</p>
      </div>

      <div class="flex items-center gap-2 flex-shrink-0">
        <button
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors"
          @click="emit('sync')"
        >
          <!-- Attach / Download icon -->
          <svg
            v-if="icon === 'download' || icon === 'attach'"
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
            />
          </svg>
          <!-- Sync icon (default) -->
          <svg
            v-else
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {{ syncLabel }}
        </button>

        <button
          class="p-1.5 text-yellow-600 hover:text-yellow-800 rounded"
          title="忽略"
          @click="emit('discard')"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
