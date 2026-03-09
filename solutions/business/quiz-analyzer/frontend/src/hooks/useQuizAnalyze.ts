/**
 * useQuizAnalyze — Hook for the analyze-explain two-phase workflow.
 * Captures multiple output fields progressively.
 */

import { useState, useCallback, useRef } from 'react'
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
} from '@kedge-agentic/react-sdk'
import type { UseAgentChatReturn, UseAgentStatusReturn, OutputUpdate } from '@kedge-agentic/react-sdk'
import { APP_CONFIG } from '../lib/constants'
import type { KpRefinementResult, ParsedContent, SolutionStep, DifficultyAssessment, JXGConstruction, AnalysisStrategy } from '../types'

export interface AnalyzeExplainResult {
  kpRefinementResult: KpRefinementResult | null
  parsedContent: ParsedContent | null
  difficultyAssessment: DifficultyAssessment | null
  correctAnswer: string | null
  quickSummary: string | null
  analysisStrategy: AnalysisStrategy | null
  solutionSteps: SolutionStep[] | null
  geometryFigure: JXGConstruction | null
  solutionGeometryFigure: JXGConstruction | null
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
  correctAnswer: null,
  quickSummary: null,
  analysisStrategy: null,
  solutionSteps: null,
  geometryFigure: null,
  solutionGeometryFigure: null,
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
      case 'correctAnswer':
        setResult(prev => ({ ...prev, correctAnswer: update.value as string }))
        break
      case 'quickSummary':
        setResult(prev => ({ ...prev, quickSummary: update.value as string }))
        break
      case 'analysisStrategy':
        setResult(prev => ({ ...prev, analysisStrategy: update.value as AnalysisStrategy }))
        break
      case 'solutionSteps':
        setResult(prev => ({ ...prev, solutionSteps: update.value as SolutionStep[] }))
        break
      case 'geometryFigure':
        setResult(prev => ({ ...prev, geometryFigure: update.value as JXGConstruction }))
        break
      case 'solutionGeometryFigure':
        setResult(prev => ({ ...prev, solutionGeometryFigure: update.value as JXGConstruction }))
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

  const sendMessageRef = useRef(chat.sendMessage)
  sendMessageRef.current = chat.sendMessage

  // Clear results immediately when sending a new message
  const sendMessage = useCallback((content: string) => {
    setResult(EMPTY_RESULT)
    sendMessageRef.current(content)
  }, [])

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
    sendMessage,
    clearConversation,
    cancelProcessing: chat.cancelProcessing,

    activeTools: status.activeTools,
    isThinking: status.isThinking,
    thinkingContent: status.thinkingContent,

    result,
  }
}
