/**
 * Quiz Session Hook - Combines SDK hooks with quiz-specific features
 *
 * Uses @ccaas/react-sdk hooks for core chat functionality
 */

import { useEffect, useState } from 'react'
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
} from '@ccaas/react-sdk'
import type { UseAgentConnectionReturn, UseAgentChatReturn, UseAgentStatusReturn } from '@ccaas/react-sdk'
import type { QuizAnalysis } from '../types'

// Backend configuration
const BACKEND_URL = import.meta.env.VITE_CCAAS_BACKEND_URL || 'http://localhost:3001'
const TENANT_ID = 'quiz-analyzer'

// Type for output_update event (matches backend OutputUpdateEvent)
interface OutputUpdateEvent {
  payload?: {
    data?: {
      field: string
      value: unknown
      preview: string
    }
  }
  // Also support flat structure in case backend changes
  field?: string
  value?: unknown
  preview?: string
}

export interface UseQuizSessionReturn {
  // Connection state
  connected: boolean
  sessionId: string
  error: string | null

  // Chat state from SDK
  messages: UseAgentChatReturn['messages']
  isProcessing: boolean
  sendMessage: (content: string) => void
  clearMessages: () => void
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

/**
 * Parse output_update event to extract field/value/preview
 * Handles both nested and flat structures
 */
function parseOutputUpdateEvent(event: OutputUpdateEvent): {
  field: string
  value: unknown
  preview: string
} | null {
  // Try nested structure first (current backend format)
  const nested = event.payload?.data
  if (nested?.field) {
    return {
      field: nested.field,
      value: nested.value,
      preview: nested.preview || `Updated ${nested.field}`,
    }
  }

  // Try flat structure (fallback)
  if (event.field) {
    return {
      field: event.field,
      value: event.value,
      preview: event.preview || `Updated ${event.field}`,
    }
  }

  return null
}

export function useQuizSession(): UseQuizSessionReturn {
  // Core SDK hooks
  const connection: UseAgentConnectionReturn = useAgentConnection({
    serverUrl: BACKEND_URL,
    sessionPrefix: 'quiz',
  })

  const chat: UseAgentChatReturn = useAgentChat({
    connection,
    tenantId: TENANT_ID,
  })

  const status: UseAgentStatusReturn = useAgentStatus({ connection })

  // Quiz-specific state: accumulated analysis results from output_update events
  const [analysisResults, setAnalysisResults] = useState<Partial<QuizAnalysis>>({})

  // Computed state
  const hasActiveSubAgents = status.activeSubAgents.length > 0
  const isMainProcessing = chat.isProcessing && !hasActiveSubAgents

  // Listen for output_update events to capture analysis results
  useEffect(() => {
    if (!connection.socket) return

    const handleOutputUpdate = (event: OutputUpdateEvent) => {
      const parsed = parseOutputUpdateEvent(event)

      if (!parsed) {
        console.warn('⚠️ Output update missing field, skipping. Raw event:', event)
        return
      }

      console.log('📦 Quiz analysis update received:', parsed.field, parsed.preview)

      // Update analysis results with the new field
      setAnalysisResults(prev => ({
        ...prev,
        [parsed.field]: parsed.value,
      }))
    }

    connection.socket.on('output_update', handleOutputUpdate)

    return () => {
      connection.socket.off('output_update', handleOutputUpdate)
    }
  }, [connection.socket])

  // Listen for custom events from pages
  useEffect(() => {
    const handleParseRequest = (e: Event) => {
      const customEvent = e as CustomEvent
      const { content } = customEvent.detail
      chat.sendMessage(`请帮我解析这道题目：\n\n${content}`)
    }

    const handleAnalysisRequest = (e: Event) => {
      const customEvent = e as CustomEvent
      const { quizId } = customEvent.detail
      chat.sendMessage(`请帮我分析题目ID: ${quizId}`)
    }

    window.addEventListener('quiz:request-parse', handleParseRequest)
    window.addEventListener('quiz:request-analysis', handleAnalysisRequest)

    return () => {
      window.removeEventListener('quiz:request-parse', handleParseRequest)
      window.removeEventListener('quiz:request-analysis', handleAnalysisRequest)
    }
  }, [chat.sendMessage])

  // Clear analysis results when starting a new session/message
  useEffect(() => {
    if (chat.isProcessing && chat.messages.length > 0) {
      const lastMessage = chat.messages[chat.messages.length - 1]
      if (lastMessage.role === 'user') {
        // New user message started, clear previous results
        setAnalysisResults({})
      }
    }
  }, [chat.isProcessing, chat.messages])

  return {
    // Connection state
    connected: connection.connected,
    sessionId: connection.sessionId,
    error: connection.error,

    // Chat state from SDK
    messages: chat.messages,
    isProcessing: chat.isProcessing,
    sendMessage: chat.sendMessage,
    clearMessages: chat.clearMessages,
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
    analysisResults,
  }
}
