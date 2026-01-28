<script setup lang="ts">
/**
 * @deprecated This component is deprecated as of the Chatbox Redesign (2024-01).
 * Its functionality has been merged into TaskCard.vue.
 *
 * AgentStoryHeader - Level 1: Goal Narrative Display
 *
 * Always-visible component showing:
 * - What the AI is trying to accomplish
 * - Progress bar with percentage
 * - Current task description with WHY explanation
 * - Context pills (subject, chapter, edition)
 *
 * MIGRATION: Use TaskCard instead, which now includes:
 * - Token badge (TokenBadge.vue)
 * - Run indicator (runSeq/totalRuns)
 * - Rollback support
 */
import { inject, computed } from 'vue'
import type { Ref } from 'vue'

interface GoalNarrative {
  title: string
  subject: string
  chapter: string
  edition: string
}

interface DecisionLogic {
  why: string
  benefit: string
  nextStep?: string
}

interface Progress {
  totalSteps: number
  completedSteps: number
  currentStep: string
  percentage: number
}

// Inject from AgentListener
const goalNarrative = inject<Ref<GoalNarrative>>('goalNarrative')
const currentDecisionLogic = inject<Ref<DecisionLogic>>('currentDecisionLogic')
const aiOutputProgress = inject<Ref<Progress>>('aiOutputProgress')
const isAgentProcessing = inject<Ref<boolean>>('isAgentProcessing')
const currentAgentType = inject<Ref<string>>('currentAgentType')

// Computed: Generate title based on agent type
const displayTitle = computed(() => {
  if (goalNarrative?.value?.title) {
    return goalNarrative.value.title
  }
  const agentType = currentAgentType?.value
  if (agentType === 'lesson-plan-designer') {
    return '正在为您设计教案'
  }
  return '正在处理中'
})

// Computed: Current task description
const currentTask = computed(() => {
  const logic = currentDecisionLogic?.value
  if (logic?.why) {
    return logic.why
  }
  const progress = aiOutputProgress?.value
  if (progress?.currentStep) {
    return progress.currentStep
  }
  return ''
})

// Computed: Progress percentage
const progressPercentage = computed(() => {
  return aiOutputProgress?.value?.percentage || 0
})

// Computed: Has context info to show
const hasContext = computed(() => {
  const goal = goalNarrative?.value
  return goal?.subject || goal?.chapter || goal?.edition
})

// Computed: Show component only when processing
const isVisible = computed(() => {
  return isAgentProcessing?.value === true
})
</script>

<template>
  <div class="agent-story-header" v-if="isVisible">
    <!-- Title -->
    <div class="story-title">
      <span class="story-icon">🤖</span>
      <span class="story-text">{{ displayTitle }}</span>
    </div>

    <!-- Progress Bar -->
    <div class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progressPercentage}%` }"></div>
      </div>
      <span class="progress-percentage">{{ progressPercentage }}%</span>
    </div>

    <!-- Current Task (with WHY) -->
    <div class="current-task" v-if="currentTask">
      <span class="task-label">当前:</span>
      <span class="task-text">{{ currentTask }}</span>
    </div>

    <!-- Context Pills -->
    <div class="context-pills" v-if="hasContext">
      <span class="context-pill" v-if="goalNarrative?.subject">
        📚 {{ goalNarrative.subject }}
      </span>
      <span class="context-divider" v-if="goalNarrative?.subject && goalNarrative?.chapter">·</span>
      <span class="context-pill" v-if="goalNarrative?.chapter">
        {{ goalNarrative.chapter }}
      </span>
      <span class="context-divider" v-if="goalNarrative?.chapter && goalNarrative?.edition">·</span>
      <span class="context-pill" v-if="goalNarrative?.edition">
        {{ goalNarrative.edition }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.agent-story-header {
  --header-bg: #f8f9fc;
  --header-border: #e0e4ea;
  --header-text: #374151;
  --header-muted: #6b7280;
  --progress-bg: #e5e7eb;
  --progress-fill: linear-gradient(90deg, #667eea 0%, #764ba2 100%);

  background: var(--header-bg);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid var(--header-border);
}

/* Dark theme */
@media (prefers-color-scheme: dark) {
  .agent-story-header {
    --header-bg: #1f2937;
    --header-border: #374151;
    --header-text: #f3f4f6;
    --header-muted: #9ca3af;
    --progress-bg: #374151;
  }
}

.story-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--header-text);
  margin-bottom: 12px;
}

.story-icon {
  font-size: 18px;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--progress-bg);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--progress-fill);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-percentage {
  font-size: 13px;
  font-weight: 600;
  color: var(--header-text);
  min-width: 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.current-task {
  font-size: 13px;
  color: var(--header-muted);
  margin-bottom: 12px;
  line-height: 1.5;
}

.task-label {
  color: var(--header-text);
  font-weight: 500;
  margin-right: 4px;
}

.task-text {
  color: var(--header-muted);
}

.context-pills {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 12px;
  color: var(--header-muted);
}

.context-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.context-divider {
  color: var(--header-muted);
  opacity: 0.5;
}
</style>
