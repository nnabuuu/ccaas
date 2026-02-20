<script setup lang="ts">
/**
 * ResizeDivider - Drag handle for resizing panels
 *
 * Features:
 * - Mouse drag to resize
 * - Keyboard support (arrow keys)
 * - Shift+arrow for larger steps
 * - Accessible with proper ARIA attributes
 */
import { ref } from 'vue'
import { useSplitPanel } from '@/composables/useSplitPanel'

const emit = defineEmits<{
  'start-resize': []
}>()

const { panelWidth, setWidth, MIN_WIDTH, MAX_WIDTH } = useSplitPanel()

const isFocused = ref(false)

function handleMouseDown(e: MouseEvent): void {
  e.preventDefault()
  emit('start-resize')
}

// Keyboard accessibility: Arrow keys to resize
function handleKeyDown(e: KeyboardEvent): void {
  const step = e.shiftKey ? 50 : 10 // Shift for larger steps

  switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault()
      setWidth(panelWidth.value + step) // Left = wider panel
      break
    case 'ArrowRight':
      e.preventDefault()
      setWidth(panelWidth.value - step) // Right = narrower panel
      break
  }
}
</script>

<template>
  <div
    class="resize-divider"
    :class="{ focused: isFocused }"
    role="separator"
    aria-orientation="vertical"
    :aria-valuenow="panelWidth"
    :aria-valuemin="MIN_WIDTH"
    :aria-valuemax="MAX_WIDTH"
    aria-label="Resize panel. Use left/right arrow keys or drag."
    tabindex="0"
    @mousedown="handleMouseDown"
    @keydown="handleKeyDown"
    @focus="isFocused = true"
    @blur="isFocused = false"
  >
    <div class="resize-handle" />
  </div>
</template>

<style scoped>
.resize-divider {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: col-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Extend hit area slightly for easier grabbing */
  margin-left: -4px;
}

.resize-divider:hover .resize-handle,
.resize-divider.focused .resize-handle {
  opacity: 1;
  background: var(--color-primary, #667eea);
}

.resize-handle {
  width: 4px;
  height: 48px;
  max-height: 30%;
  background: var(--color-border-dark, #cbd5e1);
  border-radius: 9999px;
  opacity: 0;
  transition:
    opacity 0.15s ease,
    background 0.15s ease;
}

/* Focus ring for accessibility */
.resize-divider:focus {
  outline: none;
}

.resize-divider:focus .resize-handle {
  box-shadow: 0 0 0 2px var(--color-primary-light, rgba(102, 126, 234, 0.3));
}
</style>
