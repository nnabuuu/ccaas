import { ref, computed, watch, onMounted } from 'vue'

/**
 * useSplitPanel - Composable for AI side panel state management
 *
 * Manages the open/close state, panel width, and resize behavior.
 * State is shared across all component instances (singleton pattern).
 * Width is persisted to localStorage.
 */

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'ai_panel_state'
const DEFAULT_WIDTH = 480
const MIN_WIDTH = 360
const MAX_WIDTH = 720

// =============================================================================
// Singleton State (shared across all usages)
// =============================================================================

const isOpen = ref(false)
const panelWidth = ref(DEFAULT_WIDTH)
const isResizing = ref(false)
let isInitialized = false

// =============================================================================
// Persistence
// =============================================================================

interface PanelState {
  width: number
}

function loadFromStorage(): void {
  if (isInitialized) return
  isInitialized = true

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const state: PanelState = JSON.parse(stored)
      // Clamp width to valid range
      panelWidth.value = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, state.width))
    }
  } catch (e) {
    console.warn('[useSplitPanel] Failed to load state:', e)
  }
}

function saveToStorage(): void {
  try {
    const state: PanelState = {
      width: panelWidth.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('[useSplitPanel] Failed to save state:', e)
  }
}

// Watch for width changes and persist
watch(panelWidth, () => {
  saveToStorage()
})

// =============================================================================
// Composable
// =============================================================================

/**
 * Composable for split panel state management
 *
 * @example
 * ```vue
 * <script setup>
 * import { useSplitPanel } from '@/composables/useSplitPanel'
 *
 * const { isOpen, toggle, panelWidth } = useSplitPanel()
 * </script>
 * ```
 */
export function useSplitPanel() {
  // Load persisted state on first mount
  onMounted(() => {
    loadFromStorage()
  })

  // =============================================================================
  // Actions
  // =============================================================================

  function toggle(): void {
    isOpen.value = !isOpen.value
  }

  function open(): void {
    isOpen.value = true
  }

  function close(): void {
    isOpen.value = false
  }

  function setWidth(width: number): void {
    panelWidth.value = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width))
  }

  function startResize(): void {
    isResizing.value = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  function stopResize(): void {
    isResizing.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  // =============================================================================
  // Computed CSS Variables
  // =============================================================================

  const cssVars = computed(() => ({
    '--ai-panel-width': `${panelWidth.value}px`,
  }))

  // =============================================================================
  // Return
  // =============================================================================

  return {
    // State (readonly for external consumers)
    isOpen: computed(() => isOpen.value),
    panelWidth: computed(() => panelWidth.value),
    isResizing: computed(() => isResizing.value),
    cssVars,

    // Constants
    MIN_WIDTH,
    MAX_WIDTH,
    DEFAULT_WIDTH,

    // Actions
    toggle,
    open,
    close,
    setWidth,
    startResize,
    stopResize,
  }
}
