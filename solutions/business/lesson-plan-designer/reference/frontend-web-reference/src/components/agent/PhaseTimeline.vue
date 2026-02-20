<script setup lang="ts">
/**
 * @deprecated This component is deprecated as of the Chatbox Redesign (2024-01).
 * Its functionality has been merged into TaskCard.vue.
 *
 * PhaseTimeline - Level 2: Phase Progress with Decision Logic
 *
 * Displays:
 * - Horizontal timeline (collapsed) / Vertical list (expanded)
 * - Current phase with status indicators
 * - Decision logic panel (WHY explanation)
 * - Session metrics (elapsed time, tokens)
 *
 * MIGRATION: Use TaskCard instead, which now includes:
 * - Token badge (TokenBadge.vue)
 * - Run indicator (runSeq/totalRuns)
 * - Collapsible task activities
 */
import { ref, inject, computed } from 'vue'
import type { Ref } from 'vue'

interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
  subSteps?: Array<{
    label: string
    status: 'pending' | 'in_progress' | 'completed'
  }>
}

interface DecisionLogic {
  why: string
  benefit: string
  nextStep?: string
}

interface TokenUsage {
  input: number
  output: number
  total: number
}

interface ToolActivity {
  toolName: string
  toolId: string
  phase: 'start' | 'end' | ''
  description: string
  agentType: string
  duration: number
  success: boolean | null
  timestamp: string
  completed?: boolean
}

// Inject from AgentListener
const subagentTodos = inject<Ref<TodoItem[]>>('subagentTodos')
const currentToolActivity = inject<Ref<ToolActivity>>('currentToolActivity')
const toolActivityHistory = inject<Ref<ToolActivity[]>>('toolActivityHistory')
const currentDecisionLogic = inject<Ref<DecisionLogic>>('currentDecisionLogic')
const sessionStartedAt = inject<Ref<string | null>>('sessionStartedAt')
const elapsedSeconds = inject<Ref<number>>('elapsedSeconds')
const tokenUsage = inject<Ref<TokenUsage>>('tokenUsage')

// Local state
const isExpanded = ref(false)

// Computed: Format elapsed time
const formattedElapsed = computed(() => {
  const seconds = elapsedSeconds?.value || 0
  if (seconds < 60) {
    return `${seconds}s`
  }
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
})

// Computed: Format token count
const formattedTokens = computed(() => {
  const total = tokenUsage?.value?.total || 0
  if (total < 1000) {
    return `${total}`
  }
  return `${(total / 1000).toFixed(1)}k`
})

// Computed: Phase stats
const phaseStats = computed(() => {
  const todos = subagentTodos?.value || []
  const completed = todos.filter(t => t.status === 'completed').length
  const total = todos.length
  return { completed, total }
})

// Computed: Has phases to show
const hasPhases = computed(() => {
  return (subagentTodos?.value?.length || 0) > 0
})

// Computed: Has session metrics
const hasMetrics = computed(() => {
  return sessionStartedAt?.value && (elapsedSeconds?.value || 0) > 0
})

// Computed: Current in-progress phase
const currentPhase = computed(() => {
  const todos = subagentTodos?.value || []
  return todos.find(t => t.status === 'in_progress')
})

// Computed: Has decision logic to show
const hasDecisionLogic = computed(() => {
  const logic = currentDecisionLogic?.value
  return logic?.why || logic?.benefit
})

// Bug Fix 1: Computed - Decision step name with context from multiple sources
// Priority: 1. currentPhase.content (from subagentTodos)
//           2. currentToolActivity.description
//           3. currentToolActivity.toolName
//           4. Fallback: '执行这一步'
const decisionStepName = computed(() => {
  // Priority 1: Use currentPhase from subagentTodos
  if (currentPhase.value?.content) {
    return currentPhase.value.content
  }
  // Priority 2: Use current tool's description
  if (currentToolActivity?.value?.description) {
    // Clean up the description (remove '正在' prefix and '...' suffix)
    const desc = currentToolActivity.value.description
      .replace(/^正在/, '')
      .replace(/\.\.\.$/g, '')
    return desc || currentToolActivity.value.toolName
  }
  // Priority 3: Use tool name
  if (currentToolActivity?.value?.toolName) {
    return currentToolActivity.value.toolName
  }
  // Fallback
  return '执行这一步'
})

// Bug Fix 3: Computed - Tool-based stats when subagentTodos is empty
const toolStats = computed(() => {
  const history = toolActivityHistory?.value || []
  const completed = history.filter(h => h.completed || h.phase === 'end').length
  const inProgress = history.filter(h => h.phase === 'start' && !h.completed).length
  return { completed, inProgress, total: completed + inProgress }
})

// Bug Fix 3: Display stats - prioritize subagent data, fallback to tool data
const displayStats = computed(() => {
  // Priority: use sub-agent todos if available
  if (phaseStats.value.total > 0) {
    return phaseStats.value
  }
  // Fallback to tool activity stats
  return toolStats.value
})

// Get status icon
function getStatusIcon(status: string): string {
  switch (status) {
    case 'completed': return '✓'
    case 'in_progress': return '⏺'
    default: return '○'
  }
}

// Get display text for a todo item
function getTodoDisplayText(todo: TodoItem): string {
  if (todo.status === 'in_progress' && todo.activeForm) {
    return todo.activeForm
  }
  return todo.content
}

