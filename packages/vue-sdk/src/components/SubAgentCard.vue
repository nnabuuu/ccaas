<script setup lang="ts">
/**
 * SubAgentCard - Glassmorphism card for subagent progress
 *
 * Features:
 * - Glassmorphism style with frosted glass effect
 * - Dark tech color palette (#1E293B, #22C55E)
 * - Heroicons v2 SVG icons (no emojis)
 * - Animated progress bar for long-running tasks
 * - Live duration counter with smooth transitions
 */

import type { ActiveSubAgent } from '@kedge-agentic/common'
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  subAgent: ActiveSubAgent
}>()

const elapsed = ref(0)
const isVisible = ref(false)

// Calculate elapsed time
let elapsedInterval: ReturnType<typeof setInterval> | null = null

function startElapsedTimer() {
  const startTime = new Date(props.subAgent.startedAt).getTime()
  elapsedInterval = setInterval(() => {
    elapsed.value = Math.floor((Date.now() - startTime) / 1000)
  }, 1000)
}

// Fade-in animation on mount
let visibilityTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  startElapsedTimer()
  visibilityTimer = setTimeout(() => {
    isVisible.value = true
  }, 50)
})

onUnmounted(() => {
  if (elapsedInterval) clearInterval(elapsedInterval)
  if (visibilityTimer) clearTimeout(visibilityTimer)
})

const minutes = computed(() => Math.floor(elapsed.value / 60))
const seconds = computed(() => elapsed.value % 60)
const formattedTime = computed(() => `${minutes.value}:${seconds.value.toString().padStart(2, '0')}`)

// Estimate progress for visual feedback
const estimatedDuration = 900 // 15 minutes for long tasks
const progress = computed(() => Math.min((elapsed.value / estimatedDuration) * 100, 95))

// Status-based styling
const statusConfig = computed(() => {
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
  return configs[props.subAgent.status]
})

const remainingMinutes = computed(() => Math.ceil((estimatedDuration - elapsed.value) / 60))
</script>

<template>
  <div
    :class="[
      'relative overflow-hidden rounded-xl',
      `bg-gradient-to-r ${statusConfig.bgGradient}`,
      'backdrop-blur-md',
      `border ${statusConfig.borderColor}`,
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
            statusConfig.iconBg,
            statusConfig.iconColor,
            'flex items-center justify-center',
            'transition-transform duration-200',
          ]"
        >
          <!-- Running icon -->
          <svg v-if="subAgent.status === 'running'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" :stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <!-- Completed icon -->
          <svg v-else-if="subAgent.status === 'completed'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" :stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <!-- Failed icon -->
          <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" :stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <!-- Text Content -->
        <div class="flex-1 min-w-0">
          <!-- Agent Description -->
          <p :class="['font-medium truncate', statusConfig.textColor]" style="font-family: Fira Sans, sans-serif">
            {{ subAgent.description || subAgent.agentType }}
          </p>

          <!-- Status Label -->
          <div :class="['flex items-center gap-2 mt-1.5 text-sm', statusConfig.mutedColor]" style="font-family: Fira Sans, sans-serif">
            <template v-if="subAgent.status === 'running'">
              <span>运行中</span>
              <span class="text-slate-500">&middot;</span>
              <span class="font-mono tabular-nums" style="font-family: Fira Code, monospace">
                {{ formattedTime }}
              </span>
              <template v-if="elapsed > 60">
                <span class="text-slate-500">&middot;</span>
                <span class="text-xs opacity-75">~{{ remainingMinutes }} min remaining</span>
              </template>
            </template>
            <span v-else-if="subAgent.status === 'completed'">已完成</span>
            <span v-else-if="subAgent.status === 'failed'">失败</span>
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
</template>
