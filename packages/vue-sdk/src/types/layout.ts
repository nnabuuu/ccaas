/**
 * Chat Layout Types
 */

import type { Ref } from 'vue'

export type ChatLayoutMode = 'default' | 'overlay' | 'side-by-side'

export interface UseChatLayoutReturn {
  mode: Ref<ChatLayoutMode>
  setMode: (mode: ChatLayoutMode) => void
  isCollapsed: Ref<boolean>
  setCollapsed: (collapsed: boolean) => void
  overlayWidth: Ref<number>
  isResizing: Ref<boolean>
  onResizeHandleMouseDown: (e: MouseEvent) => void
}
