import { useState, useMemo, useCallback } from 'react'
import { ChatInterface } from '@/components/ChatInterface'
import { ChatSidebar } from '@/components/ChatSidebar'
import { useSessionList } from '@/hooks/useSessionList'
import type { SessionContextChip } from '@/types/session-context'
import type { QuickSuggestion } from '@/types/chat'

function getUrlParam(key: string): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get(key)
}

export default function App() {
  const tenantId = getUrlParam('tenant') ?? 'default'
  const template = getUrlParam('template') ?? undefined
  const serverUrl = getUrlParam('server') ?? 'http://localhost:3001'
  const userId = getUrlParam('userId') ?? undefined
  const apiKey = getUrlParam('apiKey') ?? undefined

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)

  const { sessions, refresh } = useSessionList(serverUrl, tenantId, userId, apiKey)

  // Demo context chips — in production these come from session template
  const contextChips = useMemo<SessionContextChip[]>(() => {
    const chips = getUrlParam('chips')
    if (chips) {
      try {
        return JSON.parse(chips) as SessionContextChip[]
      } catch {
        // fall through to defaults
      }
    }
    return [
      { key: 'class', label: '一班', active: true },
      { key: 'subject', label: '数学' },
      { key: 'school', label: '示范学校' },
    ]
  }, [])

  // Demo suggestions — in production these come from session template
  const quickSuggestions = useMemo<QuickSuggestion[]>(() => {
    const suggestions = getUrlParam('suggestions')
    if (suggestions) {
      try {
        return JSON.parse(suggestions) as QuickSuggestion[]
      } catch {
        // fall through to defaults
      }
    }
    return [
      { label: '周报', prompt: '生成本周报告', category: 'daily', score: 10 },
      { label: '分析', prompt: '分析当前状态', category: 'daily', score: 8 },
      { label: '规划', prompt: '帮我做计划', category: 'teaching', score: 6 },
      { label: '回顾', prompt: '回顾近期活动', category: 'admin', score: 4 },
    ]
  }, [])

  const handleNewChat = useCallback(() => {
    // Generate fresh session ID to avoid localStorage fallback to old session
    const freshId = `conv_${crypto.randomUUID()}`
    setSessionId(freshId)
    setMobileSidebarOpen(false)
    setTimeout(() => refresh(), 1000)
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
    setTimeout(() => refresh(), 2000)
  }, [refresh])

  // Key forces full remount on session switch
  const chatKey = sessionId ?? 'new'

  return (
    <div className="h-screen flex">
      {userId && (
        <ChatSidebar
          sessions={sessions}
          currentSessionId={sessionId}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
      )}
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
          onMenuClick={userId ? handleMenuClick : undefined}
          onMessageSent={handleFirstMessage}
        />
      </div>
    </div>
  )
}
