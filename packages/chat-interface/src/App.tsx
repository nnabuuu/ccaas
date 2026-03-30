import { useState, useMemo, useCallback } from 'react'
import { ChatInterface } from '@/components/ChatInterface'
import { ChatSidebar } from '@/components/ChatSidebar'
import { ApiKeyLogin } from '@/components/ApiKeyLogin'
import { useSessionList } from '@/hooks/useSessionList'
import { useAuth } from '@/hooks/useAuth'
import type { SessionContextChip } from '@/types/session-context'
import type { QuickSuggestion } from '@/types/chat'
import { getUrlParam } from '@/utils/url'

// Delay before refreshing session list after creation/message
const SESSION_REFRESH_DELAY_MS = 500
const FIRST_MESSAGE_REFRESH_DELAY_MS = 800

function isValidChip(v: unknown): v is SessionContextChip {
  return typeof v === 'object' && v !== null && typeof (v as Record<string, unknown>).key === 'string' && typeof (v as Record<string, unknown>).label === 'string'
}

function isValidSuggestion(v: unknown): v is QuickSuggestion {
  return typeof v === 'object' && v !== null && typeof (v as Record<string, unknown>).label === 'string' && typeof (v as Record<string, unknown>).prompt === 'string'
}

export default function App() {
  const tenantId = getUrlParam('tenant') ?? 'default'
  const template = getUrlParam('template') ?? undefined
  const serverUrl = getUrlParam('server') ?? 'http://localhost:3001'
  const userId = getUrlParam('userId') ?? undefined
  const chipsParam = getUrlParam('chips')
  const suggestionsParam = getUrlParam('suggestions')

  const { apiKey, login, logout } = useAuth()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)

  const { sessions, refresh } = useSessionList(serverUrl, apiKey)

  // Hint for sidebar: show last 4 chars of key
  const apiKeyHint = useMemo(() => {
    if (!apiKey) return undefined
    if (apiKey.length <= 6) return `sk-...${apiKey.slice(-2)}`
    return `sk-...${apiKey.slice(-4)}`
  }, [apiKey])

  // Context chips — Solution layer decides what to show via ?chips= param.
  // Core does not inject infrastructure params (tenantId) as user-facing context.
  const contextChips = useMemo<SessionContextChip[]>(() => {
    if (chipsParam) {
      try {
        const parsed: unknown = JSON.parse(chipsParam)
        if (Array.isArray(parsed) && parsed.every(isValidChip)) return parsed
      } catch {
        // ignore invalid JSON
      }
    }
    return []
  }, [chipsParam])

  // Demo suggestions — in production these come from session template
  const quickSuggestions = useMemo<QuickSuggestion[]>(() => {
    if (suggestionsParam) {
      try {
        const parsed: unknown = JSON.parse(suggestionsParam)
        if (Array.isArray(parsed) && parsed.every(isValidSuggestion)) return parsed
      } catch {
        // fall through to defaults
      }
    }
    return [
      { label: 'Summarize', prompt: 'Summarize this for me', category: 'general', score: 10 },
      { label: 'Analyze', prompt: 'Help me analyze this', category: 'general', score: 8 },
      { label: 'Plan', prompt: 'Help me create a plan', category: 'general', score: 6 },
      { label: 'Help', prompt: 'What can you help me with?', category: 'general', score: 4 },
    ]
  }, [suggestionsParam])

  const handleNewChat = useCallback(() => {
    // Generate fresh session ID to avoid localStorage fallback to old session
    const freshId = `conv_${crypto.randomUUID()}`
    setSessionId(freshId)
    setMobileSidebarOpen(false)
    setTimeout(() => refresh(), SESSION_REFRESH_DELAY_MS)
  }, [refresh])

  const handleSelectSession = useCallback((sid: string) => {
    setSessionId(sid)
    setMobileSidebarOpen(false)
  }, [])

  const handleMenuClick = useCallback(() => {
    setMobileSidebarOpen(true)
  }, [])

  // After a message turn completes, refresh session list (primary + backup)
  const handleFirstMessage = useCallback(() => {
    setTimeout(() => refresh(), FIRST_MESSAGE_REFRESH_DELAY_MS)
    setTimeout(() => refresh(), 3000) // backup refresh
  }, [refresh])

  // Key forces full remount on session switch
  const chatKey = sessionId ?? 'new'

  return (
    <div className="h-screen flex">
      <ChatSidebar
        sessions={sessions}
        currentSessionId={sessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        onLogout={logout}
        apiKeyHint={apiKeyHint}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <ChatInterface
          key={chatKey}
          serverUrl={serverUrl}
          tenantId={tenantId}
          sessionTemplate={template}
          contextChips={contextChips}
          quickSuggestions={quickSuggestions}
          userId={userId}
          sessionId={sessionId}
          apiKey={apiKey}
          onMenuClick={handleMenuClick}
          onMessageSent={handleFirstMessage}
          hideSkillToggle
        />
      </div>
    </div>
  )
}
