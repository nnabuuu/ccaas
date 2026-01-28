<script setup lang="ts">
/**
 * TaskCard - Collapsible task card component (Manus UI style)
 *
 * Display format:
 * ┌─────────────────────────────────────────┐
 * │ ✓ Task Title                        ∧   │  <- Collapsible header
 * │   │                                     │
 * │   │  Summary or narrative text...       │
 * │   │                                     │
 * │   │  [🔍] 搜索 `param...`              │  <- Tool activity pills
 * │   │  [✏️] 生成 `content...`            │
 * │   │                                     │
 * │   │  Completion summary text            │
 * └─────────────────────────────────────────┘
 *
 * Features:
 * - Status icon (✓ completed, ○ pending, spinner in progress)
 * - Collapsible content with expand/collapse toggle
 * - Vertical timeline line connecting activities
 * - Support for tool activities and narrative text
 */
import { ref, computed, watch } from 'vue'
import type { AgentTask, TaskActivity } from '@/types'
import ToolActivityPill from './ToolActivityPill.vue'
import TokenBadge from './TokenBadge.vue'

const props = defineProps<{
  task: AgentTask
}>()

const emit = defineEmits<{
  /** Emitted when user clicks rollback button on a completed task */
  rollback: [runSeq: number]
}>()

// Local expanded state (can be overridden by prop)
const isExpanded = ref(props.task.expanded ?? props.task.status === 'in_progress')

// Watch for task expansion changes
watch(() => props.task.expanded, (newVal) => {
  if (newVal !== undefined) {
    isExpanded.value = newVal
  }
})

// Auto-expand in_progress tasks
watch(() => props.task.status, (newStatus) => {
  if (newStatus === 'in_progress') {
    isExpanded.value = true
  }
})

// =============================================================================
// Computed Properties
// =============================================================================

const statusIcon = computed(() => {
  switch (props.task.status) {
    case 'completed': return '✓'
    case 'in_progress': return null  // Show spinner
    case 'pending': return '○'
    default: return '○'
  }
})

const statusClass = computed(() => {
  return props.task.status
})

const hasActivities = computed(() => {
  return props.task.activities && props.task.activities.length > 0
})

const hasSummary = computed(() => {
  return !!props.task.summary
})

/** Whether to show token/duration badge */
const showBadge = computed(() => {
  return props.task.tokens !== undefined || props.task.durationSeconds !== undefined
})

/** Whether this is a completed task with rollback support */
const canRollback = computed(() => {
  return props.task.status === 'completed' && props.task.runSeq !== undefined
})

/** Run indicator text (e.g., "Run 2 of 3") */
const runIndicator = computed(() => {
  if (props.task.runSeq === undefined) return null
  if (props.task.totalRuns !== undefined) {
    return `Run ${props.task.runSeq} of ${props.task.totalRuns}`
  }
  return `Run ${props.task.runSeq}`
})

// =============================================================================
// Methods
// =============================================================================

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
}

function handleRollback() {
  if (props.task.runSeq !== undefined) {
    emit('rollback', props.task.runSeq)
  }
}
</script>

<template>
  <div class="task-card" :class="statusClass">
    <!-- Task Header (clickable to expand/collapse) -->
    <div class="task-header" @click="toggleExpanded">
      <span class="task-status">
        <template v-if="task.status === 'in_progress'">
          <span class="status-spinner"></span>
        </template>
        <template v-else>
          {{ statusIcon }}
        </template>
      </span>

      <span class="task-title">{{ task.title }}</span>

      <!-- Token/Duration Badge (right side) -->
      <TokenBadge
        v-if="showBadge"
        :tokens="task.tokens"
        :duration-seconds="task.durationSeconds"
        compact
        class="task-badge"
      />

      <!-- Run Indicator (for rollback) -->
      <span v-if="runIndicator" class="task-run-indicator">{{ runIndicator }}</span>

      <!-- Rollback Button (appears on hover for completed tasks) -->
      <button
        v-if="canRollback"
        class="task-rollback-btn"
        title="回退到此版本"
        @click.stop="handleRollback"
      >
        <span class="rollback-icon">🔄</span>
        <span class="rollback-text">回退</span>
      </button>

      <span class="task-toggle" :class="{ expanded: isExpanded }">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 5 6 8 9 5" />
        </svg>
      </span>
    </div>

    <!-- Task Body (collapsible content) -->
    <div v-if="isExpanded" class="task-body">
      <!-- Timeline line -->
      <div class="timeline-line"></div>

      <!-- Task content -->
      <div class="task-content">
        <!-- Activities (tool pills and narrative text) -->
        <template v-if="hasActivities">
          <div
            v-for="activity in task.activities"
            :key="activity.id"
            class="activity-item"
          >
            <!-- Tool activity -->
            <template v-if="activity.type === 'tool'">
              <ToolActivityPill :activity="activity" />
            </template>

            <!-- Narrative text -->
            <template v-else-if="activity.type === 'narrative' && activity.text">
              <p class="narrative-text">{{ activity.text }}</p>
            </template>
          </div>
        </template>

        <!-- Empty state -->
        <template v-else-if="task.status === 'in_progress'">
          <p class="narrative-text loading">正在处理中...</p>
        </template>

        <!-- Summary (shown after completion or as intro) -->
        <template v-if="hasSummary">
          <p class="task-summary">{{ task.summary }}</p>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-card {
  background: #f8f9fa;
  border-left: 3px solid #667eea;
  border-radius: 8px;
  margin: 8px 0;
  overflow: hidden;
  transition: all 0.2s ease;
}

