<script setup lang="ts">
/**
 * AiSidePanel - Right-side AI assistant panel with resize handle
 *
 * Slides in from the right, contains the chat interface.
 * Can be resized by dragging the left edge.
 */
import { useSplitPanel } from '@/composables/useSplitPanel'
import ResizeDivider from '../layout/ResizeDivider.vue'

// Temporarily use existing ChatbotWidget content inline
// TODO: Phase 3 will extract ChatbotContent from ChatbotWidget
import ChatbotWidget from './ChatbotWidget.vue'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  'start-resize': []
}>()

const { close, panelWidth } = useSplitPanel()

function handleStartResize(): void {
  emit('start-resize')
}
</script>

<template>
  <aside
    class="ai-panel"
    :class="{ 'is-open': isOpen }"
    :style="{ width: `${panelWidth}px` }"
    aria-label="AI Assistant Panel"
    role="complementary"
  >
    <!-- Resize Handle -->
    <ResizeDivider v-if="isOpen" @start-resize="handleStartResize" />

    <!-- Panel Content -->
    <div class="ai-panel-content">
      <!-- For now, embed the existing ChatbotWidget in embedded mode -->
      <!-- Phase 3 will refactor this to use extracted ChatbotContent -->
      <ChatbotWidget v-if="isOpen" :embedded-mode="true" @close="close" />
    </div>
  </aside>
</template>

<style scoped>
.ai-panel {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  background: var(--color-surface, #ffffff);
  border-left: 1px solid var(--color-border, #e5e7eb);
  box-shadow: var(--shadow-lg);
  z-index: var(--z-modal, 400);
  display: flex;
  transform: translateX(100%);
  transition: transform var(--transition-slow, 300ms ease);
}

.ai-panel.is-open {
  transform: translateX(0);
}

.ai-panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Mobile: Full-width overlay */
@media (max-width: 768px) {
  .ai-panel {
    width: 100vw !important;
  }
}
</style>
