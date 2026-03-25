import { useMemo } from 'react'
import type { QuickSuggestion } from '@/types/chat'

interface UseQuickSuggestionsOptions {
  suggestions?: QuickSuggestion[]
  maxVisible?: number
}

const DEFAULT_SUGGESTIONS: QuickSuggestion[] = [
  { label: '帮我分析', prompt: '帮我分析一下', category: 'general', score: 10 },
  { label: '生成报告', prompt: '帮我生成一份报告', category: 'general', score: 8 },
  { label: '任务规划', prompt: '帮我做一个任务规划', category: 'general', score: 6 },
]

export function useQuickSuggestions(options: UseQuickSuggestionsOptions = {}) {
  const { suggestions = DEFAULT_SUGGESTIONS, maxVisible = 5 } = options

  const sortedSuggestions = useMemo(() => {
    return [...suggestions]
      .sort((a, b) => b.score - a.score)
      .slice(0, maxVisible)
  }, [suggestions, maxVisible])

  return { suggestions: sortedSuggestions }
}
