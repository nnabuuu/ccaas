<script setup lang="ts">
/**
 * @deprecated This component is deprecated as of the Chatbox Redesign (2024-01).
 * Terminal-style display replaced by Manus-style TaskCard.vue for visual consistency.
 *
 * ToolActivityIndicator - Claude Code Style Tool Activity Display (Level 3)
 *
 * Displays tool execution in a terminal-style format:
 * ⏺ Read(context.json)
 *   ⎿  读取教案上下文完成 (45ms)
 *
 * When session metrics are available, shows progress panel:
 * ⏺ 正在生成教案 (4m 25s · ↓ 9.5k tokens)
 *   ⎿  ☑ 生成课程标准
 *      ☐ 生成教材分析  ← in_progress
 *      ☐ 生成学情分析
 *
 * MIGRATION: Use TaskCard instead, which provides:
 * - Consistent Manus-style card UI
 * - Token badge (TokenBadge.vue)
 * - Run indicator (runSeq/totalRuns)
 * - Rollback support on hover
 * - Collapsible activities via ToolActivityPill
 *
 * Features (deprecated):
 * - Filter: Show only errors option
 * - Clear: Reset activity history
 *
 * Inject from AgentListener:
 * - currentToolActivity: Current tool being executed
 * - toolActivityHistory: Recent tool activities
 * - sessionStartedAt: Session start time (ISO string)
 * - elapsedSeconds: Elapsed time in seconds
 * - tokenUsage: { input, output, total }
 * - subagentTodos: Array of { content, status, activeForm }
 */
import { ref, inject, computed } from 'vue'
import type { Ref } from 'vue'

interface ToolActivity {
  toolName: string
  toolId: string
  phase: 'start' | 'end' | ''
  description: string
  agentType: string
  duration: number
  success: boolean | null
  timestamp: string
  endDescription?: string
  completed?: boolean
}

interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}

interface TokenUsage {
  input: number
  output: number
  total: number
}

// Inject from AgentListener
const currentToolActivity = inject<Ref<ToolActivity>>('currentToolActivity')
const toolActivityHistory = inject<Ref<ToolActivity[]>>('toolActivityHistory')

// Session progress metrics
const sessionStartedAt = inject<Ref<string | null>>('sessionStartedAt')
const elapsedSeconds = inject<Ref<number>>('elapsedSeconds')
const tokenUsage = inject<Ref<TokenUsage>>('tokenUsage')

// Sub-agent todos for checklist display
const subagentTodos = inject<Ref<TodoItem[]>>('subagentTodos')

// =============================================================================
// Local State: Filter and Clear Controls
// =============================================================================

// Filter: Show only errors
const showOnlyErrors = ref(false)

// Clear activity history
function clearHistory() {
  if (toolActivityHistory?.value) {
    toolActivityHistory.value = []
  }
}

// Toggle error filter
function toggleErrorFilter() {
  showOnlyErrors.value = !showOnlyErrors.value
}

// =============================================================================
// Tool Name → Operation Type Mapping
// =============================================================================

const OPERATION_TYPES: Record<string, string> = {
  'read': 'Read',
  'write': 'Update',
  'read_reference_data': 'Search',
  'todo_write': 'Todo',
  'get_lesson_plan': 'Fetch',
  'get_session_context': 'Load',
  'write_output': 'Generate',
  'search_curriculum_standards': 'Search',
}

function getOperationType(toolName: string): string {
  return OPERATION_TYPES[toolName] || toolName
}

// =============================================================================
// Identifier Extraction from Description
// =============================================================================

interface ExtractionPattern {
  match: RegExp
  result?: string
  extract?: (m: RegExpMatchArray) => string
}

