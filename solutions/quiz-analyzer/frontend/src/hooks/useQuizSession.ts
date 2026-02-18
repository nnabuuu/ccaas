/**
 * Quiz Session Hook - Combines SDK hooks with quiz-specific features
 *
 * Uses @ccaas/react-sdk hooks for core chat functionality
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
} from '@ccaas/react-sdk'
import type { UseAgentConnectionReturn, UseAgentChatReturn, UseAgentStatusReturn } from '@ccaas/react-sdk'
import type { QuizAnalysis, ViewMode } from '../types'

// Backend configuration
const BACKEND_URL = import.meta.env.VITE_CCAAS_BACKEND_URL || 'http://localhost:3001'
const SOLUTION_BACKEND_URL = import.meta.env.VITE_API_BASE || 'http://localhost:3005'
const TENANT_ID = 'quiz-analyzer'

export interface UseQuizSessionReturn {
  // Connection state
  connected: boolean
  sessionId: string
  error: string | null
  reconnect: () => void

  // Chat state from SDK
  messages: UseAgentChatReturn['messages']
  isProcessing: boolean
  isLoadingHistory: boolean
  sendMessage: (content: string) => void
  clearConversation: () => void
  cancelProcessing: () => void

  // Status from SDK
  activeTools: UseAgentStatusReturn['activeTools']
  isThinking: boolean
  thinkingContent: string
  todoItems: UseAgentStatusReturn['todoItems']
  todoStats: UseAgentStatusReturn['todoStats']
  activeSubAgents: UseAgentStatusReturn['activeSubAgents']
  tokenUsage: UseAgentStatusReturn['tokenUsage']

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
  const viewMode = options?.viewMode ?? 'teacher'

  // Quiz-specific state: accumulated analysis results from output_update events
  const [analysisResults, setAnalysisResults] = useState<Partial<QuizAnalysis>>({})

  // Handle output_update via SDK callback (SSE-compatible)
  const handleOutputUpdate = useCallback((update: { field: string; value: unknown; preview: string }) => {
    setAnalysisResults(prev => ({
      ...prev,
      [update.field]: update.value,
    }))
  }, [])

  // Core SDK hooks
  const connection: UseAgentConnectionReturn = useAgentConnection({
    serverUrl: BACKEND_URL,
    sessionPrefix: 'quiz',
    transport: 'sse',
  })

  const chat: UseAgentChatReturn = useAgentChat({
    connection,
    tenantId: TENANT_ID,
    transport: 'sse',
    sessionTemplate: viewMode,
    solutionConfigEndpoint: `${SOLUTION_BACKEND_URL}/config`,
    onOutputUpdate: handleOutputUpdate,
  })

  const status: UseAgentStatusReturn = useAgentStatus({ connection })

  // Computed state
  const hasActiveSubAgents = status.activeSubAgents.length > 0
  const isMainProcessing = chat.isProcessing && !hasActiveSubAgents

  // In student mode, hide solution steps from analysisResults (UI only — not a security boundary)
  const visibleResults = useMemo(() => {
    if (viewMode !== 'student') return analysisResults
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { solutionSteps: _cs, solution_steps: _ss, ...rest } = analysisResults as Partial<QuizAnalysis> & { solutionSteps?: unknown }
    return rest as Partial<QuizAnalysis>
  }, [analysisResults, viewMode])

  // Listen for custom events from pages
  // Use ref to avoid re-subscribing if sendMessage changes on every render
  const sendMessageRef = useRef(chat.sendMessage)
  sendMessageRef.current = chat.sendMessage

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
  // Depend on isProcessing and messages.length to detect new messages without
  // re-running on every message content change
  useEffect(() => {
    if (chat.isProcessing && chat.messages.length > 0) {
      const lastMessage = chat.messages[chat.messages.length - 1]
      if (lastMessage.role === 'user') {
        // New user message started, clear previous results
        setAnalysisResults({})
      }
    }
  }, [chat.isProcessing, chat.messages.length])

  return {
    // Connection state
    connected: connection.connected,
    sessionId: connection.sessionId,
    error: connection.error,
    reconnect: connection.connect, // Alias for clarity

    // Chat state from SDK
    // isLoadingHistory is managed by useAgentChat - it auto-loads message history
    // from the server when the session connects. While loading, this flag is true.
    messages: chat.messages,
    isProcessing: chat.isProcessing,
    isLoadingHistory: chat.isLoadingHistory,
    sendMessage: chat.sendMessage,
    // clearConversation creates a new session (new sessionId) and clears all messages
    clearConversation: chat.clearConversation,
    cancelProcessing: chat.cancelProcessing,

    // Status from SDK
    activeTools: status.activeTools,
    isThinking: status.isThinking,
    thinkingContent: status.thinkingContent,
    todoItems: status.todoItems,
    todoStats: status.todoStats,
    activeSubAgents: status.activeSubAgents,
    tokenUsage: status.tokenUsage,

    // Computed state
    isMainProcessing,
    hasActiveSubAgents,

    // Quiz-specific state
    analysisResults: visibleResults,
  }
}
