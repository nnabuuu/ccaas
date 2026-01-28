<script setup lang="ts">
/**
 * ThinkingIndicator - Displays agent's extended thinking/reasoning content
 *
 * Phase 1.6: Enhanced Event Transparency
 *
 * Different from ReasoningIndicator:
 * - ReasoningIndicator shows phase labels (analyzing, planning, etc.)
 * - ThinkingIndicator shows actual extended thinking content from Claude
 *
 * Features:
 * - Shows streaming thinking content
 * - Expandable/collapsible view
 * - Animated thinking indicator
 * - Toggle between preview and full content
 */
import { ref, computed, watch } from 'vue'
import { useThinking } from '@kedge/vue-agent-sdk'

const props = withDefaults(defineProps<{
  /** Whether to show expanded content by default */
  defaultExpanded?: boolean
  /** Maximum preview length */
  maxPreviewLength?: number
  /** Whether to auto-expand when content arrives */
  autoExpand?: boolean
}>(), {
  defaultExpanded: false,
  maxPreviewLength: 200,
  autoExpand: false,
})

const emit = defineEmits<{
  expand: []
  collapse: []
}>()

// Composable
const {
  isThinking,
  thinkingContent,
  thinkingHistory,
  hasThinking,
  thinkingLength,
} = useThinking()

// Local state
const isExpanded = ref(props.defaultExpanded)
const wasExpanded = ref(false)

// Computed
const preview = computed(() => {
  const content = thinkingContent.value
  if (content.length <= props.maxPreviewLength) return content
  return content.slice(0, props.maxPreviewLength) + '...'
})

const showToggle = computed(() => {
  return thinkingLength.value > props.maxPreviewLength
})

const hasHistory = computed(() => {
  return thinkingHistory.value.length > 0
})

// Auto-expand when content arrives
watch(() => thinkingContent.value, (content) => {
  if (props.autoExpand && content && !wasExpanded.value) {
    isExpanded.value = true
    wasExpanded.value = true
  }
})

// Reset when thinking ends
watch(() => isThinking.value, (thinking) => {
  if (!thinking) {
    wasExpanded.value = false
  }
})

// Methods
function toggleExpanded() {
  isExpanded.value = !isExpanded.value
  emit(isExpanded.value ? 'expand' : 'collapse')
}
</script>

<template>
  <transition name="thinking-fade">
    <div v-if="isThinking || hasThinking" class="thinking-indicator">
      <!-- Header -->
      <div class="thinking-header">
        <span class="thinking-icon" :class="{ active: isThinking }">🧠</span>
        <span class="thinking-label">
          {{ isThinking ? 'Claude is thinking...' : 'Extended thinking' }}
        </span>
        <button
          v-if="showToggle"
          class="toggle-btn"
          @click="toggleExpanded"
          :aria-expanded="isExpanded"
        >
          {{ isExpanded ? '收起' : '展开' }}
        </button>
      </div>

      <!-- Content -->
      <div v-if="thinkingContent" class="thinking-content" :class="{ expanded: isExpanded }">
        <p class="thinking-text">
          {{ isExpanded ? thinkingContent : preview }}
        </p>
      </div>

      <!-- History indicator -->
      <div v-if="hasHistory && !isThinking" class="thinking-history-hint">
        {{ thinkingHistory.length }} previous thinking block{{ thinkingHistory.length > 1 ? 's' : '' }}
      </div>
    </div>
  </transition>
</template>

<style scoped>
.thinking-indicator {
  background: linear-gradient(135deg, #fef9f0 0%, #fef5e7 100%);
  border: 1px solid #faecd8;
  border-radius: 8px;
  padding: 12px 16px;
  margin: 8px 0;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.thinking-icon {
  font-size: 16px;
  transition: all 0.3s ease;
}

.thinking-icon.active {
  animation: think-pulse 1.5s ease-in-out infinite;
}

@keyframes think-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
}

.thinking-label {
  font-weight: 500;
  font-size: 13px;
  color: #d48806;
  flex: 1;
}

.toggle-btn {
  font-size: 12px;
  color: #8c8c8c;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #595959;
}

.thinking-content {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #faecd8;
}

.thinking-text {
  font-size: 12px;
  color: #595959;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 100px;
  overflow-y: auto;
  transition: max-height 0.3s ease;
}

.thinking-content.expanded .thinking-text {
  max-height: 400px;
}

.thinking-history-hint {
  margin-top: 8px;
  font-size: 11px;
  color: #bfbfbf;
}

/* Fade transition */
.thinking-fade-enter-active,
.thinking-fade-leave-active {
  transition: all 0.3s ease;
}

.thinking-fade-enter-from,
.thinking-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
