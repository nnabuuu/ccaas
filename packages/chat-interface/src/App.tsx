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
const SESSION_REFRESH_DELAY_MS = 1000
const FIRST_MESSAGE_REFRESH_DELAY_MS = 2000

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

  // Demo context chips — in production these come from session template
  const contextChips = useMemo<SessionContextChip[]>(() => {
    if (chipsParam) {
      try {
        const parsed: unknown = JSON.parse(chipsParam)
        if (Array.isArray(parsed) && parsed.every(isValidChip)) return parsed
      } catch {
        // fall through to defaults
      }
    }
    return [
      { key: 'tenant', label: tenantId, active: true },
      { key: 'subject', label: '数学', active: false },
      { key: 'grade', label: '高一', active: false },
    ]
  }, [tenantId, chipsParam])

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
      { label: '备课助手', prompt: '帮我准备一节高一数学课', category: 'teach', score: 10 },
      { label: '出题组卷', prompt: '生成一套数学测验题', category: 'teach', score: 8 },
      { label: '学情分析', prompt: '分析班级最近的考试成绩', category: 'analyze', score: 6 },
      { label: '教学设计', prompt: '设计一个互动教学活动', category: 'teach', score: 4 },
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

  // After first message is sent, refresh session list
  const handleFirstMessage = useCallback(() => {
    setTimeout(() => refresh(), FIRST_MESSAGE_REFRESH_DELAY_MS)
  }, [refresh])

  // No API key → show login
  if (!apiKey) {
    return <ApiKeyLogin onLogin={login} serverUrl={serverUrl} />
  }

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
        />
      </div>
    </div>
  )
}
