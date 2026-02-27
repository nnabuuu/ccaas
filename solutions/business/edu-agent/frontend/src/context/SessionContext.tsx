import React, { createContext, useContext, useCallback, useRef, useState } from 'react'
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  type OutputUpdate,
} from '@kedge-agentic/react-sdk'
import type { UseAgentConnectionReturn, UseAgentChatReturn, UseAgentStatusReturn } from '../types'

// Output update handler type
type OutputUpdateHandler = (update: OutputUpdate) => void

export type ActiveTab = 'home' | 'lesson-plan' | 'problem-explain'

interface SessionContextValue {
  // Connection
  connection: UseAgentConnectionReturn
  // Chat
  chat: UseAgentChatReturn
  // Status
  status: UseAgentStatusReturn
  // Output update handler registration
  registerOutputHandler: (handler: OutputUpdateHandler) => () => void
  // Tab navigation
  activeTab: ActiveTab
  setActiveTab: (tab: ActiveTab) => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSessionContext must be used within SessionProvider')
  return ctx
}

interface SessionProviderProps {
  children: React.ReactNode
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home')
  const handlersRef = useRef<Set<OutputUpdateHandler>>(new Set())

  const registerOutputHandler = useCallback((handler: OutputUpdateHandler) => {
    handlersRef.current.add(handler)
    return () => {
      handlersRef.current.delete(handler)
    }
  }, [])

  const onOutputUpdate = useCallback((update: OutputUpdate) => {
    for (const handler of handlersRef.current) {
      handler(update)
    }
  }, [])

  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'edu',
    transport: 'sse',
    autoConnect: true,
  })

  const chat = useAgentChat({
    connection,
    tenantId: 'edu-agent',
    onOutputUpdate,
    sessionTemplate: 'edu-assistant',
  })

  const status = useAgentStatus({ connection })

  return (
    <SessionContext.Provider value={{ connection, chat, status, registerOutputHandler, activeTab, setActiveTab }}>
      {children}
    </SessionContext.Provider>
  )
}
