<script setup lang="ts">
/**
 * ToolActivityPill - Compact pill-style tool activity display (Manus UI style)
 *
 * Display format:
 * [icon] action `param` [duration] [▶]
 *
 * Examples:
 * [🔍] 搜索 `Claude Code CLI...` 1.2s ▶
 * [🌐] 跳转 `https://example.com/...`
 * [✏️] 生成 `教材分析、学习目标...`
 * [📋] 获取教案 `lesson-plan/30`
 *
 * Features:
 * - Emoji icon based on tool type
 * - Chinese action verb
 * - Truncated parameter preview (gray, monospace)
 * - Status indicator (spinner for running, checkmark for completed)
 * - Duration badge (when available)
 * - Expandable details panel (input params, output, errors)
 */
import { ref, computed } from 'vue'
import type { TaskActivity } from '@/types'

const props = defineProps<{
  activity: TaskActivity
}>()

// =============================================================================
// State
// =============================================================================

const expanded = ref(false)

// =============================================================================
// Computed Properties
// =============================================================================

const isRunning = computed(() => props.activity.status === 'running')
const isCompleted = computed(() => props.activity.status === 'completed')
const isError = computed(() => props.activity.status === 'error')

const statusClass = computed(() => {
  if (isError.value) return 'error'
  if (isCompleted.value) return 'completed'
  if (isRunning.value) return 'running'
  return ''
})

// Show parameter only if it's meaningful
const showParam = computed(() => {
  return props.activity.toolParam && props.activity.toolParam.trim().length > 0
})

// Check if there are expandable details
const hasDetails = computed(() => {
  return props.activity.toolInput ||
    props.activity.toolOutput ||
    props.activity.toolError
})

// Format duration for display
const formattedDuration = computed(() => {
  const d = props.activity.duration
  if (!d) return null
  return d < 1000 ? `${d}ms` : `${(d / 1000).toFixed(1)}s`
})

// Format input as pretty JSON
const formattedInput = computed(() => {
  if (!props.activity.toolInput) return ''
  try {
    return JSON.stringify(props.activity.toolInput, null, 2)
  } catch {
    return String(props.activity.toolInput)
  }
})

// =============================================================================
// Methods
// =============================================================================

function toggle() {
  if (hasDetails.value) {
    expanded.value = !expanded.value
  }
}
</script>

<template>
  <div class="tool-pill-wrapper">
    <div
      class="tool-pill"
      :class="[statusClass, { expandable: hasDetails }]"
      @click="toggle"
    >
      <!-- Status/Icon indicator (Manus style: circled symbol) -->
      <span class="pill-icon-wrapper">
        <template v-if="isRunning">
          <span class="icon-circle running">
            <span class="spinner-small"></span>
          </span>
        </template>
        <template v-else-if="isError">
          <span class="icon-circle error">✗</span>
        </template>
        <template v-else>
          <span class="icon-circle">{{ activity.toolIcon || '⚙' }}</span>
        </template>
      </span>

      <!-- Action verb -->
      <span class="pill-action">{{ activity.toolAction || activity.toolName }}</span>

      <!-- Parameter preview -->
      <span v-if="showParam" class="pill-param">
        <code>{{ activity.toolParam }}</code>
      </span>

      <!-- Duration badge -->
      <span v-if="formattedDuration" class="pill-duration">{{ formattedDuration }}</span>

      <!-- Expand chevron -->
      <span v-if="hasDetails" class="pill-chevron">{{ expanded ? '▼' : '▶' }}</span>
    </div>

    <!-- Expandable details panel -->
    <div v-if="expanded && hasDetails" class="pill-details">
      <!-- Input parameters -->
      <div v-if="activity.toolInput" class="detail-section">
        <div class="detail-label">输入参数</div>
        <pre class="detail-json">{{ formattedInput }}</pre>
      </div>

      <!-- Output result -->
      <div v-if="activity.toolOutput" class="detail-section">
        <div class="detail-label">输出结果</div>
        <pre class="detail-output">{{ activity.toolOutput }}</pre>
      </div>

      <!-- Error message -->
      <div v-if="activity.toolError" class="detail-section error">
        <div class="detail-label">错误</div>
        <pre class="detail-error">{{ activity.toolError }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Wrapper for pill + expandable details */
.tool-pill-wrapper {
  width: 100%;
}

/* Manus style: inline text with circled icon, no pill background */
.tool-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #f5f5f5;
  border-radius: 6px;
  font-size: 13px;
  color: #595959;
  max-width: 100%;
  overflow: hidden;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  transition: background-color 0.15s ease;
}

