<script setup lang="ts">
/**
 * TokenUsageDisplay - Detailed token usage metrics display
 *
 * Phase 1.6: Enhanced Event Transparency
 *
 * Different from TokenBadge:
 * - TokenBadge is compact, inline display
 * - TokenUsageDisplay is a detailed metrics panel
 *
 * Features:
 * - Input/output/cached token breakdown
 * - Session cumulative totals
 * - Cache hit rate indicator
 * - Cost estimate (if available)
 * - Current model display
 */
import { computed } from 'vue'
import { useTokenUsage } from '@kedge/vue-agent-sdk'

const props = withDefaults(defineProps<{
  /** Show session totals */
  showSessionTotals?: boolean
  /** Show cache stats */
  showCacheStats?: boolean
  /** Show cost estimate */
  showCost?: boolean
  /** Show model name */
  showModel?: boolean
  /** Compact mode */
  compact?: boolean
}>(), {
  showSessionTotals: true,
  showCacheStats: true,
  showCost: true,
  showModel: false,
  compact: false,
})

// Composable
const {
  tokenUsage,
  sessionTokens,
  currentModel,
  formattedTotalTokens,
  formattedSessionTokens,
  formattedCost,
  hasUsage,
  cacheHitRate,
} = useTokenUsage()

// Computed
const cacheEfficiency = computed(() => {
  if (cacheHitRate.value === 0) return 'low'
  if (cacheHitRate.value < 30) return 'medium'
  return 'high'
})

const displayModel = computed(() => {
  const model = currentModel.value
  if (!model || model === 'unknown') return null
  // Simplify model name
  if (model.includes('claude-3-5-sonnet')) return 'Claude 3.5 Sonnet'
  if (model.includes('claude-3-opus')) return 'Claude 3 Opus'
  if (model.includes('claude-3-haiku')) return 'Claude 3 Haiku'
  return model
})
</script>

<template>
  <div v-if="hasUsage" class="token-usage-display" :class="{ compact }">
    <!-- Current request tokens -->
    <div class="usage-section current">
      <div class="section-header">
        <span class="section-icon">📊</span>
        <span class="section-title">Token Usage</span>
      </div>

      <div class="token-grid">
        <div class="token-stat">
          <span class="stat-label">输入</span>
          <span class="stat-value input">{{ tokenUsage.input.toLocaleString() }}</span>
        </div>
        <div class="token-stat">
          <span class="stat-label">输出</span>
          <span class="stat-value output">{{ tokenUsage.output.toLocaleString() }}</span>
        </div>
        <div class="token-stat total">
          <span class="stat-label">总计</span>
          <span class="stat-value">{{ formattedTotalTokens }}</span>
        </div>
      </div>
    </div>

    <!-- Session totals -->
    <div v-if="showSessionTotals && sessionTokens.total > 0" class="usage-section session">
      <div class="section-header">
        <span class="section-icon">📈</span>
        <span class="section-title">Session Total</span>
      </div>

      <div class="token-grid">
        <div class="token-stat">
          <span class="stat-label">输入</span>
          <span class="stat-value">{{ sessionTokens.input.toLocaleString() }}</span>
        </div>
        <div class="token-stat">
          <span class="stat-label">输出</span>
          <span class="stat-value">{{ sessionTokens.output.toLocaleString() }}</span>
        </div>
        <div class="token-stat total">
          <span class="stat-label">总计</span>
          <span class="stat-value">{{ formattedSessionTokens }}</span>
        </div>
      </div>
    </div>

    <!-- Cache stats -->
    <div v-if="showCacheStats && sessionTokens.cached > 0" class="cache-stats">
      <div class="cache-indicator" :class="cacheEfficiency">
        <span class="cache-icon">💾</span>
        <span class="cache-label">Cache</span>
        <span class="cache-value">{{ cacheHitRate }}%</span>
      </div>
      <span class="cache-detail">
        {{ sessionTokens.cached.toLocaleString() }} tokens cached
      </span>
    </div>

    <!-- Cost estimate -->
    <div v-if="showCost && formattedCost !== '$0.00'" class="cost-estimate">
      <span class="cost-icon">💰</span>
      <span class="cost-label">Estimated Cost:</span>
      <span class="cost-value">{{ formattedCost }}</span>
    </div>

    <!-- Model info -->
    <div v-if="showModel && displayModel" class="model-info">
      <span class="model-icon">🤖</span>
      <span class="model-name">{{ displayModel }}</span>
    </div>
  </div>
</template>

<style scoped>
.token-usage-display {
  background: linear-gradient(135deg, #f9f9f9 0%, #f5f5f5 100%);
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 12px 16px;
}

.token-usage-display.compact {
  padding: 8px 12px;
}

.token-usage-display.compact .token-grid {
  gap: 12px;
}

.token-usage-display.compact .stat-label,
.token-usage-display.compact .stat-value {
  font-size: 11px;
}

.usage-section {
  margin-bottom: 12px;
}

.usage-section:last-of-type {
  margin-bottom: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.section-icon {
  font-size: 12px;
}

.section-title {
  font-size: 11px;
  font-weight: 500;
  color: #8c8c8c;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.token-grid {
  display: flex;
  gap: 16px;
  align-items: center;
}

.token-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.token-stat.total {
  margin-left: auto;
  padding-left: 16px;
  border-left: 1px solid #e8e8e8;
}

.stat-label {
  font-size: 10px;
  color: #bfbfbf;
  text-transform: uppercase;
}

.stat-value {
  font-size: 14px;
  font-weight: 500;
  color: #595959;
  font-variant-numeric: tabular-nums;
}

.stat-value.input {
  color: #1890ff;
}

.stat-value.output {
  color: #52c41a;
}

.token-stat.total .stat-value {
  font-size: 16px;
  color: #262626;
}

.cache-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-top: 1px dashed #e8e8e8;
  margin-top: 8px;
}

.cache-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
}

.cache-indicator.low {
  background: #fff1f0;
  color: #cf1322;
}

.cache-indicator.medium {
  background: #fffbe6;
  color: #d48806;
}

.cache-indicator.high {
  background: #f6ffed;
  color: #389e0d;
}

.cache-icon {
  font-size: 10px;
}

.cache-label {
  font-weight: 500;
}

.cache-value {
  font-weight: 600;
}

.cache-detail {
  font-size: 11px;
  color: #8c8c8c;
}

.cost-estimate {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px dashed #e8e8e8;
  margin-top: 8px;
  font-size: 12px;
}

.cost-icon {
  font-size: 12px;
}

.cost-label {
  color: #8c8c8c;
}

.cost-value {
  font-weight: 600;
  color: #595959;
}

.model-info {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 8px;
  font-size: 11px;
  color: #8c8c8c;
}

.model-icon {
  font-size: 11px;
}

.model-name {
  font-weight: 500;
}
</style>
