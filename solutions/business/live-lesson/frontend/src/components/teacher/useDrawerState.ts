import { useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

const VALID_OBSERVE_TYPES = new Set(['mc', 'evidence', 'map', 'discuss', 'matrix', 'guided-discovery'])

export function useDrawerState() {
  const [searchParams, setSearchParams] = useSearchParams()

  const observeParams = useMemo(() => {
    const type = searchParams.get('observe')
    const step = searchParams.get('step')
    return type && step && VALID_OBSERVE_TYPES.has(type) ? { type, step: +step } : null
  }, [searchParams])

  const summaryOpen = searchParams.get('summary') === 'open'
  const openSummary = useCallback(() => {
    setSearchParams(prev => { prev.set('summary', 'open'); return prev })
  }, [setSearchParams])
  const closeSummary = useCallback(() => {
    setSearchParams(prev => { prev.delete('summary'); return prev })
  }, [setSearchParams])

  const discussDrawerOpen = searchParams.get('discuss-drawer') === 'open'
  const openDiscussDrawer = useCallback(() => {
    setSearchParams(prev => { prev.set('discuss-drawer', 'open'); return prev })
  }, [setSearchParams])
  const closeDiscussDrawer = useCallback(() => {
    setSearchParams(prev => { prev.delete('discuss-drawer'); return prev })
  }, [setSearchParams])

  const statusDrawerOpen = searchParams.get('status-drawer') === 'open'
  const openStatusDrawer = useCallback(() => {
    setSearchParams(prev => { prev.set('status-drawer', 'open'); return prev })
  }, [setSearchParams])
  const closeStatusDrawer = useCallback(() => {
    setSearchParams(prev => { prev.delete('status-drawer'); return prev })
  }, [setSearchParams])

  const openObserve = useCallback((type: string, step: number) => {
    if (!VALID_OBSERVE_TYPES.has(type)) return
    setSearchParams(prev => {
      prev.set('observe', type)
      prev.set('step', String(step))
      return prev
    })
  }, [setSearchParams])

  const closeObserve = useCallback(() => {
    setSearchParams(prev => {
      prev.delete('observe')
      prev.delete('step')
      return prev
    })
  }, [setSearchParams])

  return {
    observeParams,
    summaryOpen,
    openSummary,
    closeSummary,
    discussDrawerOpen,
    openDiscussDrawer,
    closeDiscussDrawer,
    statusDrawerOpen,
    openStatusDrawer,
    closeStatusDrawer,
    openObserve,
    closeObserve,
  }
}
