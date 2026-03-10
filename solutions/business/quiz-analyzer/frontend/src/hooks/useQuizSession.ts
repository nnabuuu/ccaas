/**
 * Quiz Session Hook - Uses useAgentProxy to stream through quiz-analyzer backend
 *
 * Replaces direct react-sdk hooks (useAgentConnection/useAgentChat/useAgentStatus)
 * with the SSE proxy pattern through quiz-analyzer backend (port 3005).
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useAgentProxy } from './useAgentProxy'
import type { OutputUpdate, ToolActivity, TokenUsage, ProxyMessage } from './useAgentProxy'
import type { QuizAnalysis, ViewMode } from '../types'

export interface UseQuizSessionReturn {
  // Connection state
  connected: boolean
  sessionId: string
  error: string | null
  reconnect: () => void

  // Chat state
  messages: ProxyMessage[]
  isProcessing: boolean
  isLoadingHistory: boolean
  sendMessage: (content: string) => void
  clearConversation: () => void
  cancelProcessing: () => void

  // Status
  activeTools: Map<string, ToolActivity>
  isThinking: boolean
  thinkingContent: string
  tokenUsage: TokenUsage | null

  // Compatibility: ChatPanel expects these from useAgentStatus (empty in proxy mode)
  todoItems: never[]
  todoStats: { completed: number; inProgress: number; pending: number; total: number }
  activeSubAgents: never[]

  // Computed state
  isMainProcessing: boolean
  hasActiveSubAgents: boolean

  // Quiz-specific state
  analysisResults: Partial<QuizAnalysis>
}

interface UseQuizSessionOptions {
  viewMode?: ViewMode
}

// NOTE: When viewMode changes, the caller must also call clearConversation() to start a
// new session so the updated sessionTemplate takes effect. Changing viewMode alone only
// updates the template used in the next sendMessage on the *current* session.
export function useQuizSession(options?: UseQuizSessionOptions): UseQuizSessionReturn {
  const viewMode = options?.viewMode ?? 'prep'

  // Map ViewMode to backend endpoint
  const endpoint = viewMode === 'student' ? 'student' : 'teach'

  // Quiz-specific state: accumulated analysis results from output_update events
  const [analysisResults, setAnalysisResults] = useState<Partial<QuizAnalysis>>({})

  // Handle output_update via proxy callback
  const handleOutputUpdate = useCallback((update: OutputUpdate) => {
    setAnalysisResults(prev => ({
      ...prev,
      [update.field]: update.value,
    }))
  }, [])

  // Core proxy hook — routes through quiz-analyzer backend (port 3005) → CCAAS Core
  const proxy = useAgentProxy({
    endpoint,
    onOutputUpdate: handleOutputUpdate,
  })

  // Computed state
  const hasActiveSubAgents = false // Not tracked through proxy
  const isMainProcessing = proxy.isProcessing && !hasActiveSubAgents

  // In student mode, hide solution steps from analysisResults (UI only — not a security boundary)
  const visibleResults = useMemo(() => {
    if (viewMode !== 'student') return analysisResults
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { solutionSteps: _cs, solution_steps: _ss, ...rest } = analysisResults as Partial<QuizAnalysis> & { solutionSteps?: unknown }
    return rest as Partial<QuizAnalysis>
  }, [analysisResults, viewMode])

  // Listen for custom events from pages
  const sendMessageRef = useRef(proxy.sendMessage)
  sendMessageRef.current = proxy.sendMessage

  useEffect(() => {
    const handleParseRequest = (e: Event) => {
      const customEvent = e as CustomEvent
      const { content } = customEvent.detail
      sendMessageRef.current(`请帮我解析这道题目：\n\n${content}`)
    }

    const handleAnalysisRequest = (e: Event) => {
      const customEvent = e as CustomEvent
      const { quizId } = customEvent.detail
      sendMessageRef.current(`请帮我分析题目ID: ${quizId}`)
    }

    window.addEventListener('quiz:request-parse', handleParseRequest)
    window.addEventListener('quiz:request-analysis', handleAnalysisRequest)

    return () => {
      window.removeEventListener('quiz:request-parse', handleParseRequest)
      window.removeEventListener('quiz:request-analysis', handleAnalysisRequest)
    }
  }, [])

  // Clear analysis results when a new user message starts processing
  useEffect(() => {
    if (proxy.isProcessing && proxy.messages.length > 0) {
      const lastMessage = proxy.messages[proxy.messages.length - 1]
      if (lastMessage.role === 'user') {
        setAnalysisResults({})
      }
    }
  }, [proxy.isProcessing, proxy.messages.length])

  // Wrap clearConversation to also clear analysis results
  const clearConversation = useCallback(() => {
    proxy.clearConversation()
    setAnalysisResults({})
  }, [proxy.clearConversation])

  return {
    // Connection state
    connected: proxy.connected,
    sessionId: proxy.sessionId,
    error: proxy.error,
    reconnect: () => {}, // No-op for HTTP proxy

    // Chat state
    messages: proxy.messages,
    isProcessing: proxy.isProcessing,
    isLoadingHistory: false, // No history loading in proxy mode
    sendMessage: proxy.sendMessage,
    clearConversation,
    cancelProcessing: proxy.cancelProcessing,

    // Status
    activeTools: proxy.activeTools,
    isThinking: proxy.isThinking,
    thinkingContent: proxy.thinkingContent,
    tokenUsage: proxy.tokenUsage,

    // Compatibility: ChatPanel expects these (not available via proxy)
    todoItems: [],
    todoStats: { completed: 0, inProgress: 0, pending: 0, total: 0 },
    activeSubAgents: [],

    // Computed state
    isMainProcessing,
    hasActiveSubAgents,

    // Quiz-specific state
    analysisResults: visibleResults,
  }
}
