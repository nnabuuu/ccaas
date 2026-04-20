import { useCallback, useRef, useEffect } from 'react'

/**
 * Hook to broadcast sync messages to child iframes and listen for ready messages.
 */
export function useSurfaceSync() {
  const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map())
  const lastStepRef = useRef(-1)

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
        iframe.contentWindow?.postMessage(msg, window.location.origin)
      } catch { /* cross-origin or iframe not ready */ }
    })
  }, [])

  const syncStep = useCallback((step: number) => {
    lastStepRef.current = step
    broadcast({ type: 'sync', step })
  }, [broadcast])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      const d = e.data
      if (!d || typeof d !== 'object') return
      if (d.type === 'ready' && d.role && lastStepRef.current >= 0) {
        broadcast({ type: 'sync', step: lastStepRef.current })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [broadcast])

  return { register, broadcast, syncStep }
}
