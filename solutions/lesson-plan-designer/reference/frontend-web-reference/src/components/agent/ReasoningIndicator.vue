<script setup lang="ts">
/**
 * ReasoningIndicator - Displays agent's current thinking phase and summary
 *
 * Features:
 * - Shows current phase (analyzing, planning, executing, reviewing)
 * - Displays one-line summary of current thought
 * - Animated phase transitions
 * - Phase-specific icons
 */
import { computed } from 'vue'

export type ReasoningPhase = 'analyzing' | 'planning' | 'executing' | 'reviewing' | ''

const props = defineProps<{
  phase: ReasoningPhase
  summary: string
}>()

/**
 * Phase configuration with icons and labels
 */
const PHASE_CONFIG: Record<ReasoningPhase, { icon: string; label: string; color: string }> = {
  analyzing: { icon: '&#x1F50D;', label: '分析中', color: '#1890ff' },
  planning: { icon: '&#x1F4CB;', label: '规划中', color: '#722ed1' },
  executing: { icon: '&#x26A1;', label: '执行中', color: '#fa8c16' },
  reviewing: { icon: '&#x2713;', label: '检查中', color: '#52c41a' },
  '': { icon: '', label: '', color: '#8c8c8c' },
}

const phaseConfig = computed(() => PHASE_CONFIG[props.phase] || PHASE_CONFIG[''])

const hasPhase = computed(() => Boolean(props.phase))
</script>

<template>
  <transition name="fade">
    <div v-if="hasPhase" class="reasoning-indicator">
      <div class="reasoning-phase" :style="{ '--phase-color': phaseConfig.color }">
        <span class="phase-icon" v-html="phaseConfig.icon"></span>
        <span class="phase-label">{{ phaseConfig.label }}</span>
      </div>
      <div v-if="summary" class="reasoning-summary">
        {{ summary }}
      </div>
    </div>
  </transition>
</template>

<style scoped>
.reasoning-indicator {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
  border-radius: 8px;
  margin: 4px 0;
  border: 1px solid #e6e9f0;
}

.reasoning-phase {
  display: flex;
  align-items: center;
  gap: 6px;
}

.phase-icon {
  font-size: 14px;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.phase-label {
  font-weight: 500;
  font-size: 13px;
  color: var(--phase-color, #1890ff);
}

.reasoning-summary {
  font-size: 12px;
  color: #595959;
  padding-left: 20px;
  line-height: 1.4;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
