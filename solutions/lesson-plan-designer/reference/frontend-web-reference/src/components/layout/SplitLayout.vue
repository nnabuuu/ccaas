<script setup lang="ts">
/**
 * SplitLayout - Root layout with resizable AI side panel
 *
 * Provides push-mode layout where main content shrinks when AI panel opens.
 * Uses CSS Grid for layout with smooth transitions.
 *
 * Features:
 * - Resizable panel via drag
 * - Smooth open/close animations
 * - Responsive behavior (overlay mode on mobile)
 * - ESC key to close panel
 */
import { onMounted, onUnmounted, watch } from 'vue'
import { useSplitPanel } from '@/composables/useSplitPanel'
import AiSidePanel from '../agent/AiSidePanel.vue'

const {
  isOpen,
  panelWidth,
  isResizing,
  cssVars,
  setWidth,
  startResize,
  stopResize,
  close,
} = useSplitPanel()

// =============================================================================
// Resize Handlers
// =============================================================================

function handleMouseMove(e: MouseEvent): void {
  if (!isResizing.value) return

  // Calculate new width from right edge of window
  const newWidth = window.innerWidth - e.clientX
  setWidth(newWidth)
}

function handleMouseUp(): void {
  if (isResizing.value) {
    stopResize()
  }
}

// =============================================================================
// Keyboard Handlers
// =============================================================================

function handleKeyDown(e: KeyboardEvent): void {
  // ESC to close panel
  if (e.key === 'Escape' && isOpen.value) {
    close()
  }
}

// =============================================================================
// Lifecycle
// =============================================================================

onMounted(() => {
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div
    class="split-layout"
    :class="{
      'panel-open': isOpen,
      'is-resizing': isResizing,
    }"
    :style="cssVars"
  >
    <!-- Main Content Area -->
    <div class="split-main">
      <slot />
    </div>

    <!-- AI Side Panel -->
    <AiSidePanel :is-open="isOpen" @start-resize="startResize" />
  </div>
</template>

<style scoped>
.split-layout {
  display: grid;
  grid-template-columns: 1fr;
  min-height: 100vh;
  transition: grid-template-columns var(--transition-slow, 300ms ease);
}

.split-layout.panel-open {
  grid-template-columns: 1fr var(--ai-panel-width, 400px);
}

/* Disable transitions during resize for smooth dragging */
.split-layout.is-resizing {
  transition: none;
}

.split-layout.is-resizing * {
  /* Prevent text selection during drag */
  user-select: none;
}

.split-main {
  min-width: 0; /* Prevent grid blowout */
  overflow-x: hidden;
}

/* Mobile: Panel becomes full-width overlay */
@media (max-width: 768px) {
  .split-layout.panel-open {
    grid-template-columns: 1fr;
  }
}
</style>
