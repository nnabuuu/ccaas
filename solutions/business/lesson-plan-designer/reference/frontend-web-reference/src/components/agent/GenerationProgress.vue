<script setup lang="ts">
/**
 * GenerationProgress - Displays content generation progress with module tracking
 *
 * Features:
 * - Progress bar with percentage
 * - Current step display
 * - Module status indicators (7 lesson plan modules)
 * - Animated transitions
 */
import { computed } from 'vue'

const props = defineProps<{
  generating: boolean
  percentage: number
  currentStep: string
  completedSteps: number
  totalSteps: number
}>()

/**
 * Module names mapping for lesson plan
 */
const MODULES = [
  { key: 'courseRequirements', label: '课程要求' },
  { key: 'textbookAnalysis', label: '教材分析' },
  { key: 'studentAnalysis', label: '学情分析' },
  { key: 'learningObjectives', label: '学习目标' },
  { key: 'preClassPreparation', label: '课前准备' },
  { key: 'learningProcess', label: '学习过程' },
  { key: 'homeworkAssessment', label: '作业评价' },
]

/**
 * Determine module status based on completed steps
 */
function getModuleStatus(index: number): 'completed' | 'active' | 'pending' {
  if (index < props.completedSteps) {
    return 'completed'
  }
  if (index === props.completedSteps) {
    return 'active'
  }
  return 'pending'
}

/**
 * Format percentage for display
 */
const displayPercentage = computed(() => {
  return Math.round(props.percentage)
})
</script>

<template>
  <div class="generation-progress" v-if="generating">
    <!-- Header with percentage -->
    <div class="progress-header">
      <span class="progress-label">
        <span class="progress-icon">&#x2728;</span>
        生成内容中...
      </span>
      <span class="progress-percent">{{ displayPercentage }}%</span>
    </div>

    <!-- Progress bar -->
    <div class="progress-bar-container">
      <div class="progress-bar" :style="{ width: percentage + '%' }">
        <div class="progress-glow"></div>
      </div>
    </div>

    <!-- Current step -->
    <div class="progress-step" v-if="currentStep">
      <span class="step-icon">&#x2192;</span>
      <span class="step-label">{{ currentStep }}</span>
    </div>

    <!-- Module indicators -->
    <div class="progress-modules">
      <div
        v-for="(module, index) in MODULES"
        :key="module.key"
        class="module-indicator"
        :class="getModuleStatus(index)"
      >
        <span class="module-icon">
          <template v-if="getModuleStatus(index) === 'completed'">✓</template>
          <template v-else-if="getModuleStatus(index) === 'active'">
            <span class="module-spinner"></span>
          </template>
          <template v-else>○</template>
        </span>
        <span class="module-label">{{ module.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.generation-progress {
  background: linear-gradient(135deg, #f5f0ff 0%, #ede8f5 100%);
  border-radius: 8px;
  padding: 12px;
  margin: 8px 0;
  border: 1px solid #d9d0e8;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: #5b4a8d;
  font-size: 13px;
}

.progress-icon {
  font-size: 14px;
}

.progress-percent {
  font-weight: 600;
  color: #667eea;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.progress-bar-container {
  height: 6px;
  background: rgba(102, 126, 234, 0.15);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
  position: relative;
}

.progress-glow {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 20px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4));
  animation: glow 1s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

.progress-step {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #5b4a8d;
  margin-bottom: 10px;
  padding: 6px 8px;
  background: rgba(102, 126, 234, 0.08);
  border-radius: 4px;
}

.step-icon {
  color: #667eea;
}

.step-label {
  flex: 1;
}

.progress-modules {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.module-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.module-indicator.completed {
  background: rgba(82, 196, 26, 0.15);
  color: #52c41a;
}

.module-indicator.active {
  background: rgba(24, 144, 255, 0.15);
  color: #1890ff;
  font-weight: 500;
}

.module-indicator.pending {
  background: rgba(0, 0, 0, 0.04);
  color: #8c8c8c;
}

.module-icon {
  width: 14px;
  text-align: center;
}

.module-spinner {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 2px solid #1890ff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.module-label {
  white-space: nowrap;
}
</style>
