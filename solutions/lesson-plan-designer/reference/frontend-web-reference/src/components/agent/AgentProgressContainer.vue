<script setup lang="ts">
/**
 * AgentProgressContainer - Two-Layer Progress Display
 *
 * Combines:
 * - Level 1: AgentStoryHeader (Goal Narrative) - always visible
 * - Level 2: PhaseTimeline (Phase Progress + Decision Logic) - expandable
 *
 * Note: Level 3 (Technical Details) is now shown inline in chat flow
 * via ToolActivityInline component in ChatbotWidget.
 */
import { ref, inject, computed } from 'vue'
import type { Ref } from 'vue'
import AgentStoryHeader from './AgentStoryHeader.vue'
import PhaseTimeline from './PhaseTimeline.vue'

// Inject from AgentListener with defaults
const isAgentProcessing = inject<Ref<boolean>>('isAgentProcessing', ref(false))
const subagentTodos = inject<Ref<unknown[]>>('subagentTodos', ref([]))
const sessionStartedAt = inject<Ref<string | null>>('sessionStartedAt', ref(null))
const toolActivityHistory = inject<Ref<unknown[]>>('toolActivityHistory', ref([]))

// Computed: Should show the container
// Show when either:
// 1. Agent is actively processing (thinking status received)
// 2. There's recent tool activity (within last 60 seconds)
const isVisible = computed(() => {
  const hasRecentActivity = (toolActivityHistory?.value?.length || 0) > 0
  return isAgentProcessing?.value === true || hasRecentActivity
})

// Computed: Has sub-agent activity (show timeline)
const hasSubAgentActivity = computed(() => {
  return (subagentTodos?.value?.length || 0) > 0 || sessionStartedAt?.value
})
</script>

<template>
  <div class="agent-progress-container" v-if="isVisible">
    <!-- Level 1: Goal Narrative (Always Visible) -->
    <AgentStoryHeader />

    <!-- Level 2: Phase Timeline + Decision Logic (Expandable) -->
    <PhaseTimeline v-if="hasSubAgentActivity" />

    <!-- Level 3: Technical Details now shown inline in chat flow -->
  </div>
</template>

<style scoped>
.agent-progress-container {
  margin-bottom: 16px;
}
</style>
