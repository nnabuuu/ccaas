<script setup lang="ts">
/**
 * TokenBadge - Compact token/cost display component
 *
 * Display formats:
 * - Token count only: "3.2k tokens"
 * - With duration: "45s · 3.2k tokens"
 *
 * Features:
 * - Formats large numbers (1000 → "1k", 15000 → "15k")
 * - Optional duration display
 * - Muted, non-intrusive styling
 * - Right-aligned in parent container
 */
import { computed } from 'vue'

const props = defineProps<{
  /** Token count (raw number, will be formatted) */
  tokens?: number
  /** Duration in seconds (optional) */
  durationSeconds?: number
  /** Duration in milliseconds (alternative to durationSeconds) */
  durationMs?: number
  /** Show in compact mode (smaller font, less padding) */
  compact?: boolean
}>()

// =============================================================================
// Computed Properties
// =============================================================================

/**
 * Format token count for display
 * @example 1000 → "1k", 15000 → "15k", 500 → "500"
 */
const formattedTokens = computed(() => {
  const t = props.tokens
  if (t === undefined || t === null) return null
  if (t < 1000) return `${t}`
  if (t < 10000) return `${(t / 1000).toFixed(1)}k`
  return `${Math.round(t / 1000)}k`
})

/**
 * Format duration for display
 * @example 45 → "45s", 125 → "2m 5s"
 */
const formattedDuration = computed(() => {
  let seconds = props.durationSeconds

  // Convert from milliseconds if provided
  if (seconds === undefined && props.durationMs !== undefined) {
    seconds = Math.round(props.durationMs / 1000)
  }

  if (seconds === undefined || seconds === null) return null

  if (seconds < 60) {
    return `${seconds}s`
  }

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  if (secs === 0) {
    return `${mins}m`
  }

  return `${mins}m ${secs}s`
})

/**
 * Has any displayable content
 */
const hasContent = computed(() => {
  return formattedTokens.value !== null || formattedDuration.value !== null
})
</script>

<template>
  <span v-if="hasContent" class="token-badge" :class="{ compact }">
    <span v-if="formattedDuration" class="duration">{{ formattedDuration }}</span>
    <span v-if="formattedDuration && formattedTokens" class="separator">·</span>
    <span v-if="formattedTokens" class="tokens">{{ formattedTokens }} tokens</span>
  </span>
</template>

<style scoped>
.token-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #8c8c8c;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.token-badge.compact {
  font-size: 11px;
  gap: 4px;
}

.duration {
  color: #8c8c8c;
}

.separator {
  color: #d9d9d9;
}

.tokens {
  color: #a6a6a6;
}

/* Slightly darker colors when in a dark background context */
.task-card.completed .token-badge,
.task-card.in_progress .token-badge {
  color: #a6a6a6;
}

.task-card.completed .token-badge .duration,
.task-card.in_progress .token-badge .duration {
  color: #8c8c8c;
}
</style>
