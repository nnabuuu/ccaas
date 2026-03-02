import { useState, useCallback, useEffect } from 'react'
import type { SessionHistoryItem, ViewMode } from '../types'

const STORAGE_KEY = 'smart-agri-session-history'
const MAX_HISTORY = 50

function loadHistory(): SessionHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(items: SessionHistoryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)))
}

export function useSessionHistory() {
  const [history, setHistory] = useState<SessionHistoryItem[]>(loadHistory)

  // Sync from localStorage on mount
  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  const trackSession = useCallback((item: SessionHistoryItem) => {
    setHistory(prev => {
      // Update existing or prepend
      const idx = prev.findIndex(h => h.sessionId === item.sessionId)
      let next: SessionHistoryItem[]
      if (idx >= 0) {
        next = [...prev]
        next[idx] = item
      } else {
        next = [item, ...prev]
      }
      saveHistory(next)
      return next
    })
  }, [])

  const removeSession = useCallback((sessionId: string) => {
    setHistory(prev => {
      const next = prev.filter(h => h.sessionId !== sessionId)
      saveHistory(next)
      return next
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const getByViewMode = useCallback((mode: ViewMode) => {
    return history.filter(h => h.viewMode === mode)
  }, [history])

  return {
    history,
    trackSession,
    removeSession,
    clearHistory,
    getByViewMode,
  }
}
