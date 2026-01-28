<script setup lang="ts">
/**
 * ExplorationProgress - Displays exploration activity from Explore/Plan sub-agents
 *
 * Phase 1.6: Enhanced Event Transparency
 *
 * Features:
 * - Shows current exploration action (glob, grep, read, etc.)
 * - Displays target pattern/file being explored
 * - Shows result summary when complete
 * - Optional history of exploration actions
 */
import { computed } from 'vue'
import { useExploration } from '@kedge/vue-agent-sdk'

const props = withDefaults(defineProps<{
  /** Whether to show exploration history */
  showHistory?: boolean
  /** Maximum history items to show */
  maxHistoryItems?: number
}>(), {
  showHistory: false,
  maxHistoryItems: 5,
})

// Composable
const {
  exploration,
  explorationHistory,
  isExploring,
  actionIcon,
  actionLabel,
  totalResultCount,
  explorationCount,
} = useExploration()

// Computed
const displayHistory = computed(() => {
  if (!props.showHistory) return []
  return explorationHistory.value.slice(-props.maxHistoryItems).reverse()
})

const truncatedTarget = computed(() => {
  const target = exploration.value?.target || ''
  if (target.length <= 60) return target
  return '...' + target.slice(-57)
})

const phaseClass = computed(() => {
  return exploration.value?.phase || 'complete'
})
</script>

<template>
  <div v-if="isExploring || explorationCount > 0" class="exploration-progress">
    <!-- Current exploration -->
    <transition name="exploration-fade">
      <div v-if="exploration" class="current-exploration" :class="phaseClass">
        <div class="exploration-header">
          <span class="action-icon">{{ actionIcon }}</span>
          <span class="action-label">{{ actionLabel }}</span>
          <span v-if="exploration.agentType !== 'main'" class="agent-badge">
            {{ exploration.agentType }}
          </span>
        </div>

        <div class="exploration-target" :title="exploration.target">
          {{ truncatedTarget }}
        </div>

        <div v-if="exploration.resultSummary" class="exploration-result">
          {{ exploration.resultSummary }}
        </div>

        <!-- Progress indicator -->
        <div v-if="isExploring" class="progress-bar">
          <div class="progress-fill" />
        </div>
      </div>
    </transition>

    <!-- Summary stats -->
    <div v-if="explorationCount > 0 && !isExploring" class="exploration-summary">
      <span class="summary-icon">📊</span>
      <span class="summary-text">
        {{ explorationCount }} exploration{{ explorationCount > 1 ? 's' : '' }}
        · {{ totalResultCount }} result{{ totalResultCount !== 1 ? 's' : '' }}
      </span>
    </div>

    <!-- History (optional) -->
    <div v-if="showHistory && displayHistory.length > 0" class="exploration-history">
      <div
        v-for="(item, index) in displayHistory"
        :key="index"
        class="history-item"
      >
        <span class="history-action">{{ item.action }}</span>
        <span class="history-target">{{ item.target }}</span>
        <span v-if="item.resultCount !== undefined" class="history-count">
          {{ item.resultCount }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exploration-progress {
  background: linear-gradient(135deg, #f0f5ff 0%, #e6f0ff 100%);
  border: 1px solid #d6e4ff;
  border-radius: 8px;
  padding: 12px 16px;
  margin: 8px 0;
}

.current-exploration {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.exploration-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-icon {
  font-size: 14px;
}

.current-exploration.start .action-icon,
.current-exploration.progress .action-icon {
  animation: search-pulse 1s ease-in-out infinite;
}

@keyframes search-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
}

.action-label {
  font-weight: 500;
  font-size: 13px;
  color: #1890ff;
}

.agent-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(24, 144, 255, 0.1);
  color: #1890ff;
  border-radius: 10px;
  margin-left: auto;
}

.exploration-target {
  font-size: 12px;
  color: #595959;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
  background: rgba(0, 0, 0, 0.04);
  padding: 4px 8px;
  border-radius: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exploration-result {
  font-size: 12px;
  color: #52c41a;
  font-weight: 500;
}

.progress-bar {
  height: 2px;
  background: rgba(24, 144, 255, 0.2);
  border-radius: 1px;
  overflow: hidden;
  margin-top: 4px;
}

.progress-fill {
  height: 100%;
  width: 30%;
  background: #1890ff;
  border-radius: 1px;
  animation: progress-slide 1.5s ease-in-out infinite;
}

@keyframes progress-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(433%); }
}

.exploration-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 4px;
}

.summary-icon {
  font-size: 12px;
}

.summary-text {
  color: #595959;
}

.exploration-history {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px dashed #d6e4ff;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #8c8c8c;
  padding: 4px 0;
}

.history-action {
  min-width: 40px;
  color: #bfbfbf;
}

.history-target {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-count {
  color: #52c41a;
  font-weight: 500;
}

/* Fade transition */
.exploration-fade-enter-active,
.exploration-fade-leave-active {
  transition: all 0.3s ease;
}

.exploration-fade-enter-from,
.exploration-fade-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}
</style>
