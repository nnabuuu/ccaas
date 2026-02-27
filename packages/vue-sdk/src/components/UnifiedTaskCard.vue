<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { UnifiedTask } from '../types/tasks'
import type { ActiveSubAgent } from '@kedge-agentic/common'

const props = withDefaults(defineProps<{
  task: UnifiedTask
  isHighlighted?: boolean
}>(), {
  isHighlighted: false,
})

// --- SubAgent card logic ---
const elapsed = ref(0)
const isVisible = ref(false)
let elapsedInterval: ReturnType<typeof setInterval> | null = null
let visibleTimeout: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  if (props.task.type === 'subagent') {
    const subAgent = props.task.raw as ActiveSubAgent
    const startTime = new Date(subAgent.startedAt).getTime()
    elapsedInterval = setInterval(() => {
      elapsed.value = Math.floor((Date.now() - startTime) / 1000)
    }, 1000)
    visibleTimeout = setTimeout(() => {
      isVisible.value = true
    }, 50)
  }
})

onUnmounted(() => {
  if (elapsedInterval) clearInterval(elapsedInterval)
  if (visibleTimeout) clearTimeout(visibleTimeout)
})

const formattedTime = computed(() => {
  const minutes = Math.floor(elapsed.value / 60)
  const seconds = elapsed.value % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
})

const estimatedDuration = 900 // 15 minutes
const progress = computed(() => Math.min((elapsed.value / estimatedDuration) * 100, 95))

const subAgent = computed(() => {
  if (props.task.type === 'subagent') {
    return props.task.raw as ActiveSubAgent
  }
  return null
})

const subAgentStatusConfig = computed(() => {
  if (!subAgent.value) return null
  const configs: Record<'running' | 'completed' | 'failed', {
    borderColor: string
    bgGradient: string
    iconBg: string
    iconColor: string
    textColor: string
    mutedColor: string
  }> = {
    running: {
      borderColor: 'border-blue-500/30',
      bgGradient: 'from-blue-500/10 to-transparent',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      textColor: 'text-slate-100',
      mutedColor: 'text-slate-400',
    },
    completed: {
      borderColor: 'border-green-500/30',
      bgGradient: 'from-green-500/10 to-transparent',
      iconBg: 'bg-green-500/20',
      iconColor: 'text-green-400',
      textColor: 'text-slate-100',
      mutedColor: 'text-slate-400',
    },
    failed: {
      borderColor: 'border-red-500/30',
      bgGradient: 'from-red-500/10 to-transparent',
      iconBg: 'bg-red-500/20',
      iconColor: 'text-red-400',
      textColor: 'text-slate-100',
      mutedColor: 'text-slate-400',
    },
  }
  return configs[subAgent.value.status]
})

// --- Todo card logic ---
const todoStatusConfig = computed(() => {
  switch (props.task.status) {
    case 'running':
    case 'in_progress':
      return { bg: 'bg-green-100', text: 'text-green-800', icon: '\u23F3', label: '\u8FD0\u884C\u4E2D' }
    case 'completed':
      return { bg: 'bg-blue-100', text: 'text-blue-800', icon: '\u2713', label: '\u5B8C\u6210' }
    case 'failed':
      return { bg: 'bg-red-100', text: 'text-red-800', icon: '\u2717', label: '\u5931\u8D25' }
    case 'pending':
      return { bg: 'bg-amber-100', text: 'text-amber-800', icon: '\u22EF', label: '\u7B49\u5F85\u4E2D' }
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800', icon: '', label: props.task.status }
  }
})

const remainingMinutes = computed(() => {
  if (elapsed.value > 60) {
    return Math.ceil((estimatedDuration - elapsed.value) / 60)
  }
  return null
})
</script>

