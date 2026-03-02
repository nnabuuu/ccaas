import { useState, useCallback, useEffect } from 'react'
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
} from '@kedge-agentic/react-sdk'
import type { SyncField, DisplayItem, ViewMode } from '../types'

const SERVER_URL = import.meta.env.VITE_CCAAS_BACKEND_URL || 'http://localhost:3001' // MUST be absolute URL to CCAAS core backend
const TENANT_ID = 'smart-agri-service'

export function useAgriSession(viewMode: ViewMode, targetSessionId?: string) {
  const [displayData, setDisplayData] = useState<Map<SyncField, DisplayItem>>(new Map())

  const sessionTemplate = viewMode === 'farmer' ? 'farmer-advisor' : 'bank-assessor'

  const connection = useAgentConnection({
    serverUrl: SERVER_URL,
    tenantId: TENANT_ID,
    autoConnect: true,
    transport: 'sse',
    ...(targetSessionId
      ? { sessionId: targetSessionId }
      : { forceNewConversation: true }),
  })

  const chat = useAgentChat({
    connection,
    tenantId: TENANT_ID,
    sessionTemplate,
    transport: 'sse',
    onOutputUpdate: (update) => {
      setDisplayData(prev => {
        const next = new Map(prev)
        next.set(update.field as SyncField, {
          field: update.field as SyncField,
          value: update.value,
          preview: update.preview,
          timestamp: Date.now(),
        })
        return next
      })
    },
  })

  const status = useAgentStatus({ connection })

  // Restore displayData from persisted events when loading a history session
  useEffect(() => {
    if (!targetSessionId || !connection.connected) return

    fetch(`${SERVER_URL}/api/v1/sessions/${targetSessionId}/events?type=output_update&limit=200`)
      .then(r => r.json())
      .then(({ events }) => {
        if (!events?.length) return
        const restored = new Map<SyncField, DisplayItem>()
        for (const evt of events) {
          const p = (evt.payload as any)?.payload
          const data = p?.data
          if (data?.field) {
            restored.set(data.field as SyncField, {
              field: data.field as SyncField,
              value: data.value,
              preview: data.preview || `Update ${data.field}`,
              timestamp: new Date(evt.createdAt).getTime(),
            })
          }
        }
        if (restored.size > 0) {
          setDisplayData(restored)
        }
      })
      .catch(() => {})
  }, [targetSessionId, connection.connected])

  const clearSession = useCallback(() => {
    setDisplayData(new Map())
    chat.clearConversation()
  }, [chat])

  return {
    // Connection
    connected: connection.connected,
    sessionId: connection.sessionId,
    error: connection.error,

    // Chat
    messages: chat.messages,
    isProcessing: chat.isProcessing,
    currentStreamContent: chat.currentStreamContent,
    sendMessage: chat.sendMessage,
    clearConversation: chat.clearConversation,

    // Status
    activeTools: status.activeTools,
    isThinking: status.isThinking,
    thinkingContent: status.thinkingContent,

    // Display data
    displayData,
    clearSession,
  }
}
