<script setup lang="ts">
/**
 * BaseModal - Reusable modal dialog component
 *
 * Provides consistent modal styling, accessibility, and animations.
 *
 * @example
 * <BaseModal v-model:visible="showModal" title="My Modal" size="md">
 *   <p>Modal content here</p>
 *   <template #footer>
 *     <button @click="showModal = false">Cancel</button>
 *     <button @click="handleSave">Save</button>
 *   </template>
 * </BaseModal>
 *
 * Props:
 *   visible: boolean - Controls modal visibility (v-model:visible)
 *   title: string - Modal header title
 *   size: 'sm' | 'md' | 'lg' | 'xl' (default: 'md')
 *   closable: boolean - Show close button (default: true)
 *   closeOnOverlay: boolean - Close when clicking overlay (default: true)
 *   closeOnEscape: boolean - Close when pressing Escape (default: true)
 */
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    default: 'md',
    validator: (value: string) => ['sm', 'md', 'lg', 'xl'].includes(value)
  },
  closable: {
    type: Boolean,
    default: true
  },
  closeOnOverlay: {
    type: Boolean,
    default: true
  },
  closeOnEscape: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:visible', 'close'])

// Size to max-width mapping
const sizeMap: Record<string, string> = {
  sm: '400px',
  md: '500px',
  lg: '600px',
  xl: '700px'
}

const modalRef = ref<HTMLDivElement | null>(null)
const isAnimating = ref(false)

// Handle close
const handleClose = () => {
  emit('update:visible', false)
  emit('close')
}

// Handle overlay click
const handleOverlayClick = (event: MouseEvent) => {
  if (props.closeOnOverlay && event.target === event.currentTarget) {
    handleClose()
  }
}

// Handle escape key
const handleEscape = (event: KeyboardEvent) => {
  if (props.closeOnEscape && event.key === 'Escape' && props.visible) {
    handleClose()
  }
}

// Focus trap - keep focus within modal
const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
let previousFocusedElement: Element | null = null

const trapFocus = (event: KeyboardEvent) => {
  if (!props.visible || !modalRef.value) return

  const focusableElements = modalRef.value.querySelectorAll(focusableSelector)
  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault()
    ;(lastElement as HTMLElement)?.focus()
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault()
    ;(firstElement as HTMLElement)?.focus()
  }
}

// Watch visibility to manage focus
watch(() => props.visible, async (newValue) => {
  if (newValue) {
    previousFocusedElement = document.activeElement
    await nextTick()
    // Focus first focusable element in modal
    const focusableElements = modalRef.value?.querySelectorAll(focusableSelector)
    ;(focusableElements?.[0] as HTMLElement)?.focus()
  } else {
    // Restore focus when closing
    ;(previousFocusedElement as HTMLElement)?.focus()
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') trapFocus(e)
  })
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="base-modal-overlay"
        @click="handleOverlayClick"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? 'modal-title' : undefined"
      >
        <div
          ref="modalRef"
          class="base-modal-content"
          :style="{ maxWidth: sizeMap[size] }"
        >
          <!-- Header -->
          <div v-if="title || closable" class="base-modal-header">
            <h2 v-if="title" id="modal-title" class="base-modal-title">{{ title }}</h2>
            <button
              v-if="closable"
              class="base-modal-close"
              @click="handleClose"
              aria-label="Close modal"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="base-modal-body">
            <slot />
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="base-modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.base-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: var(--space-4);
}

.base-modal-content {
  background: var(--white, #ffffff);
  border-radius: var(--radius-xl, 12px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  width: 100%;
  max-height: calc(100vh - 2rem);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.base-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-5, 20px) var(--space-6, 24px);
  border-bottom: 1px solid var(--gray-200, #e5e7eb);
}

.base-modal-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--gray-900, #111827);
  margin: 0;
}

.base-modal-close {
  background: none;
  border: none;
  color: var(--gray-400, #9ca3af);
  cursor: pointer;
  padding: var(--space-1, 4px);
  border-radius: var(--radius-md, 6px);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background-color 0.15s;
}

.base-modal-close:hover {
  color: var(--gray-600, #4b5563);
  background: var(--gray-100, #f3f4f6);
}

.base-modal-body {
  padding: var(--space-6, 24px);
  overflow-y: auto;
  flex: 1;
}

.base-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3, 12px);
  padding: var(--space-4, 16px) var(--space-6, 24px);
  border-top: 1px solid var(--gray-200, #e5e7eb);
  background: var(--gray-50, #f9fafb);
}

/* Animation */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .base-modal-content,
.modal-leave-active .base-modal-content {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .base-modal-content,
.modal-leave-to .base-modal-content {
  transform: scale(0.95);
  opacity: 0;
}
</style>