const EXTRACTION_PATTERNS: ExtractionPattern[] = [
  // File-based patterns
  { match: /教案上下文/, result: 'context.json' },
  { match: /已有内容/, result: 'output.json' },
  { match: /任务列表/, result: 'todos.json' },

  // Write patterns - detect module being saved
  { match: /保存课程标准/, result: 'courseRequirements' },
  { match: /保存教材分析/, result: 'textbookAnalysis' },
  { match: /保存学情分析/, result: 'studentAnalysis' },
  { match: /保存教学目标/, result: 'learningObjectives' },
  { match: /保存课前准备/, result: 'preClassPreparation' },
  { match: /保存学习任务/, result: 'learningTasks' },
  { match: /保存课后作业/, result: 'homeworkTasks' },
  { match: /保存生成内容/, result: 'output.json' },

  // Curriculum standards patterns
  { match: /查阅(.+?)「(.+?)」课程标准/, extract: (m) => `${m[1]}/${m[2]}` },
  { match: /课程标准目录/, result: '课程标准' },
  { match: /课程标准学科列表/, result: '学科列表' },
  { match: /读取课程标准/, result: '课程标准' },

  // Textbook patterns
  { match: /教材版本列表/, result: '教材版本' },
  { match: /教材 (.+?) 的章节/, extract: (m) => m[1] },
  { match: /阅读教材内容/, result: '教材内容' },
  { match: /读取教材数据/, result: '教材数据' },

  // Lesson plan patterns
  { match: /教案 #(\d+)/, extract: (m) => `#${m[1]}` },
  { match: /获取教案/, result: '教案' },

  // Todo patterns
  { match: /任务进度.*\((\d+\/\d+)/, extract: (m) => m[1] },
  { match: /全部任务完成.*\((\d+\/\d+)/, extract: (m) => m[1] },
  { match: /更新任务进度/, result: 'todos' },

  // Generic file read/write
  { match: /读取 (.+?)\.\.\./, extract: (m) => m[1] },
  { match: /写入 (.+?)\.\.\./, extract: (m) => m[1] },
]

function extractIdentifier(toolName: string, description: string): string {
  if (!description) return '...'

  for (const pattern of EXTRACTION_PATTERNS) {
    const match = description.match(pattern.match)
    if (match) {
      return pattern.extract ? pattern.extract(match) : (pattern.result || '...')
    }
  }

  // Fallback: extract meaningful part from description
  const cleaned = description
    .replace(/^正在/, '')
    .replace(/\.\.\.$/g, '')
    .replace(/完成.*$/, '')

  return truncatePath(cleaned, 20)
}

function truncatePath(path: string, maxLength: number): string {
  if (path.length <= maxLength) return path
  return path.substring(0, maxLength - 3) + '...'
}

// =============================================================================
// Computed Properties
// =============================================================================

const hasActivity = computed(() => {
  return currentToolActivity?.value?.toolName &&
         currentToolActivity.value.phase === 'start'
})

const recentActivities = computed(() => {
  if (!toolActivityHistory?.value) return []
  let activities = toolActivityHistory.value
    .filter(a => a.completed || a.phase === 'end')

  // Apply error filter if enabled
  if (showOnlyErrors.value) {
    activities = activities.filter(a => a.success === false)
  }

  return activities.slice(0, 10)  // Show more entries (was 5)
})

// Check if we have session metrics to show the progress panel
const hasSessionMetrics = computed(() => {
  return sessionStartedAt?.value && (elapsedSeconds?.value ?? 0) > 0
})

// Check if we have todos to show
const hasTodos = computed(() => {
  return subagentTodos?.value && subagentTodos.value.length > 0
})

// =============================================================================
// Formatting Helpers
// =============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(1)}s`
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

function formatTokens(total: number): string {
  if (total < 1000) {
    return `${total}`
  }
  return `${(total / 1000).toFixed(1)}k`
}

function getCompletionText(activity: ToolActivity): string {
  // Use endDescription if available, otherwise parse from description
  if (activity.endDescription) {
    // Remove duration suffix if present (we display it separately)
    return activity.endDescription.replace(/\s*\(\d+(?:ms|s)\)$/, '')
  }
  return activity.description.replace(/^正在/, '').replace(/\.\.\.$/g, '')
}

// Get todo display text (use activeForm for in_progress, content otherwise)
function getTodoDisplayText(todo: TodoItem): string {
  if (todo.status === 'in_progress' && todo.activeForm) {
    return todo.activeForm
  }
  return todo.content
}

// Get agent type label for header
const agentTypeLabel = computed(() => {
  const agentType = currentToolActivity?.value?.agentType
  if (agentType === 'lesson-plan-designer') {
    return '正在生成教案'
  }
  return '正在处理'
})
</script>

<template>
  <div class="tool-activity-terminal" v-if="hasActivity || recentActivities.length > 0 || (hasSessionMetrics && hasTodos)">
    <!-- Terminal Header with Controls -->
    <div class="terminal-header" v-if="recentActivities.length > 0 && !hasSessionMetrics">
      <span class="terminal-title">🔧 执行日志</span>
      <div class="terminal-controls">
        <button
          class="control-btn"
          :class="{ active: showOnlyErrors }"
          @click="toggleErrorFilter"
          title="仅显示错误"
        >
          仅错误
        </button>
        <button
          class="control-btn"
          @click="clearHistory"
          title="清空日志"
        >
          清空
        </button>
      </div>
    </div>

    <!-- Progress Panel Mode: When we have session metrics + todos -->
    <template v-if="hasSessionMetrics && hasTodos">
      <!-- Header with metrics -->
      <div class="progress-header">
        <span class="progress-icon spinning">⏺</span>
        <span class="progress-label">{{ agentTypeLabel }}</span>
        <span class="progress-metrics">
          ({{ formatElapsed(elapsedSeconds || 0) }} · ↓ {{ formatTokens(tokenUsage?.total || 0) }} tokens)
        </span>
      </div>

      <!-- Todo checklist -->
      <div class="progress-todos">
        <div
          v-for="(todo, index) in subagentTodos"
          :key="index"
          class="progress-todo"
          :class="{ 'in-progress': todo.status === 'in_progress' }"
        >
          <span class="todo-prefix">⎿</span>
          <span class="todo-icon">{{ todo.status === 'completed' ? '☑' : '☐' }}</span>
          <span class="todo-text">{{ getTodoDisplayText(todo) }}</span>
          <span v-if="todo.status === 'in_progress'" class="todo-indicator">←</span>
        </div>
      </div>
    </template>

    <!-- Standard Mode: Tool activity display -->
    <template v-else>
      <!-- Current Active Tool -->
      <div class="activity-line active" v-if="hasActivity && currentToolActivity">
        <span class="activity-icon spinning">⏺</span>
        <span class="activity-operation">{{ getOperationType(currentToolActivity.toolName) }}</span>
        <span class="activity-path">({{ extractIdentifier(currentToolActivity.toolName, currentToolActivity.description) }})</span>
      </div>

      <!-- Completed Activities -->
      <div
        v-for="activity in recentActivities"
        :key="activity.toolId"
        class="activity-group"
      >
        <div class="activity-line completed" :class="{ error: activity.success === false }">
          <span class="activity-icon">{{ activity.success === false ? '✗' : '✓' }}</span>
          <span class="activity-operation">{{ getOperationType(activity.toolName) }}</span>
          <span class="activity-path">({{ extractIdentifier(activity.toolName, activity.description) }})</span>
        </div>
        <div class="activity-detail">
          <span class="branch-symbol">⎿</span>
          <span class="detail-text">{{ getCompletionText(activity) }}</span>
          <span class="detail-duration" v-if="activity.duration">({{ formatDuration(activity.duration) }})</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tool-activity-terminal {
  /* Light theme (default) */
  --terminal-bg: #f8f9fc;
  --terminal-border: #e0e4ea;
  --terminal-text: #374151;
  --terminal-active: #2563eb;
  --terminal-success: #059669;
  --terminal-error: #dc2626;
  --terminal-operation: #2563eb;
  --terminal-path: #6b7280;
  --terminal-detail: #9ca3af;
  --terminal-muted: #d1d5db;

  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  background: var(--terminal-bg);
  border-radius: 8px;
  padding: 12px 14px;
  margin: 8px 0;
  font-size: 13px;
  line-height: 1.6;
  border: 1px solid var(--terminal-border);
}

/* =============================================================================
 * Terminal Header with Controls
 * ============================================================================= */

.terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--terminal-border);
}

.terminal-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--terminal-text);
}

