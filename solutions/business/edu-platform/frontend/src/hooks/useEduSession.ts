import { useState, useCallback } from 'react'
import {
  useAgentConnection,
  useAgentChat,
} from '@kedge-agentic/react-sdk'
import type { LessonSyncField, DisplayItem } from '../types'
import { SERVER_URL, TENANT_ID } from '../config'

export function useEduSession() {
  const [displayData, setDisplayData] = useState<Map<LessonSyncField, DisplayItem>>(new Map())

  const connection = useAgentConnection({
    serverUrl: SERVER_URL,
    tenantId: TENANT_ID,
    autoConnect: true,
    transport: 'sse',
    forceNewConversation: true,
  })

  const chat = useAgentChat({
    connection,
    tenantId: TENANT_ID,
    sessionTemplate: 'lesson-planning',
    transport: 'sse',
    onOutputUpdate: (update) => {
      setDisplayData(prev => {
        const next = new Map(prev)
        next.set(update.field as LessonSyncField, {
          field: update.field as LessonSyncField,
          value: update.value,
          preview: update.preview || update.field,
          timestamp: Date.now(),
        })
        return next
      })
    },
  })

  const clearSession = useCallback(() => {
    setDisplayData(new Map())
    chat.clearConversation()
  }, [chat.clearConversation])

  return {
    connected: connection.connected,
    sessionId: connection.sessionId,
    error: connection.error,

    messages: chat.messages,
    isProcessing: chat.isProcessing,
    currentStreamContent: chat.currentStreamContent,
    sendMessage: chat.sendMessage,

    displayData,
    clearSession,
  }
}
