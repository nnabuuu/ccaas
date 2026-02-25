import { useState, useEffect, useCallback, useRef } from 'react'
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  usePageContext,
  type Message,
  type UseAgentConnectionReturn,
} from '@kedge-agentic/react-sdk'
import type { BoardState, LessonManifest, BeatState, GlobalBoardOp, Beat, BeatSnapshot } from '../types'
import type { ChalkboardAction } from '../types/blackboard-actions'
import type { TimelineItem } from '../types/blackboard-actions'
import { saveSession } from '../utils/sessionStore'

// IMPORTANT: Must use absolute URL to backend, NOT relative path or empty string
// Vite proxy ONLY works for relative URLs in HTML/CSS, NOT for fetch() or Socket.IO
// See MEMORY.md: "Empty string causes SDK to use current origin (frontend port)"
const SOCKET_URL = 'http://localhost:3001' // Core CCAAS backend
const LESSON_API_URL = 'http://localhost:3006' // Solution backend (lesson list + manifest)

const TENANT_ID = 'live-lesson'
const SESSION_TEMPLATE = 'teaching'

export type TutoringMode = 'idle' | 'picking' | 'suggesting' | 'explaining'

export type SelectionMode = 'single' | 'multi'

export interface SuggestedQuestionsPayload {
  questions: string[]
  selectionMode: SelectionMode
}

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

  // Beat snapshots & navigation
  beatSnapshots: BeatSnapshot[]
  viewingBeatIndex: number | null
  viewingSectionId: string | null
  captureBeatSnapshot: (svgHtml: string) => void
  navigateToBeat: (index: number | null) => void

  // Tutoring
  tutoringMode: TutoringMode
  isAnimating: boolean
  suggestedQuestions: string[]
  selectionMode: SelectionMode

  // Actions
  sendMessage: (content: string) => void
  cancelProcessing: () => void
  clearConversation: () => void
  sendAsk: (nodeId: string, content: string) => void
  startLesson: () => void
  advanceBeat: () => void
  canAdvanceBeat: boolean

  // Tutoring actions
  raiseHand: () => void
  dismissTutoring: () => void
  sendExplainRequest: (question: string) => void
  requestMoreQuestions: () => void
  handleAnimationChange: (animating: boolean) => void

  // Tutoring panel
  tutoringPanelOpen: boolean
  openTutoringPanel: () => void
  closeTutoringPanel: () => void
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

  // Beat snapshot & navigation state
  const [beatSnapshots, setBeatSnapshots] = useState<BeatSnapshot[]>([])
  const [viewingBeatIndex, setViewingBeatIndex] = useState<number | null>(null)

  // Tutoring state
  const [tutoringMode, setTutoringMode] = useState<TutoringMode>('idle')
  const [isAnimating, setIsAnimating] = useState(false)
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('single')
  const [tutoringPanelOpen, setTutoringPanelOpen] = useState(false)

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

        // Push narrator item to timeline if narratorText provided (dedup: skip if already added by advanceBeat)
        if (raw.narratorText) {
          setTimeline(prev => {
            if (prev.some(item => item.beatId === bs.currentBeatId && item.type === 'narrator')) return prev
            return [...prev, {
              id: `narrator-${bs.currentBeatId}-${Date.now()}`,
              type: 'narrator' as const,
              content: raw.narratorText as string,
              beatId: bs.currentBeatId ?? undefined,
              timestamp: Date.now(),
            }]
          })
        }

        // Apply beat's scripted dynamicBoardActions (embedded in beatState by advance_beat)
        if (raw.dynamicBoardActions) {
          const dba = typeof raw.dynamicBoardActions === 'string'
            ? JSON.parse(raw.dynamicBoardActions)
            : raw.dynamicBoardActions
          if (Array.isArray(dba)) setDynamicBoardActions(dba)
        }
      } else if (update.field === 'dynamicBoardActions') {
        // execute_dynamic_board appends to existing actions (AI偏轨时)
        const raw = typeof update.value === 'string' ? JSON.parse(update.value) : update.value
        setDynamicBoardActions(Array.isArray(raw) ? raw : [])
      } else if (update.field === 'globalBoardOps') {
        const ops = update.value as GlobalBoardOp[]
        setGlobalBoardOps(prev => [...prev, ...ops])
      } else if (update.field === 'suggestedQuestions') {
        // AI returned suggested questions via suggest_questions tool
        const payload = update.value as SuggestedQuestionsPayload
        setSuggestedQuestions(payload.questions)
        setSelectionMode(payload.selectionMode)
        setTutoringMode('picking')
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
    fetch(`${LESSON_API_URL}/api/lessons/${lessonId}/manifest`, { signal: controller.signal })
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

  // Keep refs to latest values so callbacks read current state, not stale closure.
  const chatRef = useRef(chat)
  chatRef.current = chat

  const manifestRef = useRef(manifest)
  manifestRef.current = manifest

  const beatStateRef = useRef(beatState)
  beatStateRef.current = beatState

  // Guard: prevent duplicate '开始上课' messages
  const autoStartedRef = useRef(false)

  // startLesson: user-triggered — fires '开始上课' on first call only.
  // Guards against duplicate calls and skips if session has history (resume).
  const startLesson = useCallback(() => {
    if (autoStartedRef.current) return
    if (chatRef.current.messages.length > 0) return
    autoStartedRef.current = true
    chatRef.current.sendMessage('开始上课')
  }, [])

  // Reset all beat-driven state when lesson changes
  useEffect(() => {
    beatIndexRef.current = -1
    autoStartedRef.current = false
    setBeatState(null)
    setDynamicBoardActions([])
    setGlobalBoardOps([])
    setTimeline([])
    setBoardState(null)
    setTutoringMode('idle')
    setSuggestedQuestions([])
    setSelectionMode('single')
    setIsAnimating(false)
    setBeatSnapshots([])
    setViewingBeatIndex(null)
    setTutoringPanelOpen(false)
  }, [lessonId])

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
      setTimeline(prev => {
        if (prev.some(item => item.beatId === beat.id && item.type === 'narrator')) return prev
        return [...prev, {
          id: `narrator-${beat.id}-${Date.now()}`,
          type: 'narrator' as const,
          content: beat.narratorText,
          beatId: beat.id,
          timestamp: Date.now(),
        }]
      })
    }

    // Always replace actions (even with []) so the canvas doesn't replay
    // the previous beat's actions on a beat that has no board content.
    setDynamicBoardActions(Array.isArray(beat.dynamicBoardActions) ? beat.dynamicBoardActions : [])

    // Reset tutoring state on beat change
    setTutoringMode('idle')
    setSuggestedQuestions([])
    setSelectionMode('single')

    // Auto-scroll carousel to latest beat
    setViewingBeatIndex(null)
  }, [manifest])  // ref reads are never stale, no currentBeatIndex dep needed

  // Derive from beatState so this stays in sync with both UI-driven and AI-driven advances
  const canAdvanceBeat = !!manifest?.beats && (beatState?.currentBeatIndex ?? -1) < manifest.beats.length - 1

  // Compute currentBeat from beatState + manifest
  const currentBeat: Beat | null = beatState?.currentBeatId
    ? (manifest?.beats?.find(b => b.id === beatState.currentBeatId) ?? null)
    : null

  // Keep currentBeat ref for tutoring callbacks
  const currentBeatRef = useRef(currentBeat)
  currentBeatRef.current = currentBeat

  // ===== Tutoring callbacks =====

  const raiseHand = useCallback(() => {
    setTutoringMode('picking')
    setSuggestedQuestions([])
  }, [])

  const dismissTutoring = useCallback(() => {
    setTutoringMode('idle')
    setSuggestedQuestions([])
  }, [])

  const sendExplainRequest = useCallback((question: string) => {
    setTutoringMode('explaining')

    const beat = currentBeatRef.current
    const m = manifestRef.current
    const bs = beatStateRef.current

    const lines = [
      '/explain',
      '[CONTEXT]',
      `课程: ${m?.title ?? ''}`,
      `当前 Beat: ${bs?.currentBeatId ?? ''} (${(bs?.currentBeatIndex ?? 0) + 1}/${bs?.totalBeats ?? 0})`,
      `章节: ${bs?.sectionId ?? ''}`,
      `叙述内容: ${beat?.narratorText ?? ''}`,
      '[/CONTEXT]',
      '',
      '[QUESTION]',
      question,
      '[/QUESTION]',
    ]

    chatRef.current.sendMessage(lines.join('\n'))
  }, [])

  const requestMoreQuestions = useCallback(() => {
    setTutoringMode('suggesting')

    const beat = currentBeatRef.current
    const m = manifestRef.current
    const bs = beatStateRef.current
    const eqs = beat?.expectedQuestions ?? []

    const lines = [
      '/suggest-questions',
      '[CONTEXT]',
      `课程: ${m?.title ?? ''}`,
      `当前 Beat: ${bs?.currentBeatId ?? ''} (${(bs?.currentBeatIndex ?? 0) + 1}/${bs?.totalBeats ?? 0})`,
      `叙述内容: ${beat?.narratorText ?? ''}`,
      `已有预设问题: ${eqs.join(' | ')}`,
      '[/CONTEXT]',
    ]

    chatRef.current.sendMessage(lines.join('\n'))
  }, [])

  const handleAnimationChange = useCallback((animating: boolean) => {
    setIsAnimating(animating)
  }, [])

  const openTutoringPanel = useCallback(() => {
    setTutoringPanelOpen(true)
  }, [])

  const closeTutoringPanel = useCallback(() => {
    setTutoringPanelOpen(false)
  }, [])

  // Capture a beat snapshot (called by DynamicBoard before beat reset)
  const captureBeatSnapshot = useCallback((svgHtml: string) => {
    const bs = beatStateRef.current
    if (!bs?.currentBeatId) return
    const beat = manifestRef.current?.beats?.find(b => b.id === bs.currentBeatId)
    const snap: BeatSnapshot = {
      beatId: bs.currentBeatId,
      beatIndex: bs.currentBeatIndex,
      sectionId: bs.sectionId ?? '',
      svgSnapshot: svgHtml,
      narratorText: beat?.narratorText ?? '',
    }
    setBeatSnapshots(prev => {
      const idx = prev.findIndex(s => s.beatId === snap.beatId)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = snap
        return next
      }
      return [...prev, snap]
    })
  }, [])

  // Navigate to a beat index (null = current/latest beat)
  const navigateToBeat = useCallback((index: number | null) => {
    setViewingBeatIndex(index)
  }, [])

  // Derived: section ID of the currently viewed beat (for GlobalBoard highlight)
  const viewingSectionId: string | null = viewingBeatIndex !== null
    ? (beatSnapshots.find(s => s.beatIndex === viewingBeatIndex)?.sectionId ?? beatState?.sectionId ?? null)
    : (beatState?.sectionId ?? null)

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
    tutoringMode,
    isAnimating,
    suggestedQuestions,
    selectionMode,
    sendMessage: chat.sendMessage,
    cancelProcessing: chat.cancelProcessing,
    clearConversation: chat.clearConversation,
    sendAsk,
    startLesson,
    advanceBeat,
    canAdvanceBeat,
    beatSnapshots,
    viewingBeatIndex,
    viewingSectionId,
    captureBeatSnapshot,
    navigateToBeat,
    raiseHand,
    dismissTutoring,
    sendExplainRequest,
    requestMoreQuestions,
    handleAnimationChange,
    tutoringPanelOpen,
    openTutoringPanel,
    closeTutoringPanel,
  }
}

export default useLiveLesson
