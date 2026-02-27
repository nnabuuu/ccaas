<script setup lang="ts">
/**
 * SyncCardPanel - Sticky panel displaying pending output updates at the bottom of chat.
 *
 * Features:
 * - Sticky positioning at bottom
 * - Semi-transparent background with backdrop blur
 * - Collapsible when more than maxVisible cards
 * - Custom card rendering via scoped slot
 *
 * @example
 * ```vue
 * <SyncCardPanel
 *   :output-updates="outputUpdates"
 *   @sync="handleSync"
 *   @discard="handleDiscard"
 * />
 * ```
 */

import { ref, computed } from 'vue'
import type { OutputUpdate } from '../types/output-sync'

const props = withDefaults(defineProps<{
  outputUpdates: OutputUpdate[]
  maxVisible?: number
}>(), {
  maxVisible: 3,
})

const emit = defineEmits<{
  sync: [field: string]
  discard: [field: string]
}>()

defineSlots<{
  card?: (props: { update: OutputUpdate; onSync: () => void; onDiscard: () => void }) => any
}>()

const isExpanded = ref(false)

const pendingUpdates = computed(() => props.outputUpdates.filter(u => !u.synced))
const hasMore = computed(() => pendingUpdates.value.length > props.maxVisible)
const visibleUpdates = computed(() =>
  isExpanded.value ? pendingUpdates.value : pendingUpdates.value.slice(0, props.maxVisible)
)
</script>

<template>
  <div
    v-if="pendingUpdates.length > 0"
    class="sticky bottom-0 left-0 right-0 z-10 border-t border-gray-200 bg-white/90 backdrop-blur-sm"
  >
    <div class="max-w-4xl mx-auto px-4 py-3">
      <!-- Header -->
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-gray-700">
            待同步内容
          </span>
          <span class="text-xs text-gray-500">
            ({{ pendingUpdates.length }} 项)
          </span>
        </div>
        <button
          v-if="hasMore"
          class="text-xs text-blue-600 hover:text-blue-700 font-medium"
          @click="isExpanded = !isExpanded"
        >
          {{ isExpanded ? '收起' : `展开全部 (${pendingUpdates.length})` }}
        </button>
      </div>

      <!-- Cards -->
      <div class="space-y-2">
        <div v-for="update in visibleUpdates" :key="update.field">
          <slot
            name="card"
            :update="update"
            :on-sync="() => emit('sync', update.field)"
            :on-discard="() => emit('discard', update.field)"
          >
            <!-- Default sync card -->
            <div class="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-700 truncate">
                  {{ update.field }}
                </div>
                <div class="text-xs text-gray-500 truncate">
                  {{ update.preview }}
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  class="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                  @click="emit('sync', update.field)"
                >
                  同步
                </button>
                <button
                  class="px-2 py-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  title="忽略"
                  @click="emit('discard', update.field)"
                >
                  &times;
                </button>
              </div>
            </div>
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>
