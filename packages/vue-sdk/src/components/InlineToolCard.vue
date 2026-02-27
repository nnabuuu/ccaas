<script setup lang="ts">
/**
 * InlineToolCard - Expandable card showing tool execution details
 *
 * Displays tool name, status icon, duration, and expandable input/output sections.
 * Used within message bubbles to show individual tool executions inline.
 */

import type { ChatToolActivity } from '../types/chat'
import { ref, computed } from 'vue'

const TOOL_ICONS: Record<string, string> = {
  Read: '\uD83D\uDCD6',
  Write: '\u270D\uFE0F',
  Edit: '\u270F\uFE0F',
  Bash: '\uD83D\uDCBB',
  Glob: '\uD83D\uDD0D',
  Grep: '\uD83D\uDD0E',
  Task: '\uD83D\uDCCB',
  WebFetch: '\uD83C\uDF10',
  WebSearch: '\uD83D\uDD0D',
  write_output: '\uD83D\uDCE4',
}

const MAX_OUTPUT_LENGTH = 500

const props = defineProps<{
  tool: ChatToolActivity
}>()

const expanded = ref(false)

// Strip MCP server prefix from tool name: "mcp__server__Read" -> "Read"
function stripMcpPrefix(toolName: string): string {
  return toolName.replace(/^mcp__[^_]+__/, '')
}

function simplifyToolInput(toolName: string, input: unknown): string {
  if (input == null) return '(\u65E0\u8F93\u5165)'
  if (typeof input !== 'object') return String(input)

  const inputObj = input as Record<string, unknown>
  const name = stripMcpPrefix(toolName)

  switch (name) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return `\u6587\u4EF6\u8DEF\u5F84: ${inputObj.file_path || inputObj.path || 'unknown'}`
    case 'Bash':
      return `\u547D\u4EE4: ${inputObj.command || 'unknown'}`
    case 'Grep':
    case 'Glob':
      return `\u641C\u7D22\u6A21\u5F0F: ${inputObj.pattern || 'unknown'}\n\u8DEF\u5F84: ${inputObj.path || '.'}`
    case 'Task':
      return `\u63CF\u8FF0: ${inputObj.description || inputObj.prompt || 'unknown'}`
    default:
      return JSON.stringify(input, null, 2)
  }
}

function simplifyToolOutput(output: unknown): string {
  if (output == null) return '(\u65E0\u8F93\u51FA)'
  if (typeof output === 'string') {
    return output.length > MAX_OUTPUT_LENGTH
      ? output.slice(0, MAX_OUTPUT_LENGTH) + '\n\n... (\u8F93\u51FA\u5DF2\u622A\u65AD\uFF0C\u5171 ' + output.length + ' \u5B57\u7B26)'
      : output
  }
  if (typeof output === 'object') {
    const outputStr = JSON.stringify(output, null, 2)
    return outputStr.length > MAX_OUTPUT_LENGTH
      ? outputStr.slice(0, MAX_OUTPUT_LENGTH) + '\n\n... (\u8F93\u51FA\u5DF2\u622A\u65AD)'
      : outputStr
  }
  return String(output)
}

function formatDurationCompact(ms: number): string | null {
  if (!ms || !Number.isFinite(ms) || ms < 0) return null
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function getToolSummary(tool: ChatToolActivity): string {
  if (tool.description) return tool.description
  const input = tool.toolInput as Record<string, unknown> | undefined
  if (!input) return ''
  const name = stripMcpPrefix(tool.toolName)
  if (name === 'Read' || name === 'Write' || name === 'Edit') {
    const p = (input.file_path as string) || ''
    if (!p) return ''
    const parts = p.split('/')
    return parts.length <= 2 ? p : '.../' + parts.slice(-2).join('/')
  }
  if (name === 'Bash') {
    const cmd = (input.command as string) || ''
    return cmd.length > 50 ? cmd.slice(0, 47) + '...' : cmd
  }
  if (name === 'Glob' || name === 'Grep') return (input.pattern as string) || ''
  if (name === 'write_output') return (input.field as string) || ''
  if (name === 'Task') return (input.description as string) || ''
  return ''
}

const displayName = computed(() => stripMcpPrefix(props.tool.toolName))
const icon = computed(() => TOOL_ICONS[displayName.value] || TOOL_ICONS[props.tool.toolName] || '\uD83D\uDD27')
const summary = computed(() => getToolSummary(props.tool))
const durationText = computed(() => formatDurationCompact(props.tool.duration ?? 0))
const hasDetails = computed(() => props.tool.toolInput || props.tool.toolOutput || props.tool.toolError)

function toggleExpanded() {
  if (hasDetails.value) {
    expanded.value = !expanded.value
  }
}
</script>

<template>
  <div class="my-1">
    <div
      :class="[
        'flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white border border-gray-200 rounded-md text-gray-600',
        hasDetails ? 'cursor-pointer hover:bg-gray-50' : '',
      ]"
      :title="tool.toolError || `${displayName} ${tool.phase}`"
      @click="toggleExpanded"
    >
      <svg
        v-if="hasDetails"
        :class="['w-3 h-3 text-gray-400 transition-transform flex-shrink-0', expanded ? 'rotate-90' : '']"
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        <path d="M6 4l4 4-4 4z" />
      </svg>
      <span>{{ icon }}</span>
      <span
        v-if="tool.nestingLevel != null && tool.nestingLevel >= 1 && tool.agentType"
        class="px-1 py-0.5 rounded bg-indigo-100 text-indigo-600 font-medium leading-none"
      >
        {{ tool.agentType }}
      </span>
      <span class="font-medium text-gray-700">{{ displayName }}</span>
      <span v-if="summary" class="text-gray-500 truncate max-w-[180px]">{{ summary }}</span>
      <!-- Status indicator -->
      <span
        v-if="tool.phase === 'start'"
        class="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"
      />
      <span v-else-if="tool.success !== false">&#x2705;</span>
      <span v-else>&#x274C;</span>
      <span v-if="durationText" class="text-gray-400">{{ durationText }}</span>
    </div>

    <!-- Expanded details -->
    <div v-if="expanded" class="mt-1 ml-4 p-2 text-xs bg-gray-50 border rounded space-y-2 max-h-[300px] overflow-y-auto">
      <div v-if="tool.toolInput != null">
        <div class="font-medium text-gray-500 mb-1">输入:</div>
        <pre class="whitespace-pre-wrap break-all font-mono text-[11px]">{{ simplifyToolInput(tool.toolName, tool.toolInput) }}</pre>
      </div>
      <div v-if="tool.toolOutput != null">
        <div class="font-medium text-gray-500 mb-1">输出:</div>
        <pre class="whitespace-pre-wrap break-all font-mono text-[11px]">{{ simplifyToolOutput(tool.toolOutput) }}</pre>
      </div>
      <div v-if="tool.toolError">
        <div class="font-medium text-red-500 mb-1">错误:</div>
        <pre class="text-red-600 whitespace-pre-wrap break-all font-mono text-[11px]">{{ tool.toolError }}</pre>
      </div>
    </div>
  </div>
</template>
