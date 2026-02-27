// ═══════════════════════════════════════════
// useRehabSession — main session hook
//
// CRITICAL: serverUrl MUST be absolute URL to backend.
// Empty string '' or '/' causes SDK to use frontend port — see MEMORY.md
// ═══════════════════════════════════════════

import { useState, useCallback } from 'react'
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  useOutputSync,
  type Message,
  type ToolActivity,
} from '@kedge-agentic/react-sdk'
import type {
  RehabPlan,
  SyncField,
  ExerciseSpec,
  ExerciseRenderData,
  ExerciseLibraryEntry,
  PendingUpdate,
} from '../types'
import { EMPTY_REHAB_PLAN } from '../types'
import exerciseLibrary from '../data/exercise-library.json'

// CRITICAL: Absolute URL to CCAAS backend, not empty string
// See MEMORY.md: "serverUrl Configuration - Empty String Causes Wrong Backend"
const SERVER_URL = 'http://localhost:3001'

const TENANT_ID = 'rehab-motion-renderer'

export interface UseRehabSessionReturn {
  // Connection
  connected: boolean
  error: string | null

  // Chat
  messages: Message[]
  isProcessing: boolean
  currentStreamContent: string
  sendMessage: (content: string) => void
  clearConversation: () => void
  cancelProcessing: () => void

  // Status
  isThinking: boolean
  thinkingContent: string
  activeTools: Map<string, ToolActivity>

  // Rehab plan
  plan: RehabPlan
  updatePlanField: <K extends keyof RehabPlan>(field: K, value: RehabPlan[K]) => void

  // Sync
  pendingUpdates: Map<SyncField, PendingUpdate>
  hasPendingUpdates: boolean
  applyField: (field: SyncField) => void
  discardField: (field: SyncField) => void
  applyAll: () => void
}

export function useRehabSession(): UseRehabSessionReturn {
  const [plan, setPlan] = useState<RehabPlan>(EMPTY_REHAB_PLAN)
  const [error, setError] = useState<string | null>(null)

  // ===== CCAAS Connection =====
  const connection = useAgentConnection({
    serverUrl: SERVER_URL,
    tenantId: TENANT_ID,
    transport: 'sse',
    autoConnect: true,
  })

  // ===== Pending updates (via SDK useOutputSync) =====
  const { pendingUpdates, handleOutputUpdate, discardUpdate } = useOutputSync({ mode: 'manual' })

  // ===== Chat =====
  const chat = useAgentChat({
    connection,
    tenantId: TENANT_ID,
    sessionTemplate: 'exercise-planner',
    onOutputUpdate: (update) => {
      handleOutputUpdate(update)
    },
  })

  // ===== Status =====
  const status = useAgentStatus({ connection })

  // ===== Plan field update =====
  const updatePlanField = useCallback(<K extends keyof RehabPlan>(field: K, value: RehabPlan[K]) => {
    setPlan((prev) => ({ ...prev, [field]: value }))
  }, [])

  // ===== Apply AI field to plan =====
  const applyField = useCallback((field: SyncField) => {
    setError(null)
    const update = pendingUpdates.get(field)
    if (!update) return

    if (field === 'exercises') {
      // Parse JSON string and merge with exercise library keyframes
      try {
        const specs: ExerciseSpec[] = JSON.parse(update.value as string)
        const lib = exerciseLibrary as Record<string, ExerciseLibraryEntry>

        const rendered: ExerciseRenderData[] = specs.map((spec) => {
          const libEntry = lib[spec.type]
          if (!libEntry) {
            // Fallback for unknown exercise types: use first known entry's rendering data
            const fallback = lib['pelvic-tilt']
            return {
              ...spec,
              id: spec.type,
              name: spec.type,
              nameZh: spec.type,
              muscles: '',
              phases: fallback?.phases || ['开始', '进行', '结束'],
              phaseDurations: fallback?.phaseDurations || [2, 3, 2],
              figure: 'lying' as const,
              keyframes: fallback?.keyframes || [],
              visualHints: [],
            }
          }
          return {
            ...spec,
            id: spec.type,
            name: libEntry.name,
            nameZh: libEntry.nameZh,
            muscles: libEntry.muscles,
            phases: libEntry.phases,
            phaseDurations: libEntry.phaseDurations,
            figure: libEntry.figure,
            keyframes: libEntry.keyframes,
            visualHints: libEntry.visualHints || [],
          }
        })

        setPlan((prev) => ({ ...prev, exercises: rendered }))
      } catch (err) {
        setError(`解析动作数据失败: ${err instanceof Error ? err.message : String(err)}`)
        return
      }
    } else {
      // All other fields are plain strings
      setPlan((prev) => ({ ...prev, [field]: update.value }))
    }

    discardUpdate(field)
  }, [pendingUpdates, discardUpdate])

  // ===== Discard AI field =====
  const discardField = useCallback((field: SyncField) => {
    discardUpdate(field)
  }, [discardUpdate])

  // ===== Apply all pending updates =====
  const applyAll = useCallback(() => {
    for (const field of pendingUpdates.keys()) {
      applyField(field as SyncField)
    }
  }, [pendingUpdates, applyField])

  return {
    // Connection
    connected: connection.connected,
    error,

    // Chat
    messages: chat.messages,
    isProcessing: chat.isProcessing,
    currentStreamContent: chat.currentStreamContent,
    sendMessage: chat.sendMessage,
    clearConversation: chat.clearConversation,
    cancelProcessing: chat.cancelProcessing,

    // Status
    isThinking: status.isThinking,
    thinkingContent: status.thinkingContent,
    activeTools: status.activeTools,

    // Plan
    plan,
    updatePlanField,

    // Sync (cast: OutputUpdate is a superset of PendingUpdate)
    pendingUpdates: pendingUpdates as unknown as Map<SyncField, PendingUpdate>,
    hasPendingUpdates: pendingUpdates.size > 0,
    applyField,
    discardField,
    applyAll,
  }
}
