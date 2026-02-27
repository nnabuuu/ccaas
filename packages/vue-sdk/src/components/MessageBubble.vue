<script setup lang="ts">
/**
 * MessageBubble - Individual message bubble with avatar, content, timestamps
 *
 * Displays a single chat message with:
 * - User/assistant avatar
 * - Content blocks (text + inline tool cards) or plain content string
 * - Streaming cursor indicator
 * - Timestamp with execution time and token usage metadata
 * - Customizable content rendering via #content slot
 * - Extra children via default slot (sync buttons, etc.)
 */

import type { Message, ContentBlock, ColorScheme } from '../types/chat'
import { COLOR_MAP } from '../types/chat'
import InlineToolCard from './InlineToolCard.vue'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  message: Message
  colorScheme?: ColorScheme
}>(), {
  colorScheme: 'blue',
})

defineSlots<{
  content?: (props: { text: string; isUser: boolean }) => unknown
  default?: () => unknown
}>()

const isUser = computed(() => props.message.role === 'user')
const colors = computed(() => COLOR_MAP[props.colorScheme])

// Calculate total execution time from content blocks
const executionTime = computed(() => {
  if (!props.message.contentBlocks) return 0
  let total = 0
  for (const block of props.message.contentBlocks) {
    if (block.type === 'tool' && block.tool.duration) {
      total += block.tool.duration
    }
  }
  return total
})

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0s'
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div :class="['flex', isUser ? 'justify-end' : 'justify-start']">
    <div :class="['max-w-[85%]', isUser ? 'order-2' : 'order-1']">
      <div :class="['flex items-start gap-2', isUser ? 'flex-row-reverse' : '']">
        <!-- Avatar -->
        <div
          :class="[
            'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
            isUser ? `${colors.bg} text-white` : 'bg-gray-200 text-gray-600',
          ]"
        >
          <!-- User icon -->
          <svg v-if="isUser" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" :stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <!-- Assistant icon -->
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" :stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>

        <div class="flex-1">
          <!-- Message content -->
          <div
            :class="[
              'rounded-lg px-4 py-2',
              isUser
                ? `${colors.bg} text-white`
                : 'bg-gray-100 text-gray-800',
            ]"
          >
            <!-- Content blocks -->
            <div v-if="message.contentBlocks && message.contentBlocks.length > 0" class="text-sm leading-relaxed">
              <template v-for="(block, i) in message.contentBlocks" :key="i">
                <template v-if="block.type === 'text'">
                  <span v-if="$slots.content">
                    <slot name="content" :text="block.text" :is-user="isUser" />
                  </span>
                  <span v-else class="whitespace-pre-wrap">{{ block.text }}</span>
                </template>
                <InlineToolCard v-else :tool="block.tool" />
              </template>
            </div>

            <!-- Fallback: plain content string -->
            <template v-else-if="message.content">
              <div v-if="$slots.content" class="text-sm leading-relaxed">
                <slot name="content" :text="message.content" :is-user="isUser" />
              </div>
              <div v-else class="whitespace-pre-wrap text-sm leading-relaxed">{{ message.content }}</div>
            </template>

            <!-- Empty message: typing indicator -->
            <div v-else class="flex items-center gap-2 text-gray-400">
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" :style="{ animationDelay: '0ms' }" />
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" :style="{ animationDelay: '150ms' }" />
              <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" :style="{ animationDelay: '300ms' }" />
            </div>

            <!-- Streaming cursor -->
            <span
              v-if="message.isStreaming && message.content"
              class="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5"
            />
          </div>

          <!-- Extra children (sync buttons, token usage, etc.) -->
          <slot />

          <!-- Timestamp and metadata -->
          <div v-if="message.timestamp" :class="['mt-1 text-xs text-gray-400', isUser ? 'text-right' : '']">
            {{ formatTime(message.timestamp) }}
            <!-- Execution time - only show for assistant messages with tool execution -->
            <span v-if="!isUser && executionTime > 0" class="ml-1">
              &bull; 执行 {{ formatDuration(executionTime) }}
            </span>
            <!-- Token usage - only show for assistant messages -->
            <span v-if="!isUser && message.tokenUsage" class="ml-1">
              &bull; &darr; {{ message.tokenUsage.outputTokens.toLocaleString() }} tokens
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
