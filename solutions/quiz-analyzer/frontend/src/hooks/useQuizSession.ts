/**
 * Quiz Session Hook - Combines SDK hooks with quiz-specific features
 *
 * Uses @ccaas/react-sdk hooks for core chat functionality
 */

import { useEffect } from 'react'
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
} from '@ccaas/react-sdk'
import type { UseAgentConnectionReturn, UseAgentChatReturn, UseAgentStatusReturn } from '@ccaas/react-sdk'

// Backend configuration
const BACKEND_URL = import.meta.env.VITE_CCAAS_BACKEND_URL || 'http://localhost:3001'
const TENANT_ID = 'quiz-analyzer'

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

  // Computed state
  const hasActiveSubAgents = status.activeSubAgents.length > 0
  const isMainProcessing = chat.isProcessing && !hasActiveSubAgents

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
  }
}
