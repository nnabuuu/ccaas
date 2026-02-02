import { useState, useCallback, useEffect, useRef } from 'react'
import type { ChatLayoutMode, UseChatLayoutReturn } from '../types'

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

export function useChatLayout(): UseChatLayoutReturn {
  const [mode, setModeState] = useState<ChatLayoutMode>(loadMode)
  const [isCollapsed, setCollapsed] = useState(false)
  const [overlayWidth, setOverlayWidth] = useState(loadOverlayWidth)
  const [isResizing, setIsResizing] = useState(false)
  const overlayWidthRef = useRef(overlayWidth)

  overlayWidthRef.current = overlayWidth

  const setMode = useCallback((newMode: ChatLayoutMode) => {
    setModeState(newMode)
    try { localStorage.setItem(STORAGE_KEY_MODE, newMode) } catch { /* SSR safe */ }
    if (newMode === 'default') {
      setCollapsed(false)
    }
  }, [])

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
      try { localStorage.setItem(STORAGE_KEY_OVERLAY_WIDTH, String(overlayWidthRef.current)) } catch { /* SSR safe */ }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  useEffect(() => {
    return () => {
      try { localStorage.setItem(STORAGE_KEY_OVERLAY_WIDTH, String(overlayWidthRef.current)) } catch { /* SSR safe */ }
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
