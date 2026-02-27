<script setup lang="ts">
/**
 * AgentActivityLine - Status bar showing current agent activity
 *
 * Simplified status bar with priority-based display:
 * 1. Active todo with activeForm
 * 2. Thinking state (with live duration)
 * 3. Task execution
 * 3.5. Tool activity (including recently ended tools, shown for 2s)
 * 4. SubAgent background tasks
 * 5. Main processing fallback
 *
 * Features cancel button and thinking content preview.
 */

import type { EventTodoItem, ActiveSubAgent } from '@kedge-agentic/common'
import type { ChatToolActivity } from '../types/chat'
import type { TodoStats } from '../types/tasks'
import { ref, computed, watch, onUnmounted } from 'vue'

const TOOL_ACTIVITY_MAP: Record<string, string> = {
  Read: '正在阅读',
  Write: '正在生成',
  Edit: '正在修改',
  Grep: '正在搜索',
  Glob: '正在查找文件',
  Bash: '正在执行命令',
  Task: '正在执行任务',
  Skill: '正在调用技能',
  WebSearch: '正在搜索网页',
  computer: '正在操作浏览器',
  screenshot: '正在截图',
  navigate: '正在导航',
  _default: '正在处理',
}

function getToolActivityDescription(toolName: string, description?: string): string {
  if (description) return description
  return TOOL_ACTIVITY_MAP[toolName] || TOOL_ACTIVITY_MAP['_default']
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0s'
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
}

const props = withDefaults(defineProps<{
  isProcessing: boolean
  isThinking?: boolean
  thinkingContent?: string
  thinkingStartTime?: number | null
  thinkingVerb?: string
  todoItems?: EventTodoItem[]
  todoStats?: TodoStats | null
  activeTools?: Map<string, ChatToolActivity>
  activeSubAgents?: ActiveSubAgent[]
}>(), {
  isThinking: false,
  thinkingContent: '',
  thinkingStartTime: null,
  thinkingVerb: '思考',
  todoItems: () => [],
  todoStats: null,
  activeTools: () => new Map(),
  activeSubAgents: () => [],
})

const emit = defineEmits<{
  cancel: []
}>()

const hasActiveSubAgents = computed(() => props.activeSubAgents.length > 0)

// Real-time current time for thinking duration
const currentTime = ref(Date.now())
let thinkingTimer: ReturnType<typeof setInterval> | null = null

