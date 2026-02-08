import { useState, useCallback, useEffect, useRef } from 'react'

export type ChatLayoutMode = 'default' | 'overlay' | 'side-by-side'

const STORAGE_KEY_MODE = 'chat-layout-mode'
const STORAGE_KEY_OVERLAY_WIDTH = 'chat-overlay-width'
const DEFAULT_OVERLAY_WIDTH = 500
const MIN_OVERLAY_WIDTH = 320
const MAX_OVERLAY_RATIO = 0.7

function loadMode(): ChatLayoutMode {
  const stored = localStorage.getItem(STORAGE_KEY_MODE)
  if (stored === 'overlay' || stored === 'side-by-side' || stored === 'default') return stored
  return 'default'
}

function loadOverlayWidth(): number {
  const stored = localStorage.getItem(STORAGE_KEY_OVERLAY_WIDTH)
  if (stored) {
    const n = parseInt(stored, 10)
    if (!isNaN(n) && n >= MIN_OVERLAY_WIDTH) return n
  }
  return DEFAULT_OVERLAY_WIDTH
}

export function useChatLayout() {
  const [mode, setModeState] = useState<ChatLayoutMode>(loadMode)
  const [isCollapsed, setCollapsed] = useState(false)
  const [overlayWidth, setOverlayWidth] = useState(loadOverlayWidth)
  const [isResizing, setIsResizing] = useState(false)
  const overlayWidthRef = useRef(overlayWidth)

  // Keep ref in sync
  overlayWidthRef.current = overlayWidth

  const setMode = useCallback((newMode: ChatLayoutMode) => {
    setModeState(newMode)
    localStorage.setItem(STORAGE_KEY_MODE, newMode)
    // Reset collapse when switching to default
    if (newMode === 'default') {
      setCollapsed(false)
    }
  }, [])

  // Overlay resize logic
  const onResizeHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    document.body.classList.add('select-none')

    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.max(
        MIN_OVERLAY_WIDTH,
        Math.min(window.innerWidth * MAX_OVERLAY_RATIO, window.innerWidth - ev.clientX)
      )
      setOverlayWidth(newWidth)
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.classList.remove('select-none')
      setIsResizing(false)
      localStorage.setItem(STORAGE_KEY_OVERLAY_WIDTH, String(overlayWidthRef.current))
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  // Persist overlay width on unmount if changed
  useEffect(() => {
    return () => {
      localStorage.setItem(STORAGE_KEY_OVERLAY_WIDTH, String(overlayWidthRef.current))
    }
  }, [])

  return {
    mode,
    setMode,
    isCollapsed,
    setCollapsed,
    overlayWidth,
    isResizing,
    overlayResizeProps: { onMouseDown: onResizeHandleMouseDown },
  }
}
