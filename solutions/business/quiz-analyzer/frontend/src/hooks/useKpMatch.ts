/**
 * KP Match Hook - SDK composition for unified-kp-search skill
 *
 * Simplified version of useQuizSession for knowledge point matching only.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
} from '@kedge-agentic/react-sdk'
import type { UseAgentChatReturn, UseAgentStatusReturn, OutputUpdate } from '@kedge-agentic/react-sdk'
import { APP_CONFIG } from '../lib/constants'
import type { KpRefinementResult } from '../types'

export interface UseKpMatchReturn {
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

  kpResult: KpRefinementResult | null
}

export function useKpMatch(): UseKpMatchReturn {
  const [kpResult, setKpResult] = useState<KpRefinementResult | null>(null)

  const handleOutputUpdate = useCallback((update: OutputUpdate) => {
    if (update.field === 'kpRefinementResult') {
      setKpResult(update.value as KpRefinementResult)
    }
  }, [])

  const connection = useAgentConnection({
    serverUrl: APP_CONFIG.BACKEND_URL,
    sessionPrefix: 'kpm',
    transport: 'sse',
  })

  const chat = useAgentChat({
    connection,
    tenantId: APP_CONFIG.TENANT_ID,
    transport: 'sse',
    sessionTemplate: 'kp-search',
    onOutputUpdate: handleOutputUpdate,
  })

  const status = useAgentStatus({ connection })

  // Clear kpResult when new user message starts processing
  useEffect(() => {
    if (chat.isProcessing && chat.messages.length > 0) {
      const last = chat.messages[chat.messages.length - 1]
      if (last.role === 'user') {
        setKpResult(null)
      }
    }
  }, [chat.isProcessing, chat.messages])

  const clearConversationRef = useRef(chat.clearConversation)
  clearConversationRef.current = chat.clearConversation

  const clearConversation = useCallback(() => {
    clearConversationRef.current()
    setKpResult(null)
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

    kpResult,
  }
}
