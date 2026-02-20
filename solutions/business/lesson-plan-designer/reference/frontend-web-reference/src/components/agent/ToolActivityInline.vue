<script setup lang="ts">
/**
 * ToolActivityInline - Compact Claude Code style tool activity display
 *
 * For inline display in chat flow:
 * ⏺ Read(context.json)
 *   ⎿ 读取教案上下文完成 (45ms)
 *
 * or when in progress:
 * ⏺ Read(context.json)
 */
import { computed } from 'vue'

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

const props = defineProps<{
  activity: ToolActivity
}>()

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

const operationType = computed(() => {
  return OPERATION_TYPES[props.activity.toolName] || props.activity.toolName
})

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

const identifier = computed(() => {
  const description = props.activity.description
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
})

function truncatePath(path: string, maxLength: number): string {
  if (path.length <= maxLength) return path
  return path.substring(0, maxLength - 3) + '...'
}

// =============================================================================
// Status and Formatting
// =============================================================================

const isCompleted = computed(() => {
  return props.activity.completed || props.activity.phase === 'end'
})

const isError = computed(() => {
  return props.activity.success === false
})

const statusIcon = computed(() => {
  if (isError.value) return '✗'
  if (isCompleted.value) return '✓'
  return '⏺'
})

const completionText = computed(() => {
  if (!isCompleted.value) return ''

  // Use endDescription if available
  if (props.activity.endDescription) {
    return props.activity.endDescription.replace(/\s*\(\d+(?:ms|s)\)$/, '')
  }

  // Parse from description
  return props.activity.description
    .replace(/^正在/, '')
    .replace(/\.\.\.$/g, '')
})

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(1)}s`
}
</script>

<template>
  <div class="tool-inline" :class="{ completed: isCompleted, error: isError }">
    <!-- Main line: Icon Operation(target) -->
    <div class="tool-main">
      <span class="tool-icon" :class="{ spinning: !isCompleted }">{{ statusIcon }}</span>
      <span class="tool-op">{{ operationType }}</span>
      <span class="tool-target">({{ identifier }})</span>
    </div>

    <!-- Result line when completed -->
    <div class="tool-result" v-if="isCompleted && completionText">
      <span class="result-branch">⎿</span>
      <span class="result-text">{{ completionText }}</span>
      <span class="result-duration" v-if="activity.duration">({{ formatDuration(activity.duration) }})</span>
    </div>
  </div>
</template>

<style scoped>
.tool-inline {
  --inline-text: #374151;
  --inline-active: #2563eb;
  --inline-success: #059669;
  --inline-error: #dc2626;
  --inline-op: #2563eb;
  --inline-target: #6b7280;
  --inline-muted: #9ca3af;

  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.5;
  margin: 4px 0;
}

/* Dark theme */
@media (prefers-color-scheme: dark) {
  .tool-inline {
    --inline-text: #e0e0e0;
    --inline-active: #64b5f6;
    --inline-success: #81c784;
    --inline-error: #e57373;
    --inline-op: #90caf9;
    --inline-target: #9e9e9e;
    --inline-muted: #616161;
  }
}

.tool-main {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--inline-active);
}

.tool-inline.completed .tool-main {
  color: var(--inline-success);
}

.tool-inline.error .tool-main {
  color: var(--inline-error);
}

.tool-icon {
  width: 12px;
  text-align: center;
  flex-shrink: 0;
  font-size: 11px;
}

.tool-icon.spinning {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.tool-op {
  color: var(--inline-op);
  font-weight: 500;
}

.tool-target {
  color: var(--inline-target);
}

.tool-result {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-left: 16px;
  color: var(--inline-muted);
  font-size: 11px;
}

.result-branch {
  color: var(--inline-muted);
  opacity: 0.6;
}

.result-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-duration {
  color: var(--inline-muted);
  opacity: 0.8;
  flex-shrink: 0;
}
</style>
