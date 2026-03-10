/**
 * useQuizAnalyze — Hook for the analyze-explain two-phase workflow.
 * Captures multiple output fields progressively.
 *
 * Uses useAgentProxy to stream through quiz-analyzer backend (port 3005)
 * instead of connecting directly to CCAAS Core.
 */

import { useState, useCallback, useRef } from 'react'
import { useAgentProxy } from './useAgentProxy'
import type { OutputUpdate } from './useAgentProxy'
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

  messages: ReturnType<typeof useAgentProxy>['messages']
  isProcessing: boolean
  sendMessage: (content: string) => void
  clearConversation: () => void
  cancelProcessing: () => void

  activeTools: ReturnType<typeof useAgentProxy>['activeTools']
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

  const proxy = useAgentProxy({
    endpoint: 'analyze',
    onOutputUpdate: handleOutputUpdate,
  })

  const sendMessageRef = useRef(proxy.sendMessage)
  sendMessageRef.current = proxy.sendMessage

  // Clear results immediately when sending a new message
  const sendMessage = useCallback((content: string) => {
    setResult(EMPTY_RESULT)
    sendMessageRef.current(content)
  }, [])

  const clearConversationRef = useRef(proxy.clearConversation)
  clearConversationRef.current = proxy.clearConversation

  const clearConversation = useCallback(() => {
    clearConversationRef.current()
    setResult(EMPTY_RESULT)
  }, [])

  return {
    connected: proxy.connected,
    sessionId: proxy.sessionId,
    error: proxy.error,
    reconnect: () => {}, // No-op for HTTP-based proxy

    messages: proxy.messages,
    isProcessing: proxy.isProcessing,
    sendMessage,
    clearConversation,
    cancelProcessing: proxy.cancelProcessing,

    activeTools: proxy.activeTools,
    isThinking: proxy.isThinking,
    thinkingContent: proxy.thinkingContent,

    result,
  }
}
