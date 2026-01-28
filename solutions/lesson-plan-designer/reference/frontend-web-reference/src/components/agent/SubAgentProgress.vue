<script setup lang="ts">
/**
 * SubAgentProgress - Displays sub-agent execution progress with internal todo list
 *
 * Features:
 * - Shows sub-agent type with friendly name
 * - Displays internal todo list with status icons
 * - Shows progress stats (completed/total)
 * - Collapsible for compact view
 */
import { ref, computed } from 'vue'

export interface SubAgentTodo {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}

const props = defineProps<{
  agentType: string
  todos: SubAgentTodo[]
  completed: number
  total: number
}>()

const collapsed = ref(false)

/**
 * Agent type display names (Chinese)
 */
const AGENT_NAMES: Record<string, string> = {
  'lesson-plan-designer': '教案设计助手',
  'content-generator': '内容生成助手',
  'research-agent': '研究助手',
}

const agentTypeLabel = computed(() => {
  return AGENT_NAMES[props.agentType] || props.agentType
})

/**
 * Get status icon for a todo
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'completed':
      return '✓'
    case 'in_progress':
      return '⏳'
    case 'pending':
      return '○'
    default:
      return '○'
  }
}

/**
 * Toggle collapse state
 */
function toggleCollapse() {
  collapsed.value = !collapsed.value
}
</script>

<template>
  <div class="subagent-progress" :class="{ collapsed }">
    <div class="subagent-header" @click="toggleCollapse">
      <div class="header-left">
        <span class="subagent-icon">🤖</span>
        <span class="subagent-type">{{ agentTypeLabel }}</span>
      </div>
      <div class="header-right">
        <span class="subagent-stats">{{ completed }}/{{ total }}</span>
        <span class="collapse-icon">{{ collapsed ? '▶' : '▼' }}</span>
      </div>
    </div>

    <transition name="slide">
      <div v-if="!collapsed" class="subagent-todos">
        <div
          v-for="(todo, index) in todos"
          :key="index"
          class="subagent-todo"
          :class="todo.status"
        >
          <span class="todo-icon" :class="{ spinning: todo.status === 'in_progress' }">
            {{ getStatusIcon(todo.status) }}
          </span>
          <span class="todo-content">
            {{ todo.status === 'in_progress' && todo.activeForm ? todo.activeForm : todo.content }}
          </span>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.subagent-progress {
  background: linear-gradient(135deg, #f0f4ff 0%, #e8ecf6 100%);
  border-radius: 8px;
  margin: 8px 0;
  overflow: hidden;
  border: 1px solid #d9e2f3;
}

.subagent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.subagent-header:hover {
  background: rgba(102, 126, 234, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.subagent-icon {
  font-size: 16px;
}

.subagent-type {
  font-weight: 500;
  color: #3d4a68;
  font-size: 13px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.subagent-stats {
  font-size: 12px;
  font-weight: 600;
  color: #667eea;
  padding: 2px 8px;
  background: rgba(102, 126, 234, 0.15);
  border-radius: 10px;
}

.collapse-icon {
  font-size: 10px;
  color: #8c8c8c;
}

.subagent-todos {
  padding: 8px 12px 12px;
  border-top: 1px solid #d9e2f3;
}

.subagent-todo {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  font-size: 12px;
}

.subagent-todo.completed {
  color: #52c41a;
}

.subagent-todo.in_progress {
  color: #1890ff;
  font-weight: 500;
}

.subagent-todo.pending {
  color: #8c8c8c;
}

.todo-icon {
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.todo-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.todo-content {
  flex: 1;
  line-height: 1.4;
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
}
</style>
