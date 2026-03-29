import { useState, useMemo, useCallback } from 'react'
import {
  ChatInterface,
  ChatSidebar,
  useSessionList,
} from '@kedge-agentic/chat-interface'
import type { SessionContextChip, QuickSuggestion } from '@kedge-agentic/chat-interface'
import { ClassSwitcher } from './components/ClassSwitcher'
import { LoginPage } from './components/LoginPage'
import { MOCK_CLASSES, DEFAULT_CLASS } from './data/mock-classes'
import type { ClassInfo } from './data/mock-classes'
import { SERVER_URL, TENANT_ID } from './config'
import { useEduAuth } from './hooks/useEduAuth'

const SESSION_REFRESH_DELAY_MS = 1000
const FIRST_MESSAGE_REFRESH_DELAY_MS = 2000

function buildChips(cls: ClassInfo): SessionContextChip[] {
  return [
    { key: 'class', label: cls.name, active: true },
    { key: 'subject', label: cls.subject },
    { key: 'school', label: cls.school },
  ]
}

function buildSuggestions(cls: ClassInfo): QuickSuggestion[] {
  const grade = cls.grade === '7' ? '七' : cls.grade === '8' ? '八' : '九'
  return [
    { label: '备课', prompt: `帮我为${cls.name}备一节${grade}年级${cls.subject}新授课`, category: 'teach', score: 10 },
    { label: '出题', prompt: `为${cls.name}出一套${cls.subject}随堂测试题`, category: 'quiz', score: 8 },
    { label: '学情分析', prompt: `分析${cls.name}${cls.subject}学情`, category: 'analysis', score: 6 },
    { label: '本周学情', prompt: `查看${cls.name}本周${cls.subject}学习情况`, category: 'analysis', score: 4 },
  ]
}

function App() {
  const auth = useEduAuth()
  const [selectedClass, setSelectedClass] = useState<ClassInfo>(DEFAULT_CLASS)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(
    () => `conv_${crypto.randomUUID()}`
  )

  const { sessions, refresh } = useSessionList(SERVER_URL, auth.ccaasApiKey ?? undefined)

  const apiKeyHint = useMemo(() => {
    if (!auth.ccaasApiKey) return undefined
    const key = auth.ccaasApiKey
    if (key.length <= 6) return `sk-...${key.slice(-2)}`
    return `sk-...${key.slice(-4)}`
  }, [auth.ccaasApiKey])

  const contextChips = useMemo(() => buildChips(selectedClass), [selectedClass])
  const quickSuggestions = useMemo(() => buildSuggestions(selectedClass), [selectedClass])

  const handleClassSwitch = useCallback((cls: ClassInfo) => {
    setSelectedClass(cls)
    const freshId = `conv_${crypto.randomUUID()}`
    setSessionId(freshId)
    setTimeout(() => refresh(), SESSION_REFRESH_DELAY_MS)
  }, [refresh])

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

  // Not authenticated → show login page
  if (!auth.token) {
    return (
      <LoginPage
        onLogin={auth.login}
        onRegister={auth.register}
        isLoading={auth.isLoading}
        error={auth.error}
      />
    )
  }

  const chatKey = `${selectedClass.id}-${sessionId ?? 'new'}`

  return (
    <div className="h-dvh flex">
      <ChatSidebar
        sessions={sessions}
        currentSessionId={sessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        onLogout={auth.logout}
        apiKeyHint={apiKeyHint}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <ChatInterface
          key={chatKey}
          serverUrl={SERVER_URL}
          tenantId={TENANT_ID}
          sessionTemplate="lesson-planning"
          contextChips={contextChips}
          quickSuggestions={quickSuggestions}
          sessionContext={{ classId: selectedClass.id, grade: selectedClass.grade, subject: selectedClass.subject }}
          apiKey={auth.ccaasApiKey ?? undefined}
          sessionId={sessionId}
          onMenuClick={() => setMobileSidebarOpen(true)}
          onMessageSent={handleMessageSent}
          contextBarTrailing={
            <ClassSwitcher
              classes={MOCK_CLASSES}
              selected={selectedClass}
              onSelect={handleClassSwitch}
            />
          }
        />
      </div>
    </div>
  )
}

export default App