.terminal-controls {
  display: flex;
  gap: 6px;
}

.control-btn {
  background: none;
  border: 1px solid var(--terminal-border);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  color: var(--terminal-detail);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
}

.control-btn:hover {
  background: var(--terminal-border);
  color: var(--terminal-text);
}

.control-btn.active {
  background: var(--terminal-active);
  border-color: var(--terminal-active);
  color: white;
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .tool-activity-terminal {
    --terminal-bg: #1a1a2e;
    --terminal-border: #2d2d44;
    --terminal-text: #e0e0e0;
    --terminal-active: #64b5f6;
    --terminal-success: #81c784;
    --terminal-error: #e57373;
    --terminal-operation: #90caf9;
    --terminal-path: #9e9e9e;
    --terminal-detail: #a0a0a0;
    --terminal-muted: #616161;
  }
}

/* Also support .dark-mode class on parent */
:global(.dark-mode) .tool-activity-terminal,
:global([data-theme="dark"]) .tool-activity-terminal {
  --terminal-bg: #1a1a2e;
  --terminal-border: #2d2d44;
  --terminal-text: #e0e0e0;
  --terminal-active: #64b5f6;
  --terminal-success: #81c784;
  --terminal-error: #e57373;
  --terminal-operation: #90caf9;
  --terminal-path: #9e9e9e;
  --terminal-detail: #a0a0a0;
  --terminal-muted: #616161;
}

