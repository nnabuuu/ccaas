import { useState, useCallback, useRef } from 'react'

export function useWidgetState(initialState: Record<string, unknown> = {}) {
  const initialRef = useRef(initialState)
  const [state, setState] = useState<Record<string, unknown>>(initialState)

  const updateState = useCallback((key: string, value: unknown) => {
    setState(prev => ({ ...prev, [key]: value }))
  }, [])

  const mergeState = useCallback((patch: Record<string, unknown>) => {
    setState(prev => ({ ...prev, ...patch }))
  }, [])

  const resetState = useCallback(() => {
    setState(initialRef.current)
  }, [])

  return {
    state,
    setState,
    updateState,
    mergeState,
    resetState,
  }
}
