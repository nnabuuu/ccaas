<script setup lang="ts">
/**
 * RunHistoryDropdown - Dropdown showing run history with rollback support
 *
 * Display format:
 * ┌──────────────────────────────┐
 * │ Run 2 of 3 (当前)      ✓    │
 * │ ─────────────────────────── │
 * │ Run 3 · 12:45 · 学习目标     │
 * │ Run 2 · 12:30 · 教材分析 ← 当前│
 * │ Run 1 · 12:15 · 课程标准     │
 * │ ─────────────────────────── │
 * │ 🔄 回退到 Run 1              │
 * │ 📊 对比版本                  │
 * └──────────────────────────────┘
 *
 * Features:
 * - Shows current run indicator in header
 * - Dropdown list of all runs with metadata
 * - Click to view run details (read-only)
 * - Rollback action (with confirmation)
 */
import { ref, computed, inject } from 'vue'
import type { Ref } from 'vue'
import type { RunMetadata } from '@/types'

const props = defineProps<{
  /** Whether the dropdown is disabled */
  disabled?: boolean
}>()

const emit = defineEmits<{
  /** Emitted when user requests rollback to a specific run */
  rollback: [seq: number]
  /** Emitted when user wants to view a specific run */
  viewRun: [seq: number]
}>()

// =============================================================================
// Injected State
// =============================================================================

const currentRunSeq = inject<Ref<number | undefined>>('currentRunSeq', ref(undefined))
const totalAgentRuns = inject<Ref<number | undefined>>('totalAgentRuns', ref(undefined))
const runHistory = inject<Ref<RunMetadata[]>>('runHistory', ref([]))

// =============================================================================
// Local State
// =============================================================================

const isOpen = ref(false)

// =============================================================================
// Computed Properties
// =============================================================================

/** Whether we have any run data to show */
const hasRuns = computed(() => {
  return currentRunSeq.value !== undefined || runHistory.value.length > 0
})

/** Header text for the dropdown trigger */
const headerText = computed(() => {
  if (currentRunSeq.value === undefined) {
    return null
  }
  if (totalAgentRuns.value !== undefined) {
    return `Run ${currentRunSeq.value} of ${totalAgentRuns.value}`
  }
  return `Run ${currentRunSeq.value}`
})

/** Sorted run history (newest first) */
const sortedRuns = computed(() => {
  if (runHistory.value.length === 0) {
    // If we don't have full history, create a placeholder for the current run
    if (currentRunSeq.value !== undefined) {
      return [{
        seq: currentRunSeq.value,
        startedAt: new Date().toISOString(),
        agentType: 'lesson-plan-designer',
        status: 'generating' as const,
        isCurrent: true,
      }]
    }
    return []
  }
  return [...runHistory.value]
    .sort((a, b) => b.seq - a.seq)
    .map(run => ({
      ...run,
      isCurrent: run.seq === currentRunSeq.value,
    }))
})

// =============================================================================
// Methods
// =============================================================================

function toggleDropdown() {
  if (!props.disabled) {
    isOpen.value = !isOpen.value
  }
}

function closeDropdown() {
  isOpen.value = false
}

function handleViewRun(seq: number) {
  emit('viewRun', seq)
  closeDropdown()
}

