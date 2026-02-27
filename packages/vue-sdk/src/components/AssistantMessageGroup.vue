<script setup lang="ts">
/**
 * AssistantMessageGroup - Renders a SplitMessage with multiple segments
 *
 * Features:
 * - Avatar displayed once at the top
 * - Each segment rendered via custom slot or default renderer
 * - Output Updates (SyncButtons) displayed after segments (message round binding)
 * - Token usage and timestamp displayed at the bottom
 * - Fully customizable via slots
 *
 * Layout:
 *   [Avatar] Segment 1 (text bubble)
 *            Segment 2 (tool cards, indented)
 *            Segment 3 (text bubble)
 *            ---
 *            SyncButtons (if outputUpdates provided)
 *            ---
 *            Token Usage Footer (if tokenUsage provided)
 *            Timestamp (if timestamp provided)
 */

import type { SplitMessage, DisplaySegment, ContentBlock } from '../types/chat'
import type { OutputUpdate } from '../types/output-sync'
import type { TokenUsage } from '@kedge-agentic/common'

const props = defineProps<{
  splitMessage: SplitMessage
  tokenUsage?: TokenUsage
  timestamp?: Date
  outputUpdates?: OutputUpdate[]
}>()

const emit = defineEmits<{
  sync: [field: string]
  discard: [field: string]
}>()

defineSlots<{
  segment?: (props: { segment: DisplaySegment; isLast: boolean }) => unknown
  syncButton?: (props: { update: OutputUpdate; onSync: () => void; onDiscard: () => void }) => unknown
  tokenUsage?: (props: { usage: TokenUsage }) => unknown
}>()

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="flex justify-start">
    <div class="max-w-[85%]">
      <div class="flex items-start gap-2">
        <!-- Avatar -->
        <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-600">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" :stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>

        <div class="flex-1">
          <!-- Segments -->
          <div class="space-y-1">
            <template v-for="(segment, index) in splitMessage.segments" :key="segment.id">
              <!-- Custom segment slot -->
              <div v-if="$slots.segment">
                <slot
                  name="segment"
                  :segment="segment"
                  :is-last="index === splitMessage.segments.length - 1"
                />
              </div>

              <!-- Default text segment -->
              <div
                v-else-if="segment.type === 'text'"
                class="px-4 py-2 bg-gray-100 rounded-md text-sm leading-relaxed whitespace-pre-wrap"
              >
                <template v-for="(block, i) in segment.blocks" :key="i">
                  <span v-if="block.type === 'text'">{{ block.text }}</span>
                </template>
              </div>

              <!-- Default tool/tool-group segment -->
              <div v-else class="ml-4 text-xs text-gray-500">
                <template v-for="(block, i) in segment.blocks" :key="i">
                  <div v-if="block.type === 'tool'">
                    [Tool: {{ block.tool.toolName }}]
                  </div>
                </template>
              </div>
            </template>
          </div>

          <!-- Output Updates (Sync Buttons) - Message Round Binding -->
          <div v-if="outputUpdates && outputUpdates.length > 0" class="mt-2 space-y-2">
            <template v-for="update in outputUpdates" :key="update.field">
              <div v-if="$slots.syncButton">
                <slot
                  name="syncButton"
                  :update="update"
                  :on-sync="() => emit('sync', update.field)"
                  :on-discard="() => emit('discard', update.field)"
                />
              </div>
              <!-- Default sync button fallback -->
              <div
                v-else
                class="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm"
              >
                <span class="flex-1 text-blue-800 truncate">{{ update.field }}: {{ update.preview }}</span>
                <button
                  class="px-2 py-1 text-xs font-medium text-white bg-blue-500 rounded hover:bg-blue-600"
                  @click="emit('sync', update.field)"
                >
                  同步
                </button>
                <button
                  class="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                  @click="emit('discard', update.field)"
                >
                  忽略
                </button>
              </div>
            </template>
          </div>

          <!-- Token Usage -->
          <div v-if="tokenUsage" class="mt-1.5">
            <slot v-if="$slots.tokenUsage" name="tokenUsage" :usage="tokenUsage" />
            <!-- Default token usage renderer -->
            <div v-else class="pt-1.5 border-t border-gray-200/60 flex items-center gap-3 text-[11px] text-gray-400">
              <span>&darr;{{ formatTokens(tokenUsage.inputTokens) }} &uarr;{{ formatTokens(tokenUsage.outputTokens) }}</span>
              <span v-if="(tokenUsage.cacheReadTokens ?? 0) > 0">
                &#x26A1;{{ formatTokens(tokenUsage.cacheReadTokens!) }} cached
              </span>
            </div>
          </div>

          <!-- Timestamp -->
          <div v-if="timestamp" class="mt-1 text-xs text-gray-400">
            {{ formatTime(timestamp) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