<template>
  <!-- SubAgent type -->
  <div v-if="task.type === 'subagent' && subAgent && subAgentStatusConfig">
    <div
      :class="[
        'transition-all duration-300',
        isHighlighted ? 'ring-2 ring-blue-500 bg-blue-50 shadow-lg' : '',
      ]"
    >
      <div
        :class="[
          'relative overflow-hidden rounded-xl',
          'bg-gradient-to-r', subAgentStatusConfig.bgGradient,
          'backdrop-blur-md',
          'border', subAgentStatusConfig.borderColor,
          'shadow-lg shadow-black/20',
          'transition-all duration-300 ease-out',
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
        ]"
        :style="{ backgroundColor: 'rgba(30, 41, 59, 0.6)' }"
      >
        <!-- Animated progress bar overlay (only for running tasks) -->
        <div
          v-if="subAgent.status === 'running'"
          class="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent transition-all duration-1000 ease-linear"
          :style="{ width: `${progress}%` }"
        />

        <!-- Content -->
        <div class="relative p-4">
          <div class="flex items-start gap-3">
            <!-- Status Icon -->
            <div
              :class="[
                'flex-shrink-0 w-10 h-10 rounded-lg',
                subAgentStatusConfig.iconBg, subAgentStatusConfig.iconColor,
                'flex items-center justify-center',
                'transition-transform duration-200',
              ]"
            >
              <!-- Running icon -->
              <svg v-if="subAgent.status === 'running'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <!-- Completed icon -->
              <svg v-else-if="subAgent.status === 'completed'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <!-- Failed icon -->
              <svg v-else-if="subAgent.status === 'failed'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <!-- Text Content -->
            <div class="flex-1 min-w-0">
              <!-- Agent Description -->
              <p :class="['font-medium truncate', subAgentStatusConfig.textColor]" style="font-family: Fira Sans, sans-serif">
                {{ subAgent.description || subAgent.agentType }}
              </p>

              <!-- Status Label -->
              <div :class="['flex items-center gap-2 mt-1.5 text-sm', subAgentStatusConfig.mutedColor]" style="font-family: Fira Sans, sans-serif">
                <template v-if="subAgent.status === 'running'">
                  <span>\u8FD0\u884C\u4E2D</span>
                  <span class="text-slate-500">&middot;</span>
                  <span class="font-mono tabular-nums" style="font-family: Fira Code, monospace">
                    {{ formattedTime }}
                  </span>
                  <template v-if="remainingMinutes !== null">
                    <span class="text-slate-500">&middot;</span>
                    <span class="text-xs opacity-75">~{{ remainingMinutes }} min remaining</span>
                  </template>
                </template>
                <span v-if="subAgent.status === 'completed'">\u5DF2\u5B8C\u6210</span>
                <span v-if="subAgent.status === 'failed'">\u5931\u8D25</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom progress indicator (thin line) -->
        <div v-if="subAgent.status === 'running'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-700/50">
          <div
            class="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-1000 ease-linear"
            :style="{ width: `${progress}%` }"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Todo type -->
  <div
    v-else
    :class="[
      'p-3 border rounded-lg transition-all duration-300',
      isHighlighted
        ? 'ring-2 ring-blue-500 bg-blue-50 shadow-lg border-blue-200'
        : 'bg-white border-gray-200 hover:border-gray-300',
    ]"
  >
    <div class="flex items-center justify-between gap-3">
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-gray-800 truncate">
          {{ task.activeForm || task.title }}
        </div>
        <div v-if="task.progress !== undefined" class="mt-1.5 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            class="h-full bg-blue-500 transition-all duration-300"
            :style="{ width: `${task.progress}%` }"
          />
        </div>
      </div>
      <!-- StatusBadge -->
      <span
        :class="[
          'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
          todoStatusConfig.bg, todoStatusConfig.text,
        ]"
      >
        <span v-if="todoStatusConfig.icon" class="mr-1">{{ todoStatusConfig.icon }}</span>
        {{ todoStatusConfig.label }}
      </span>
    </div>
  </div>
</template>