function handleRollback(seq: number) {
  emit('rollback', seq)
  closeDropdown()
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

function formatTokens(tokens?: { total: number }): string {
  if (!tokens?.total) return ''
  const t = tokens.total
  if (t < 1000) return `${t}`
  return `${(t / 1000).toFixed(1)}k`
}
</script>

<template>
  <div v-if="hasRuns" class="run-history-dropdown" :class="{ open: isOpen, disabled }">
    <!-- Dropdown Trigger -->
    <button
      class="dropdown-trigger"
      :disabled="disabled"
      @click="toggleDropdown"
      @blur="closeDropdown"
    >
      <span class="trigger-text">{{ headerText }}</span>
      <svg class="chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 5 6 8 9 5" />
      </svg>
    </button>

    <!-- Dropdown Menu -->
    <div v-if="isOpen" class="dropdown-menu" @mousedown.prevent>
      <!-- Run List -->
      <div class="run-list">
        <div
          v-for="run in sortedRuns"
          :key="run.seq"
          class="run-item"
          :class="{ current: run.isCurrent, completed: run.status === 'completed' }"
          @click="handleViewRun(run.seq)"
        >
          <div class="run-main">
            <span class="run-seq">Run {{ run.seq }}</span>
            <span class="run-time">{{ formatTime(run.startedAt) }}</span>
            <span v-if="run.label" class="run-label">{{ run.label }}</span>
          </div>
          <div class="run-meta">
            <span v-if="run.tokens" class="run-tokens">{{ formatTokens(run.tokens) }} tokens</span>
            <span v-if="run.isCurrent" class="current-indicator">当前</span>
            <span v-else-if="run.status === 'completed'" class="status-icon completed">✓</span>
            <span v-else-if="run.status === 'generating'" class="status-icon generating">○</span>
            <span v-else-if="run.status === 'error'" class="status-icon error">✗</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div v-if="sortedRuns.length > 1" class="dropdown-actions">
        <div class="divider"></div>
        <button
          v-for="run in sortedRuns.filter(r => !r.isCurrent && r.status === 'completed')"
          :key="`rollback-${run.seq}`"
          class="action-btn rollback"
          @click="handleRollback(run.seq)"
        >
          <span class="action-icon">🔄</span>
          <span>回退到 Run {{ run.seq }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.run-history-dropdown {
  position: relative;
  display: inline-flex;
}

/* Dropdown Trigger */
.dropdown-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.05);
  border: none;
  border-radius: 4px;
  font-size: 12px;
  color: #595959;
  cursor: pointer;
  transition: all 0.15s ease;
  font-variant-numeric: tabular-nums;
}

.dropdown-trigger:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.1);
}

.dropdown-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.trigger-text {
  white-space: nowrap;
}

.chevron {
  transition: transform 0.2s ease;
}

.run-history-dropdown.open .chevron {
  transform: rotate(180deg);
}

/* Dropdown Menu */
.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 240px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #e8e8e8;
  z-index: 1000;
  overflow: hidden;
}

/* Run List */
.run-list {
  max-height: 300px;
  overflow-y: auto;
  padding: 4px 0;
}

.run-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.run-item:hover {
  background: #f5f5f5;
}

.run-item.current {
  background: #e6f7ff;
}

.run-item.current:hover {
  background: #bae7ff;
}

.run-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.run-seq {
  font-weight: 500;
  color: #262626;
  font-size: 13px;
}

.run-time {
  font-size: 12px;
  color: #8c8c8c;
  font-variant-numeric: tabular-nums;
}

.run-label {
  font-size: 12px;
  color: #595959;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.run-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.run-tokens {
  font-size: 11px;
  color: #a6a6a6;
  font-variant-numeric: tabular-nums;
}

.current-indicator {
  font-size: 11px;
  color: #1890ff;
  background: rgba(24, 144, 255, 0.1);
  padding: 1px 6px;
  border-radius: 3px;
}

.status-icon {
  font-size: 12px;
}

.status-icon.completed {
  color: #52c41a;
}

.status-icon.generating {
  color: #1890ff;
}

.status-icon.error {
  color: #ff4d4f;
}

/* Actions */
.dropdown-actions {
  padding: 4px 0;
}

.divider {
  height: 1px;
  background: #e8e8e8;
  margin: 4px 0;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  font-size: 13px;
  color: #595959;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.action-btn:hover {
  background: #f5f5f5;
}

.action-btn.rollback:hover {
  background: #fff7e6;
  color: #fa8c16;
}

.action-icon {
  font-size: 14px;
}
</style>
