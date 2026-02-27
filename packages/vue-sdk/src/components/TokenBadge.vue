<script setup lang="ts">
/**
 * TokenBadge - Compact/detailed token usage display
 *
 * Shows input/output/cache tokens and estimated cost.
 * Supports 'compact' (total) and 'detailed' (breakdown) variants.
 */

import type { TokenUsage } from '@kedge-agentic/common'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  tokenUsage: TokenUsage
  variant?: 'compact' | 'detailed'
}>(), {
  variant: 'compact',
})

const total = computed(() => props.tokenUsage.inputTokens + props.tokenUsage.outputTokens)
</script>

<template>
  <!-- Compact variant -->
  <span v-if="variant === 'compact'" class="inline-flex items-center gap-1 text-xs text-gray-500">
    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        :stroke-width="2"
        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
      />
    </svg>
    {{ total.toLocaleString() }} tokens
  </span>

  <!-- Detailed variant -->
  <div v-else class="flex gap-3 text-xs text-gray-500">
    <span>&uarr; {{ tokenUsage.inputTokens.toLocaleString() }}</span>
    <span>&darr; {{ tokenUsage.outputTokens.toLocaleString() }}</span>
    <span
      v-if="tokenUsage.cacheReadTokens !== undefined && tokenUsage.cacheReadTokens > 0"
      class="text-green-600"
    >
      &#x1F4E6; {{ tokenUsage.cacheReadTokens.toLocaleString() }} cached
    </span>
  </div>
</template>
