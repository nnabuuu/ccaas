/**
 * useChatLayout Composable
 *
 * Layout mode management with localStorage persistence.
 * Supports 'default', 'overlay', and 'side-by-side' modes
 * with draggable overlay resize.
 *
 * Ported from @kedge-agentic/react-sdk useChatLayout hook.
 */

import { ref, onUnmounted } from 'vue'
import type { ChatLayoutMode, UseChatLayoutReturn } from '../types/layout'

const STORAGE_KEY_MODE = 'chat-layout-mode'
const STORAGE_KEY_OVERLAY_WIDTH = 'chat-overlay-width'
const DEFAULT_OVERLAY_WIDTH = 500
const MIN_OVERLAY_WIDTH = 320
const MAX_OVERLAY_RATIO = 0.7

function loadMode(): ChatLayoutMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MODE)
    if (stored === 'overlay' || stored === 'side-by-side' || stored === 'default') return stored
  } catch { /* SSR safe */ }
  return 'default'
}

function loadOverlayWidth(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_OVERLAY_WIDTH)
    if (stored) {
      const n = parseInt(stored, 10)
      if (!isNaN(n) && n >= MIN_OVERLAY_WIDTH) return n
    }
  } catch { /* SSR safe */ }
  return DEFAULT_OVERLAY_WIDTH
}

/**
 * Chat layout composable for managing layout mode and overlay resize.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useChatLayout } from '@kedge-agentic/vue-sdk'
 *
 * const {
 *   mode,
 *   setMode,
 *   isCollapsed,
 *   setCollapsed,
 *   overlayWidth,
 *   isResizing,
 *   onResizeHandleMouseDown,
 * } = useChatLayout()
 * </script>
 *
 * <template>
 *   <div :class="{ 'overlay-mode': mode === 'overlay' }">
 *     <div
 *       v-if="mode === 'overlay'"
 *       :style="{ width: overlayWidth + 'px' }"
 *     >
 *       <div
 *         class="resize-handle"
 *         @mousedown="onResizeHandleMouseDown"
 *       />
 *       <!-- chat content -->
 *     </div>
 *   </div>
 * </template>
 * ```
 */
export function useChatLayout(): UseChatLayoutReturn {
  const mode = ref<ChatLayoutMode>(loadMode())
  const isCollapsed = ref(false)
  const overlayWidth = ref(loadOverlayWidth())
  const isResizing = ref(false)

  function setMode(newMode: ChatLayoutMode): void {
    mode.value = newMode
    try { localStorage.setItem(STORAGE_KEY_MODE, newMode) } catch { /* SSR safe */ }
    if (newMode === 'default') {
      isCollapsed.value = false
    }
  }

  function setCollapsed(collapsed: boolean): void {
    isCollapsed.value = collapsed
  }

  function onResizeHandleMouseDown(e: MouseEvent): void {
    e.preventDefault()
    isResizing.value = true
    document.body.classList.add('select-none')

    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.max(
        MIN_OVERLAY_WIDTH,
        Math.min(window.innerWidth * MAX_OVERLAY_RATIO, window.innerWidth - ev.clientX),
      )
      overlayWidth.value = newWidth
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.classList.remove('select-none')
      isResizing.value = false
      try { localStorage.setItem(STORAGE_KEY_OVERLAY_WIDTH, String(overlayWidth.value)) } catch { /* SSR safe */ }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  // Persist overlay width on unmount
  onUnmounted(() => {
    try { localStorage.setItem(STORAGE_KEY_OVERLAY_WIDTH, String(overlayWidth.value)) } catch { /* SSR safe */ }
  })

  return {
    mode,
    setMode,
    isCollapsed,
    setCollapsed,
    overlayWidth,
    isResizing,
    onResizeHandleMouseDown,
  }
}

export default useChatLayout