// Toggle expanded state
function toggleExpand() {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div class="phase-timeline" v-if="hasPhases || hasMetrics">
    <!-- Decision Logic Panel (when expanded and has logic) - simplified single-line format -->
    <div class="decision-logic-panel" v-if="isExpanded && hasDecisionLogic">
      <span class="decision-icon">💡</span>
      <span class="decision-text">{{ currentDecisionLogic?.why }}</span>
      <span class="decision-benefit" v-if="currentDecisionLogic?.benefit">
        · {{ currentDecisionLogic?.benefit }}
      </span>
    </div>

    <!-- Collapsed: Horizontal Timeline -->
    <div class="timeline-collapsed" v-if="!isExpanded && hasPhases">
      <div class="timeline-phases">
        <template v-for="(todo, index) in subagentTodos" :key="index">
          <span
            class="phase-item"
            :class="{
              completed: todo.status === 'completed',
              active: todo.status === 'in_progress'
            }"
          >
            {{ getStatusIcon(todo.status) }} {{ todo.content.slice(0, 6) }}
          </span>
          <span class="phase-arrow" v-if="index < (subagentTodos?.length || 0) - 1">→</span>
        </template>
      </div>
    </div>

    <!-- Expanded: Vertical List -->
    <div class="timeline-expanded" v-if="isExpanded && hasPhases">
      <div
        v-for="(todo, index) in subagentTodos"
        :key="index"
        class="phase-row"
        :class="{
          completed: todo.status === 'completed',
          active: todo.status === 'in_progress'
        }"
      >
        <span class="phase-icon">{{ getStatusIcon(todo.status) }}</span>
        <div class="phase-content">
          <span class="phase-text">{{ getTodoDisplayText(todo) }}</span>
          <span class="phase-indicator" v-if="todo.status === 'in_progress'">← 当前</span>

          <!-- Sub-steps -->
          <div class="sub-steps" v-if="todo.subSteps && todo.subSteps.length > 0">
            <div
              v-for="(step, stepIndex) in todo.subSteps"
              :key="stepIndex"
              class="sub-step"
              :class="{
                completed: step.status === 'completed',
                active: step.status === 'in_progress'
              }"
            >
              <span class="sub-step-prefix">├</span>
              <span class="sub-step-icon">{{ getStatusIcon(step.status) }}</span>
              <span class="sub-step-text">{{ step.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Metrics Bar -->
    <div class="metrics-bar" v-if="hasMetrics">
      <span class="metric">
        <span class="metric-icon">⏱</span>
        {{ formattedElapsed }}
      </span>
      <span class="metric-divider">·</span>
      <span class="metric">
        <span class="metric-icon">↓</span>
        {{ formattedTokens }} tokens
      </span>
      <!-- Bug Fix 3: Only show progress when we have meaningful data -->
      <template v-if="displayStats.total > 0">
        <span class="metric-divider">·</span>
        <span class="metric">
          {{ displayStats.completed }}/{{ displayStats.total }} 完成
        </span>
      </template>
      <button class="toggle-btn" @click="toggleExpand">
        {{ isExpanded ? '收起 ▲' : '详情 ▼' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.phase-timeline {
  --timeline-bg: #f8f9fc;
  --timeline-border: #e0e4ea;
  --timeline-text: #374151;
  --timeline-muted: #6b7280;
  --timeline-active: #2563eb;
  --timeline-success: #059669;
  --timeline-pending: #9ca3af;
  --decision-bg: #eff6ff;
  --decision-border: #bfdbfe;

  background: var(--timeline-bg);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 8px;
  border: 1px solid var(--timeline-border);
  font-size: 13px;
}

/* Dark theme */
@media (prefers-color-scheme: dark) {
  .phase-timeline {
    --timeline-bg: #1f2937;
    --timeline-border: #374151;
    --timeline-text: #f3f4f6;
    --timeline-muted: #9ca3af;
    --timeline-active: #60a5fa;
    --timeline-success: #34d399;
    --decision-bg: #1e3a5f;
    --decision-border: #2563eb;
  }
}

/* Decision Logic Panel - Simplified single-line format */
.decision-logic-panel {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  background: var(--decision-bg);
  border: 1px solid var(--decision-border);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--timeline-text);
}

.decision-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.decision-text {
  color: var(--timeline-text);
}

.decision-benefit {
  color: var(--timeline-muted);
  font-size: 12px;
}

/* Collapsed Timeline */
.timeline-collapsed {
  margin-bottom: 8px;
}

.timeline-phases {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.phase-item {
  color: var(--timeline-pending);
  font-size: 12px;
}

.phase-item.completed {
  color: var(--timeline-success);
}

.phase-item.active {
  color: var(--timeline-active);
  font-weight: 500;
}

.phase-arrow {
  color: var(--timeline-muted);
  opacity: 0.5;
}

/* Expanded Timeline */
.timeline-expanded {
  margin-bottom: 12px;
}

.phase-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  color: var(--timeline-muted);
}

.phase-row.completed {
  color: var(--timeline-success);
}

.phase-row.active {
  color: var(--timeline-active);
}

.phase-icon {
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}

.phase-content {
  flex: 1;
}

.phase-text {
  display: inline;
}

.phase-indicator {
  margin-left: 8px;
  font-size: 11px;
  opacity: 0.8;
}

/* Sub-steps */
.sub-steps {
  margin-top: 4px;
  margin-left: 4px;
}

.sub-step {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--timeline-muted);
  padding: 2px 0;
}

.sub-step.completed {
  color: var(--timeline-success);
}

.sub-step.active {
  color: var(--timeline-active);
}

.sub-step-prefix {
  opacity: 0.4;
}

.sub-step-icon {
  font-size: 10px;
}

/* Metrics Bar */
.metrics-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--timeline-muted);
  font-size: 12px;
}

.metric {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.metric-icon {
  font-size: 11px;
}

.metric-divider {
  opacity: 0.4;
}

.toggle-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--timeline-active);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
}

.toggle-btn:hover {
  background: rgba(37, 99, 235, 0.1);
}
</style>
