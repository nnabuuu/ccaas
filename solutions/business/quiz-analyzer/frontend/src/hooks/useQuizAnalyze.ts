/**
 * useQuizAnalyze — Hook for the analyze-explain two-phase workflow.
 * Captures multiple output fields progressively.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
} from '@kedge-agentic/react-sdk'
import type { UseAgentChatReturn, UseAgentStatusReturn, OutputUpdate } from '@kedge-agentic/react-sdk'
import { APP_CONFIG } from '../lib/constants'
import type { KpRefinementResult, ParsedContent, SolutionStep, DifficultyAssessment, TimeAssessment } from '../types'

export interface AnalyzeExplainResult {
  kpRefinementResult: KpRefinementResult | null
  parsedContent: ParsedContent | null
  difficultyAssessment: DifficultyAssessment | null
  timeAssessment: TimeAssessment | null
  timeEstimate: string | null
  correctAnswer: string | null
  solutionSteps: SolutionStep[] | null
}

export interface UseQuizAnalyzeReturn {
  connected: boolean
  sessionId: string
  error: string | null
  reconnect: () => void

  messages: UseAgentChatReturn['messages']
  isProcessing: boolean
  sendMessage: (content: string) => void
  clearConversation: () => void
  cancelProcessing: () => void

  activeTools: UseAgentStatusReturn['activeTools']
  isThinking: boolean
  thinkingContent: string

  result: AnalyzeExplainResult
}

const EMPTY_RESULT: AnalyzeExplainResult = {
  kpRefinementResult: null,
  parsedContent: null,
  difficultyAssessment: null,
  timeAssessment: null,
  timeEstimate: null,
  correctAnswer: null,
  solutionSteps: null,
}

export function useQuizAnalyze(): UseQuizAnalyzeReturn {
  const [result, setResult] = useState<AnalyzeExplainResult>(EMPTY_RESULT)

  const handleOutputUpdate = useCallback((update: OutputUpdate) => {
    switch (update.field) {
      case 'kpRefinementResult':
        setResult(prev => ({ ...prev, kpRefinementResult: update.value as KpRefinementResult }))
        break
      case 'parsedContent':
        setResult(prev => ({ ...prev, parsedContent: update.value as ParsedContent }))
        break
      case 'difficultyAssessment':
        setResult(prev => ({ ...prev, difficultyAssessment: update.value as DifficultyAssessment }))
        break
      case 'timeAssessment':
        setResult(prev => ({ ...prev, timeAssessment: update.value as TimeAssessment }))
        break
      case 'timeEstimate':
        setResult(prev => ({ ...prev, timeEstimate: update.value as string }))
        break
      case 'correctAnswer':
        setResult(prev => ({ ...prev, correctAnswer: update.value as string }))
        break
      case 'solutionSteps':
        setResult(prev => ({ ...prev, solutionSteps: update.value as SolutionStep[] }))
        break
    }
  }, [])

  const connection = useAgentConnection({
    serverUrl: APP_CONFIG.BACKEND_URL,
    sessionPrefix: 'qae',
    transport: 'sse',
  })

  const chat = useAgentChat({
    connection,
    tenantId: APP_CONFIG.TENANT_ID,
    transport: 'sse',
    sessionTemplate: 'analyze-explain',
    onOutputUpdate: handleOutputUpdate,
  })

  const status = useAgentStatus({ connection })

  // Clear results when new user message starts processing
  useEffect(() => {
    if (chat.isProcessing && chat.messages.length > 0) {
      const last = chat.messages[chat.messages.length - 1]
      if (last.role === 'user') {
        setResult(EMPTY_RESULT)
      }
    }
  }, [chat.isProcessing, chat.messages.length])

  const clearConversationRef = useRef(chat.clearConversation)
  clearConversationRef.current = chat.clearConversation

  const clearConversation = useCallback(() => {
    clearConversationRef.current()
    setResult(EMPTY_RESULT)
  }, [])

  return {
    connected: connection.connected,
    sessionId: connection.sessionId,
    error: connection.error,
    reconnect: connection.connect,

    messages: chat.messages,
    isProcessing: chat.isProcessing,
    sendMessage: chat.sendMessage,
    clearConversation,
    cancelProcessing: chat.cancelProcessing,

    activeTools: status.activeTools,
    isThinking: status.isThinking,
    thinkingContent: status.thinkingContent,

    result,
  }
}
