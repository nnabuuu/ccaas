import { useState, useEffect, useCallback, useRef } from 'react'
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  usePageContext,
  type Message,
  type UseAgentConnectionReturn,
} from '@kedge-agentic/react-sdk'
import type { BoardState, LessonManifest, BeatState, GlobalBoardOp, Beat } from '../types'
import type { ChalkboardAction } from '../types/blackboard-actions'
import type { TimelineItem } from '../types/blackboard-actions'
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

  // Beat-driven state
  beatState: BeatState | null
  dynamicBoardActions: ChalkboardAction[]
  globalBoardOps: GlobalBoardOp[]
  timeline: TimelineItem[]
  currentBeat: Beat | null

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
  sendAsk: (nodeId: string, content: string) => void
  advanceBeat: () => void
  canAdvanceBeat: boolean
}

export function useLiveLesson(lessonId: string, forceNew: boolean): UseLiveLessonReturn {
  const [boardState, setBoardState] = useState<BoardState | null>(null)
  const [manifest, setManifest] = useState<LessonManifest | null>(null)

  // Beat-driven state
  // beatIndexRef: mutable ref that always holds the authoritative current beat index.
  // Using a ref (not state) avoids stale-closure issues on rapid clicks and keeps
  // the value in sync with both UI-driven and AI-driven (advance_beat) advances.
  const beatIndexRef = useRef(-1)
  const [beatState, setBeatState] = useState<BeatState | null>(null)
  const [dynamicBoardActions, setDynamicBoardActions] = useState<ChalkboardAction[]>([])
  const [globalBoardOps, setGlobalBoardOps] = useState<GlobalBoardOp[]>([])
  const [timeline, setTimeline] = useState<TimelineItem[]>([])

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
      } else if (update.field === 'beatState') {
        const raw = update.value as Record<string, unknown>
        const bs: BeatState = {
          currentBeatId: (raw.currentBeatId as string) ?? null,
          currentBeatIndex: (raw.currentBeatIndex as number) ?? 0,
          totalBeats: (raw.totalBeats as number) ?? 0,
          sectionId: (raw.sectionId as string) ?? null,
        }
        setBeatState(bs)
        beatIndexRef.current = bs.currentBeatIndex // keep ref in sync with AI-driven advances

        // Auto-reveal section in GlobalBoard (advance_beat sends sectionId)
        if (bs.sectionId) {
          setGlobalBoardOps(prev => {
            const alreadyRevealed = prev.some(op => op.nodeId === bs.sectionId && op.op === 'reveal')
            return alreadyRevealed ? prev : [...prev, { nodeId: bs.sectionId!, op: 'reveal' }]
          })
        }

        // Push narrator item to timeline if narratorText provided
        if (raw.narratorText) {
          setTimeline(prev => [...prev, {
            id: `narrator-${bs.currentBeatId}-${Date.now()}`,
            type: 'narrator' as const,
            content: raw.narratorText as string,
            beatId: bs.currentBeatId ?? undefined,
            timestamp: Date.now(),
          }])
        }

        // Apply beat's scripted dynamicBoardActions (embedded in beatState by advance_beat)
        if (Array.isArray(raw.dynamicBoardActions)) {
          setDynamicBoardActions(raw.dynamicBoardActions as ChalkboardAction[])
        }
      } else if (update.field === 'dynamicBoardActions') {
        // execute_dynamic_board appends to existing actions (AI偏轨时)
        setDynamicBoardActions(update.value as ChalkboardAction[])
      } else if (update.field === 'globalBoardOps') {
        const ops = update.value as GlobalBoardOp[]
        setGlobalBoardOps(prev => [...prev, ...ops])
      }
    },
  })

  // ===== SDK Status =====
  const status = useAgentStatus({ connection })

  // Sync boardState + beatState into page context so Agent can see current board
  useEffect(() => {
    updateContext('live-lesson-board', { boardState, beatState, lessonId })
  }, [boardState, beatState, lessonId, updateContext])

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

  // Keep a ref to the latest chat so timer callbacks read current state, not stale closure.
  const chatRef = useRef(chat)
  chatRef.current = chat

  // Auto-start: fire '开始上课' after history loading settles.
  const autoStartedRef = useRef(false)

  // Reset all beat-driven state when lesson changes
  useEffect(() => {
    beatIndexRef.current = -1
    autoStartedRef.current = false
    setBeatState(null)
    setDynamicBoardActions([])
    setGlobalBoardOps([])
    setTimeline([])
    setBoardState(null)
  }, [lessonId])
  useEffect(() => {
    const timer = setTimeout(() => {
      const c = chatRef.current
      if (!autoStartedRef.current && !c.isLoadingHistory && c.messages.length === 0 && !c.isProcessing) {
        autoStartedRef.current = true
        c.sendMessage('开始上课')
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [chat.isLoadingHistory]) // eslint-disable-line react-hooks/exhaustive-deps

  // Send an ask message when student clicks on a board node
  // Format: [ASK] {nodeId}: {content}
  const sendAsk = useCallback((nodeId: string, content: string) => {
    chat.sendMessage(`[ASK] ${nodeId}: ${content}`)
  }, [chat.sendMessage])

  // UI-driven beat advancement: reads directly from manifest, no AI needed.
  // Uses beatIndexRef (not state) as the source of truth for the current index
  // so rapid clicks can't advance by more than one beat per click.
  const advanceBeat = useCallback(() => {
    if (!manifest?.beats) return
    const nextIndex = beatIndexRef.current + 1
    if (nextIndex >= manifest.beats.length) return

    const beat = manifest.beats[nextIndex]
    beatIndexRef.current = nextIndex  // update synchronously before any setState

    const bs: BeatState = {
      currentBeatId: beat.id,
      currentBeatIndex: nextIndex,
      totalBeats: manifest.beats.length,
      sectionId: beat.sectionId,
    }
    setBeatState(bs)

    if (beat.sectionId) {
      setGlobalBoardOps(prev => {
        const already = prev.some(op => op.nodeId === beat.sectionId && op.op === 'reveal')
        return already ? prev : [...prev, { nodeId: beat.sectionId!, op: 'reveal' }]
      })
    }

    if (beat.narratorText) {
      setTimeline(prev => [...prev, {
        id: `narrator-${beat.id}-${Date.now()}`,
        type: 'narrator' as const,
        content: beat.narratorText,
        beatId: beat.id,
        timestamp: Date.now(),
      }])
    }

    // Always replace actions (even with []) so the canvas doesn't replay
    // the previous beat's actions on a beat that has no board content.
    setDynamicBoardActions(Array.isArray(beat.dynamicBoardActions) ? beat.dynamicBoardActions : [])
  }, [manifest])  // ref reads are never stale, no currentBeatIndex dep needed

  // Derive from beatState so this stays in sync with both UI-driven and AI-driven advances
  const canAdvanceBeat = !!manifest?.beats && (beatState?.currentBeatIndex ?? -1) < manifest.beats.length - 1

  // Compute currentBeat from beatState + manifest
  const currentBeat: Beat | null = beatState?.currentBeatId
    ? (manifest?.beats?.find(b => b.id === beatState.currentBeatId) ?? null)
    : null

  return {
    connected: connection.connected,
    connection,
    sessionId: connection.sessionId,
    boardState,
    manifest,
    beatState,
    dynamicBoardActions,
    globalBoardOps,
    timeline,
    currentBeat,
    messages: chat.messages,
    isProcessing: chat.isProcessing,
    currentStreamContent: chat.currentStreamContent,
    isThinking: status.isThinking,
    thinkingContent: status.thinkingContent,
    sendMessage: chat.sendMessage,
    cancelProcessing: chat.cancelProcessing,
    clearConversation: chat.clearConversation,
    sendAsk,
    advanceBeat,
    canAdvanceBeat,
  }
}

export default useLiveLesson
