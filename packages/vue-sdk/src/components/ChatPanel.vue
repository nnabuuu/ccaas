<script setup lang="ts">
/**
 * ChatPanel - Main chat interface
 *
 * Full chat panel with header, messages list, activity indicators,
 * input area, and send button. Supports customization via slots.
 *
 * Slots:
 * - #message: Custom message rendering (receives { message })
 * - #quickActions: Quick action buttons area
 * - #activityDetails: Custom activity details section
 */

import type { Message, ColorScheme, ChatToolActivity } from '../types/chat'
import type { TodoStats } from '../types/tasks'
import type { TokenUsage } from '@kedge-agentic/common'
import type { EventTodoItem, ActiveSubAgent } from '@kedge-agentic/common'
import { COLOR_MAP } from '../types/chat'
import MessageBubble from './MessageBubble.vue'
import ThinkingIndicator from './ThinkingIndicator.vue'
import ToolActivityIndicator from './ToolActivityIndicator.vue'
import AgentActivityLine from './AgentActivityLine.vue'
import { ref, computed, watch, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  messages: Message[]
  isProcessing?: boolean
  connected?: boolean
  colorScheme?: ColorScheme
  title?: string
  emptyStateText?: string
  emptyStateSubtext?: string
  placeholder?: string
  activeTools?: Map<string, ChatToolActivity>
  isThinking?: boolean
  thinkingContent?: string
  thinkingStartTime?: number | null
  thinkingVerb?: string
  todoItems?: EventTodoItem[]
  todoStats?: TodoStats | null
  activeSubAgents?: ActiveSubAgent[]
  tokenUsage?: TokenUsage | null
}>(), {
  isProcessing: false,
  connected: false,
  colorScheme: 'blue',
  title: 'AI 助手',
  emptyStateText: '开始对话',
  emptyStateSubtext: undefined,
  placeholder: undefined,
  activeTools: () => new Map(),
  isThinking: false,
  thinkingContent: '',
  thinkingStartTime: null,
  thinkingVerb: '思考',
  todoItems: () => [],
  todoStats: null,
  activeSubAgents: () => [],
  tokenUsage: null,
})

const emit = defineEmits<{
  sendMessage: [content: string]
  cancel: []
}>()

defineSlots<{
  message?: (props: { message: Message }) => unknown
  quickActions?: () => unknown
  activityDetails?: () => unknown
}>()

const inputValue = ref('')
const messagesEndRef = ref<HTMLDivElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)

const colors = computed(() => COLOR_MAP[props.colorScheme])

// Auto-scroll to bottom when messages change
watch(
  () => props.messages,
  () => {
    nextTick(() => {
      messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
    })
  },
)

function handleSubmit(e?: Event) {
  e?.preventDefault()
  if (!inputValue.value.trim() || props.isProcessing || !props.connected) return
  emit('sendMessage', inputValue.value.trim())
  inputValue.value = ''
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSubmit()
  }
}

const defaultPlaceholder = computed(() =>
  props.connected ? '输入消息...' : '正在连接服务器...'
)
</script>

<template>
  <div class="flex flex-col h-full bg-gray-50">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
      <h2 class="font-semibold text-gray-800">{{ title }}</h2>
      <div class="flex items-center gap-3 text-sm">
        <span v-if="tokenUsage" class="text-xs text-gray-500">
          Tokens: {{ tokenUsage.inputTokens.toLocaleString() }} in / {{ tokenUsage.outputTokens.toLocaleString() }} out
        </span>
        <span v-if="isProcessing" :class="['flex items-center gap-1', colors.text]">
          <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          思考中...
        </span>
      </div>
    </div>

    <!-- Messages Area -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
      <!-- Empty state -->
      <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full text-center text-gray-500">
        <svg class="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" :stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p class="text-lg font-medium">{{ emptyStateText }}</p>
        <p v-if="emptyStateSubtext" class="mt-1 text-sm">{{ emptyStateSubtext }}</p>
      </div>

      <!-- Messages list -->
      <template v-else>
        <template v-for="message in messages" :key="message.id">
          <div v-if="$slots.message">
            <slot name="message" :message="message" />
          </div>
          <MessageBubble v-else :message="message" :color-scheme="colorScheme" />
        </template>
      </template>

      <!-- Activity indicators -->
      <ThinkingIndicator :is-thinking="isThinking" :content="thinkingContent" />
      <ToolActivityIndicator :active-tools="activeTools" :color-scheme="colorScheme" />
      <div ref="messagesEndRef" />
    </div>

    <!-- Activity Status Line -->
    <AgentActivityLine
      :is-processing="isProcessing"
      :is-thinking="isThinking"
      :thinking-content="thinkingContent"
      :thinking-start-time="thinkingStartTime"
      :thinking-verb="thinkingVerb"
      :todo-items="todoItems"
      :todo-stats="todoStats"
      :active-tools="activeTools"
      :active-sub-agents="activeSubAgents"
      @cancel="emit('cancel')"
    />

    <!-- Optional custom activity details slot -->
    <slot name="activityDetails" />

    <!-- Quick Actions slot -->
    <div v-if="$slots.quickActions" class="px-4 py-2 bg-white border-t border-gray-100">
      <slot name="quickActions" />
    </div>

    <!-- Input Area -->
    <div class="p-4 bg-white border-t border-gray-200">
      <form class="flex gap-3" @submit.prevent="handleSubmit">
        <div class="relative flex-1">
          <textarea
            ref="inputRef"
            v-model="inputValue"
            :placeholder="placeholder || defaultPlaceholder"
            :disabled="!connected"
            rows="1"
            :class="[
              'w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl resize-none',
              'focus:outline-none focus:ring-2 focus:border-transparent',
              `focus:${colors.ring}`,
              'disabled:bg-gray-100 disabled:cursor-not-allowed',
            ]"
            :style="{ minHeight: '48px', maxHeight: '120px' }"
            @keydown="handleKeyDown"
          />
        </div>
        <button
          type="submit"
          :disabled="!inputValue.trim() || isProcessing || !connected"
          :class="[
            'flex-shrink-0 px-4 rounded-xl text-white',
            colors.bg,
            colors.hover,
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ]"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" :stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  </div>
</template>