/* Status colors */
.task-card.completed {
  border-left-color: #52c41a;
}

.task-card.in_progress {
  border-left-color: #1890ff;
}

.task-card.pending {
  border-left-color: #d9d9d9;
}

/* Header */
.task-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}

.task-header:hover {
  background: #f0f0f0;
}

/* Status icon */
.task-status {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.task-card.completed .task-status {
  color: #52c41a;
}

.task-card.in_progress .task-status {
  color: #1890ff;
}

.task-card.pending .task-status {
  color: #d9d9d9;
}

/* Spinner */
.status-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #e6f7ff;
  border-top-color: #1890ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Title */
.task-title {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: #262626;
  line-height: 1.4;
}

.task-card.completed .task-title {
  color: #52c41a;
}

.task-card.in_progress .task-title {
  color: #1890ff;
}

.task-card.pending .task-title {
  color: #8c8c8c;
}

/* Toggle icon */
.task-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: #8c8c8c;
  transition: transform 0.2s ease;
}

.task-toggle.expanded {
  transform: rotate(180deg);
}

/* Body */
.task-body {
  position: relative;
  padding: 0 16px 12px 16px;
}

/* Timeline line */
.timeline-line {
  position: absolute;
  left: 24px;
  top: 0;
  bottom: 12px;
  width: 2px;
  background: #e8e8e8;
}

.task-card.in_progress .timeline-line {
  background: #91d5ff;
}

.task-card.completed .timeline-line {
  background: #b7eb8f;
}

/* Content */
.task-content {
  padding-left: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Activity item */
.activity-item {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* Narrative text */
.narrative-text {
  font-size: 13px;
  color: #595959;
  line-height: 1.5;
  margin: 4px 0;
}

.narrative-text.loading {
  color: #8c8c8c;
  font-style: italic;
}

/* Summary text */
.task-summary {
  font-size: 13px;
  color: #389e0d;
  line-height: 1.5;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e8e8e8;
}

.task-card.in_progress .task-summary {
  color: #1890ff;
}

/* Token/Duration Badge */
.task-badge {
  margin-left: auto;
  flex-shrink: 0;
}

/* Run Indicator (for rollback/history) */
.task-run-indicator {
  font-size: 11px;
  color: #8c8c8c;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.task-card.completed .task-run-indicator {
  background: rgba(82, 196, 26, 0.1);
  color: #52c41a;
}

.task-card.in_progress .task-run-indicator {
  background: rgba(24, 144, 255, 0.1);
  color: #1890ff;
}

/* Rollback Button (appears on hover) */
.task-rollback-btn {
  display: none;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #fff7e6;
  border: 1px solid #ffd591;
  border-radius: 4px;
  font-size: 11px;
  color: #fa8c16;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.task-card:hover .task-rollback-btn {
  display: inline-flex;
}

.task-rollback-btn:hover {
  background: #ffe7ba;
  border-color: #ffa940;
  color: #d46b08;
}

.rollback-icon {
  font-size: 12px;
}

.rollback-text {
  font-weight: 500;
}

/* Hide run indicator when rollback button is shown */
.task-card:hover .task-run-indicator {
  display: none;
}
</style>
