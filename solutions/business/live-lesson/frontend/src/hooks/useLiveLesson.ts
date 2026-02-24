import { useState, useEffect, useCallback } from 'react'
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  usePageContext,
  type Message,
  type UseAgentConnectionReturn,
} from '@kedge-agentic/react-sdk'
import type { BoardState, LessonManifest } from '../types'
import { saveSession } from '../utils/sessionStore'

// IMPORTANT: Must use absolute URL to backend, NOT relative path or empty string
// Vite proxy ONLY works for relative URLs in HTML/CSS, NOT for fetch() or Socket.IO
// See MEMORY.md: "Empty string causes SDK to use current origin (frontend port)"
const SOCKET_URL = 'http://localhost:3001' // Core CCAAS backend

const TENANT_ID = 'live-lesson'
const SESSION_TEMPLATE = 'teaching'

export interface UseLiveLessonReturn {
  // Connection
  connected: boolean
  connection: UseAgentConnectionReturn
  sessionId: string

  // Board state (accumulated from output_update events)
  boardState: BoardState | null
  manifest: LessonManifest | null

  // Chat
  messages: Message[]
  isProcessing: boolean
  currentStreamContent: string
  isThinking: boolean
  thinkingContent: string

  // Actions
  sendMessage: (content: string) => void
  cancelProcessing: () => void
  clearConversation: () => void
  sendConfused: (nodeId: string) => void
  sendProbeSelected: (probeId: string) => void
}

export function useLiveLesson(lessonId: string, forceNew: boolean): UseLiveLessonReturn {
  const [boardState, setBoardState] = useState<BoardState | null>(null)
  const [manifest, setManifest] = useState<LessonManifest | null>(null)

  // ===== Page Context (board state visible to Agent) =====
  const { context, updateContext } = usePageContext()

  // ===== SDK Connection =====
  // CRITICAL: serverUrl must be absolute URL to CCAAS backend (port 3001)
  // autoConnect is disabled for empty lessonId to avoid wasting a backend session
  const connection = useAgentConnection({
    serverUrl: SOCKET_URL,
    tenantId: TENANT_ID,
    autoConnect: lessonId !== '',
    transport: 'sse',
    forceNewConversation: forceNew,
  })

  // ===== SDK Chat =====
  const chat = useAgentChat({
    connection,
    context,
    tenantId: TENANT_ID,
    sessionTemplate: SESSION_TEMPLATE,
    onOutputUpdate: (update) => {
      if (update.field === 'boardState') {
        setBoardState(update.value as BoardState)
      }
    },
  })

  // ===== SDK Status =====
  const status = useAgentStatus({ connection })

  // Sync boardState into page context so Agent can see current board
  useEffect(() => {
    if (boardState) {
      updateContext('live-lesson-board', { boardState, lessonId })
    }
  }, [boardState, lessonId, updateContext])

  // Persist sessionId to per-lesson store whenever it changes
  useEffect(() => {
    if (connection.sessionId) {
      saveSession(lessonId, connection.sessionId)
    }
  }, [connection.sessionId, lessonId])

  // Load manifest for this lesson from public static files
  useEffect(() => {
    if (!lessonId) return
    setManifest(null)
    const controller = new AbortController()
    fetch(`/lessons/${lessonId}/manifest.json`, { signal: controller.signal })
      .then(res => {
        if (res.ok) return res.json()
        return null
      })
      .then(data => {
        if (data) setManifest(data as LessonManifest)
      })
      .catch(() => {
        // Manifest not available via static serving; nodes will be revealed
        // dynamically based on boardState.visibleNodeIds only
      })
    return () => controller.abort()
  }, [lessonId])

  // Convenience helpers for special message formats
  const sendConfused = useCallback((nodeId: string) => {
    chat.sendMessage(`[CONFUSED] ${nodeId}`)
  }, [chat.sendMessage])

  const sendProbeSelected = useCallback((probeId: string) => {
    chat.sendMessage(`[PROBE_SELECTED] ${probeId}`)
  }, [chat.sendMessage])

  return {
    connected: connection.connected,
    connection,
    sessionId: connection.sessionId,
    boardState,
    manifest,
    messages: chat.messages,
    isProcessing: chat.isProcessing,
    currentStreamContent: chat.currentStreamContent,
    isThinking: status.isThinking,
    thinkingContent: status.thinkingContent,
    sendMessage: chat.sendMessage,
    cancelProcessing: chat.cancelProcessing,
    clearConversation: chat.clearConversation,
    sendConfused,
    sendProbeSelected,
  }
}

export default useLiveLesson
