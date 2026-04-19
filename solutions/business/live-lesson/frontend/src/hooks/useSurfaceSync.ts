import { useCallback, useRef, useEffect } from 'react'

/**
 * Hook to broadcast sync messages to child iframes and listen for ready messages.
 */
export function useSurfaceSync() {
  const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map())

  const register = useCallback((role: string, iframe: HTMLIFrameElement | null) => {
    if (iframe) {
      iframeRefs.current.set(role, iframe)
    } else {
      iframeRefs.current.delete(role)
    }
  }, [])

  const broadcast = useCallback((msg: { type: string; step?: number; dir?: string }) => {
    iframeRefs.current.forEach((iframe) => {
      try {
        iframe.contentWindow?.postMessage(msg, '*')
      } catch { /* cross-origin or iframe not ready */ }
    })
  }, [])

  const syncStep = useCallback((step: number) => {
    broadcast({ type: 'sync', step })
  }, [broadcast])

  // Listen for ready messages from iframes and re-sync
  useEffect(() => {
    let lastStep = -1

    function onMessage(e: MessageEvent) {
      const d = e.data
      if (!d || typeof d !== 'object') return
      if (d.type === 'ready' && d.role && lastStep >= 0) {
        // Re-sync the just-loaded iframe
        broadcast({ type: 'sync', step: lastStep })
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)

    // Expose step setter via closure
    function setLastStep(s: number) { lastStep = s }
    void setLastStep
  }, [broadcast])

  return { register, broadcast, syncStep }
}
