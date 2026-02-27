<script setup lang="ts">
/**
 * DefaultSyncButton - SDK default sync button component
 *
 * Displays a sync button for output updates with:
 * - Field name and preview
 * - Sync/Discard actions (when not synced)
 * - Synced status display (when synced)
 *
 * Solutions can override this with custom renderSyncButton slot.
 *
 * @example
 * ```vue
 * <DefaultSyncButton
 *   :update="outputUpdate"
 *   @sync="handleSync(update.field)"
 *   @discard="handleDiscard(update.field)"
 * />
 * ```
 */

import type { OutputUpdate } from '../types/output-sync'

defineProps<{
  update: OutputUpdate
}>()

const emit = defineEmits<{
  sync: []
  discard: []
}>()
</script>

<template>
  <div class="p-3 bg-white border border-gray-200 rounded-md space-y-2">
    <!-- Field and Preview -->
    <div>
      <div class="text-sm font-medium text-gray-700">{{ update.field }}</div>
      <div class="text-xs text-gray-500 mt-1 line-clamp-2">{{ update.preview }}</div>
    </div>

    <!-- Actions or Synced Status -->
    <div v-if="update.synced" class="flex items-center gap-2 text-xs text-green-600">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span>
        已同步
        <template v-if="update.syncedAt">
          ({{ new Date(update.syncedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }})
        </template>
      </span>
    </div>
    <div v-else class="flex gap-2">
      <button
        class="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
        @click="emit('sync')"
      >
        同步
      </button>
      <button
        class="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
        @click="emit('discard')"
      >
        忽略
      </button>
    </div>
  </div>
</template>