/* =============================================================================
 * Progress Panel Styles (Session Metrics + Todos)
 * ============================================================================= */

.progress-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--terminal-active);
  margin-bottom: 8px;
}

.progress-icon {
  width: 14px;
  text-align: center;
  flex-shrink: 0;
  font-size: 12px;
}

.progress-icon.spinning {
  animation: pulse 1.5s ease-in-out infinite;
}

.progress-label {
  font-weight: 500;
}

.progress-metrics {
  color: var(--terminal-path);
  font-size: 12px;
}

.progress-todos {
  margin-left: 0;
}

.progress-todo {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  color: var(--terminal-detail);
}

.progress-todo.in-progress {
  color: var(--terminal-active);
}

.todo-prefix {
  color: var(--terminal-muted);
  width: 14px;
  text-align: center;
  flex-shrink: 0;
}

.todo-icon {
  flex-shrink: 0;
  font-size: 12px;
}

.todo-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-indicator {
  color: var(--terminal-active);
  font-size: 11px;
  margin-left: 4px;
}

/* =============================================================================
 * Standard Activity Styles
 * ============================================================================= */

.activity-line {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--terminal-text);
}

.activity-line.active {
  color: var(--terminal-active);
}

.activity-line.completed {
  color: var(--terminal-success);
}

.activity-line.error {
  color: var(--terminal-error);
}

.activity-icon {
  width: 14px;
  text-align: center;
  flex-shrink: 0;
  font-size: 12px;
}

.activity-icon.spinning {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.activity-operation {
  color: var(--terminal-operation);
  font-weight: 500;
}

.activity-path {
  color: var(--terminal-path);
}

.activity-detail {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-left: 20px;
  padding-left: 0;
  color: var(--terminal-detail);
  font-size: 12px;
}

.branch-symbol {
  color: var(--terminal-muted);
  font-weight: 300;
}

.detail-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-duration {
  color: var(--terminal-muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

/* Activity group spacing */
.activity-group {
  margin-bottom: 6px;
}

.activity-group:last-child {
  margin-bottom: 0;
}

/* Active state has margin when followed by completed activities */
.activity-line.active + .activity-group,
.activity-line.active ~ .activity-group:first-of-type {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--terminal-border);
}
</style>