watch(
  () => [props.isThinking, props.thinkingStartTime] as const,
  ([thinking, startTime]) => {
    if (thinkingTimer) {
      clearInterval(thinkingTimer)
      thinkingTimer = null
    }
    if (thinking && startTime) {
      thinkingTimer = setInterval(() => {
        currentTime.value = Date.now()
      }, 1000)
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  if (thinkingTimer) clearInterval(thinkingTimer)
})

const thinkingDuration = computed(() => {
  return props.thinkingStartTime ? currentTime.value - props.thinkingStartTime : 0
})

// Filter: Only keep top-level Task tools (nesting level 0)
const topLevelTasks = computed(() => {
  return Array.from(props.activeTools.values()).filter(
    (tool) => (tool.nestingLevel ?? 0) === 0 && tool.toolName === 'Task' && tool.phase !== 'end'
  )
})

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

// Status label with priority logic
const statusLabel = computed((): { primary: string; secondary?: string; isThinking?: boolean } => {
  const activeTodo = props.todoItems.find((t) => t.status === 'in_progress')
  const firstTask = topLevelTasks.value[0]
  const firstTool = Array.from(props.activeTools.values())[0]

  // Priority 1: Active Todo
  if (activeTodo?.activeForm) {
    return {
      primary: activeTodo.activeForm,
      secondary: props.todoStats ? `${props.todoStats.completed}/${props.todoStats.total}` : undefined,
    }
  }

  // Priority 2: Thinking state
  if (props.isThinking && props.thinkingStartTime) {
    return {
      primary: `${props.thinkingVerb}了 ${formatDuration(thinkingDuration.value)}`,
      isThinking: true,
    }
  }

  // Priority 3: Task execution
  if (firstTask) {
    return {
      primary: firstTask.description || firstTask.toolName,
      secondary:
        firstTask.agentType && firstTask.agentType !== 'main'
          ? `[${firstTask.agentType}]`
          : undefined,
    }
  }

  // Priority 3.5: Tool activity (including recently ended, shown for 2s)
  if (firstTool) {
    const shouldShow =
      firstTool.phase !== 'end' ||
      (firstTool.endTime && Date.now() - firstTool.endTime < 2000)

    if (shouldShow) {
      return {
        primary: getToolActivityDescription(firstTool.toolName, firstTool.description),
      }
    }
  }

  // Priority 4: SubAgent background tasks
  if (hasActiveSubAgents.value) {
    const count = props.activeSubAgents.length
    const descriptions = props.activeSubAgents.map((a) => a.description || a.agentType).join(', ')
    return {
      primary: `${count}个后台任务运行中`,
      secondary: truncate(descriptions, 60),
    }
  }

  // Priority 5: Main processing fallback
  if (props.isProcessing) {
    return { primary: '正在响应...' }
  }

  return { primary: '' }
})

const label = computed(() => statusLabel.value.primary)
const detail = computed(() => statusLabel.value.secondary)
const labelIsThinking = computed(() => statusLabel.value.isThinking ?? false)

const progress = computed(() => {
  return props.todoStats && props.todoStats.total > 0
    ? `${props.todoStats.completed}/${props.todoStats.total}`
    : null
})

const shouldShow = computed(() => props.isProcessing || hasActiveSubAgents.value)
</script>

<template>
  <div
    v-if="shouldShow"
    :class="[
      'border-t',
      labelIsThinking
        ? 'border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50'
        : 'border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50',
    ]"
  >
    <div class="px-4 py-3 space-y-2">
      <!-- Status line -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <!-- Animated spinner -->
          <div v-if="isProcessing" class="relative flex-shrink-0">
            <svg
              :class="['w-5 h-5 animate-spin', labelIsThinking ? 'text-purple-600' : 'text-blue-600']"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="3"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <div class="absolute inset-0 animate-ping opacity-20">
              <div :class="['w-5 h-5 rounded-full', labelIsThinking ? 'bg-purple-600' : 'bg-blue-600']" />
            </div>
          </div>

          <!-- Status label -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1">
              <span
                :class="[
                  'text-sm font-medium truncate',
                  labelIsThinking
                    ? 'bg-gradient-to-r from-purple-700 to-indigo-700 bg-clip-text text-transparent'
                    : 'text-gray-700',
                ]"
              >
                {{ label }}
              </span>

              <!-- Dynamic dots (only when thinking) -->
              <span v-if="labelIsThinking" class="inline-flex ml-0.5">
                <span class="animate-pulse text-purple-600" :style="{ animationDelay: '0ms', animationDuration: '1.5s' }">.</span>
                <span class="animate-pulse text-purple-600" :style="{ animationDelay: '500ms', animationDuration: '1.5s' }">.</span>
                <span class="animate-pulse text-purple-600" :style="{ animationDelay: '1000ms', animationDuration: '1.5s' }">.</span>
              </span>
            </div>
            <span v-if="detail" class="text-xs text-gray-600 truncate mt-0.5">{{ detail }}</span>
            <span
              v-if="progress && !labelIsThinking"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1"
            >
              {{ progress }}
            </span>
          </div>
        </div>

        <!-- Cancel button -->
        <div v-if="emit" class="flex items-center gap-2 ml-3 flex-shrink-0">
          <button
            class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 hover:text-red-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500"
            aria-label="取消处理"
            @click="emit('cancel')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                :stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <span>取消</span>
          </button>
        </div>
      </div>

      <!-- Thinking content preview -->
      <div v-if="isThinking && thinkingContent" class="pl-8 pr-4">
        <div class="p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
          <div class="text-xs text-purple-900 leading-relaxed whitespace-pre-wrap break-words">
            <template v-if="thinkingContent.length > 150">...</template>{{ thinkingContent.slice(-150) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
