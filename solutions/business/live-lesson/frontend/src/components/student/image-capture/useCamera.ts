import { useState, useCallback } from 'react'

export type CameraPermission = 'prompt' | 'granted' | 'denied' | 'unavailable'

export function useCamera() {
  const [permission, setPermission] = useState<CameraPermission>(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return 'unavailable'
    return 'prompt'
  })
  const [hasCamera, setHasCamera] = useState(() =>
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  )
  const [facing, setFacing] = useState<'user' | 'environment'>('environment')

  // Lazy check: only request when user first interacts
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (permission === 'granted') return true
    if (permission === 'unavailable') return false
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission('unavailable')
      setHasCamera(false)
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      // Stop all tracks immediately — we just needed the permission
      stream.getTracks().forEach(t => t.stop())
      setPermission('granted')
      setHasCamera(true)
      return true
    } catch (err: unknown) {
      const name = (err as DOMException)?.name
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setPermission('denied')
      } else {
        // NotFoundError, NotReadableError, etc.
        setPermission('unavailable')
        setHasCamera(false)
      }
      return false
    }
  }, [permission])

  const switchFacing = useCallback(() => {
    setFacing(prev => prev === 'user' ? 'environment' : 'user')
  }, [])

  return { hasCamera, permission, facing, requestPermission, switchFacing }
}
