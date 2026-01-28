<script setup lang="ts">
/**
 * ToolCallCard - Displays tool call details with collapsible input parameters
 *
 * Features:
 * - Shows tool name with friendly Chinese translation
 * - Shows API path when available
 * - Shows execution duration
 * - Expandable to show full input parameters
 */
import { ref, computed } from 'vue'

const props = defineProps<{
  toolName: string
  toolInput?: Record<string, unknown>
  duration?: number
  status?: 'running' | 'success' | 'error'
}>()

const expanded = ref(false)

/**
 * Tool display names with Chinese translations
 */
const TOOL_NAMES: Record<string, string> = {
  // Main agent tools
  task: '子任务',
  read: '读取数据',
  write: '写入数据',
  search: '搜索',
  // Sub-agent tools
  get_lesson_plan: '获取教案',
  get_session_context: '加载上下文',
  write_output: '生成内容',
  read_reference_data: '查阅教材',
  api_call_readonly: '查询数据',
  search_curriculum_standards: '搜索课程标准',
  todo_write: '更新任务',
  // MCP tools
  mcp__ui_control__navigate: '页面跳转',
  mcp__ui_control__read_page: '读取页面',
  mcp__ui_control__fill_form: '填写表单',
  mcp__ui_control__apply_form_data: '更新表单',
  mcp__ui_control__open_chapter_selector: '选择章节',
}

const displayName = computed(() => {
  return TOOL_NAMES[props.toolName] || props.toolName
})

const statusIcon = computed(() => {
  switch (props.status) {
    case 'running':
      return '⏳'
    case 'success':
      return '✓'
    case 'error':
      return '✗'
    default:
      return '⏳'
  }
})

/**
 * Extract path from tool input (for API calls)
 */
const apiPath = computed(() => {
  if (!props.toolInput) return null
  // Check various path-like properties
  if (props.toolInput.path) return String(props.toolInput.path)
  if (props.toolInput.endpoint) return String(props.toolInput.endpoint)
  if (props.toolInput.url) return String(props.toolInput.url)
  return null
})

/**
 * Format input for display
 */
const inputJson = computed(() => {
  if (!props.toolInput) return '(无参数)'
  try {
    return JSON.stringify(props.toolInput, null, 2)
  } catch {
    return String(props.toolInput)
  }
})

/**
 * Format duration for display
 */
const formattedDuration = computed(() => {
  if (!props.duration) return null
  if (props.duration < 1000) {
    return `${props.duration}ms`
  }
  return `${(props.duration / 1000).toFixed(1)}s`
})

function toggleExpand() {
  expanded.value = !expanded.value
}
</script>

<template>
  <div class="tool-call-card" :class="[status, { expanded }]">
    <div class="tool-header" @click="toggleExpand">
      <span class="tool-icon" :class="status">{{ statusIcon }}</span>
      <span class="tool-name">{{ displayName }}</span>
      <span v-if="apiPath" class="tool-path">{{ apiPath }}</span>
      <span v-if="formattedDuration" class="tool-duration">{{ formattedDuration }}</span>
      <span class="expand-icon">{{ expanded ? '▼' : '▶' }}</span>
    </div>
    <transition name="slide">
      <div v-if="expanded" class="tool-body">
        <div class="tool-input-label">输入参数:</div>
        <pre class="tool-input-json">{{ inputJson }}</pre>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.tool-call-card {
  background: #f8f9fa;
  border-radius: 8px;
  margin: 4px 0;
  overflow: hidden;
  border: 1px solid #e8e8e8;
  transition: all 0.2s ease;
}

.tool-call-card.running {
  border-color: #1890ff;
  background: #e6f7ff;
}

.tool-call-card.success {
  border-color: #52c41a;
}

.tool-call-card.error {
  border-color: #ff4d4f;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.tool-header:hover {
  background: rgba(0, 0, 0, 0.04);
}

.tool-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
}

.tool-icon.running {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tool-name {
  font-weight: 500;
  color: #262626;
  flex-shrink: 0;
}

.tool-path {
  font-size: 12px;
  color: #8c8c8c;
  font-family: 'SF Mono', Monaco, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.tool-duration {
  font-size: 11px;
  color: #8c8c8c;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 4px;
  flex-shrink: 0;
}

.expand-icon {
  font-size: 10px;
  color: #8c8c8c;
  margin-left: auto;
  flex-shrink: 0;
}

.tool-body {
  padding: 8px 12px 12px;
  border-top: 1px solid #e8e8e8;
  background: white;
}

.tool-input-label {
  font-size: 11px;
  color: #8c8c8c;
  margin-bottom: 4px;
}

.tool-input-json {
  margin: 0;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 11px;
  font-family: 'SF Mono', Monaco, monospace;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
  color: #595959;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Slide transition */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
  max-height: 300px;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
</style>