.tool-pill.expandable {
  cursor: pointer;
}

.tool-pill.expandable:hover {
  background: #e8e8e8;
}

.tool-pill.running {
  background: #f0f7ff;
  color: #1890ff;
}

.tool-pill.running.expandable:hover {
  background: #e6f4ff;
}

.tool-pill.completed {
  background: #f5f5f5;
  color: #8c8c8c;
}

.tool-pill.error {
  background: #fff2f0;
  color: #ff4d4f;
}

.tool-pill.error.expandable:hover {
  background: #ffebe8;
}

/* Icon wrapper */
.pill-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Manus style: dark filled circle with light icon */
.icon-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #595959;
  color: #ffffff;
  font-size: 10px;
  font-weight: 600;
  font-family: 'SF Mono', 'Monaco', monospace;
}

.tool-pill.running .icon-circle,
.icon-circle.running {
  background: #1890ff;
  color: #ffffff;
}

.tool-pill.completed .icon-circle {
  background: #8c8c8c;
  color: #ffffff;
}

.tool-pill.error .icon-circle,
.icon-circle.error {
  background: #ff4d4f;
  color: #ffffff;
}

/* Small spinner for running state */
.spinner-small {
  width: 10px;
  height: 10px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Action verb */
.pill-action {
  font-weight: 500;
  white-space: nowrap;
  color: inherit;
}

/* Parameter preview - Manus style: gray monospace text */
.pill-param {
  color: #8c8c8c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: calc(100% - 150px);  /* Dynamic: subtract icon, action, duration width */
  min-width: 60px;
}

.pill-param code {
  font-family: inherit;
  font-size: inherit;
  background: none;
  padding: 0;
  color: inherit;
}

/* Duration badge */
.pill-duration {
  font-size: 11px;
  color: #8c8c8c;
  margin-left: auto;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  flex-shrink: 0;
}

.tool-pill.running .pill-duration {
  background: rgba(24, 144, 255, 0.1);
  color: #69c0ff;
}

/* Expand chevron */
.pill-chevron {
  font-size: 10px;
  color: #bfbfbf;
  margin-left: 4px;
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.tool-pill:hover .pill-chevron {
  color: #8c8c8c;
}

/* Completed state - more muted */
.tool-pill.completed .pill-action {
  color: #8c8c8c;
}

.tool-pill.completed .pill-param {
  color: #bfbfbf;
}

/* Running state */
.tool-pill.running .pill-action {
  color: #1890ff;
}

.tool-pill.running .pill-param {
  color: #69c0ff;
}

/* Error state */
.tool-pill.error .pill-action {
  color: #ff4d4f;
}

.tool-pill.error .pill-param {
  color: #ffa39e;
}

/* =============================================================================
 * Expandable Details Panel
 * ============================================================================= */

.pill-details {
  margin-top: 8px;
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
}

.detail-section {
  margin-bottom: 12px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-label {
  font-size: 11px;
  font-weight: 600;
  color: #8c8c8c;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-json,
.detail-output {
  font-size: 12px;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  padding: 8px;
  overflow-x: auto;
  max-height: 200px;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  color: #595959;
}

.detail-section.error .detail-error {
  font-size: 12px;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 4px;
  padding: 8px;
  overflow-x: auto;
  max-height: 200px;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  color: #cf1322;
}
</style>
