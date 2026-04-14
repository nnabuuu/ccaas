import { useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ChatInterface,
  ChatSidebar,
  useSessionList,
} from '@kedge-agentic/chat-interface'
import { CCAAS_URL, TENANT_ID, SESSION_TEMPLATE, API_KEY } from '../config'

const SESSION_REFRESH_DELAY_MS = 1000
const FIRST_MESSAGE_REFRESH_DELAY_MS = 2000

export function ChatPage() {
  const [searchParams] = useSearchParams()
  const recipeName = searchParams.get('recipeName')

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(
    () => `conv_${crypto.randomUUID()}`
  )

  const placeholder = useMemo(
    () => recipeName ? `讨论「${recipeName}」的做法...` : '问我关于食谱的问题...',
    [recipeName],
  )

  const { sessions, refresh } = useSessionList(CCAAS_URL, API_KEY, TENANT_ID)

  const handleNewChat = useCallback(() => {
    const freshId = `conv_${crypto.randomUUID()}`
    setSessionId(freshId)
    setMobileSidebarOpen(false)
    setTimeout(() => refresh(), SESSION_REFRESH_DELAY_MS)
  }, [refresh])

  const handleSelectSession = useCallback((sid: string) => {
    setSessionId(sid)
    setMobileSidebarOpen(false)
  }, [])

  const handleMessageSent = useCallback(() => {
    setTimeout(() => refresh(), FIRST_MESSAGE_REFRESH_DELAY_MS)
  }, [refresh])

  const chatKey = sessionId ?? 'new'

  return (
    <div className="chat-page">
      <ChatSidebar
        sessions={sessions}
        currentSessionId={sessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        productName="食谱助手"
        locale="zh"
      />
      <div className="flex-1 flex flex-col min-w-0">
        <ChatInterface
          key={chatKey}
          serverUrl={CCAAS_URL}
          tenantId={TENANT_ID}
          sessionTemplate={SESSION_TEMPLATE}
          apiKey={API_KEY}
          sessionId={sessionId}
          onMenuClick={() => setMobileSidebarOpen(true)}
          onMessageSent={handleMessageSent}
          composerPlaceholder={placeholder}
          disclaimer={null}
        />
      </div>

      <style>{`
        .chat-page {
          height: 100dvh;
          display: flex;
        }
        @media (min-width: 1200px) {
          .chat-page {
            margin-left: var(--sidebar-w);
          }
        }
      `}</style>
    </div>
  )
}
