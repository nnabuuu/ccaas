import { useState, useMemo, useCallback } from 'react'
import {
  ChatInterface,
  ChatSidebar,
  useSessionList,
} from '@kedge-agentic/chat-interface'
import { customWidgets, customCatalog } from './widget-registry'
import { LoginPage } from './components/LoginPage'
import { DEFAULT_CLASS } from './data/mock-classes'
import type { ClassInfo } from './data/mock-classes'
import { SERVER_URL, TENANT_ID } from './config'
import { useEduAuth } from './hooks/useEduAuth'
import type { EduAuth } from './hooks/useEduAuth'

const SESSION_REFRESH_DELAY_MS = 1000
const FIRST_MESSAGE_REFRESH_DELAY_MS = 2000

function buildSuggestions(cls: ClassInfo) {
  const grade = cls.grade === '7' ? '七' : cls.grade === '8' ? '八' : '九'
  return [
    { label: '备课', prompt: `帮我为${cls.name}备一节${grade}年级${cls.subject}新授课`, category: 'teach', score: 10, groupTitle: '常用操作' },
    { label: '出题', prompt: `为${cls.name}出一套${cls.subject}随堂测试题`, category: 'quiz', score: 8 },
    { label: '学情分析', prompt: `分析${cls.name}${cls.subject}学情`, category: 'analysis', score: 6, groupTitle: '学情分析' },
    { label: '本周学情', prompt: `查看${cls.name}本周${cls.subject}学习情况`, category: 'analysis', score: 4 },
  ]
}

function App() {
  const auth = useEduAuth()

  if (auth.validating) return null

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

  return <AppShell auth={auth} />
}

function AppShell({ auth }: { auth: EduAuth }) {
  const [selectedClass] = useState<ClassInfo>(DEFAULT_CLASS)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [skillPanelOpen, setSkillPanelOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(
    () => `conv_${crypto.randomUUID()}`
  )

  const { sessions, refresh } = useSessionList(SERVER_URL, auth.ccaasApiKey!, TENANT_ID)

  const apiKeyHint = useMemo(() => {
    if (!auth.ccaasApiKey) return undefined
    const key = auth.ccaasApiKey
    if (key.length <= 6) return `sk-...${key.slice(-2)}`
    return `sk-...${key.slice(-4)}`
  }, [auth.ccaasApiKey])

  const quickSuggestions = useMemo(() => buildSuggestions(selectedClass), [selectedClass])

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
        apiKeyHint={auth.user?.name ?? apiKeyHint}
        onSkillsClick={() => setSkillPanelOpen(true)}
        userContext={
          <div className="flex flex-wrap gap-1 px-3 pb-2">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--info-bg)] text-[var(--info-t)]">
              {selectedClass.name}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full text-[var(--t3)] border border-[var(--b1)]">
              {selectedClass.subject}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full text-[var(--t3)] border border-[var(--b1)]">
              {selectedClass.school}
            </span>
          </div>
        }
        skillsActive={skillPanelOpen}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <ChatInterface
          key={chatKey}
          serverUrl={SERVER_URL}
          tenantId={TENANT_ID}
          sessionTemplate="lesson-planning"
          quickSuggestions={quickSuggestions}
          sessionContext={{ classId: selectedClass.id, grade: selectedClass.grade, subject: selectedClass.subject }}
          apiKey={auth.ccaasApiKey ?? undefined}
          sessionId={sessionId}
          onMenuClick={() => setMobileSidebarOpen(true)}
          onMessageSent={handleMessageSent}
          skillPanelOpen={skillPanelOpen}
          onSkillPanelChange={setSkillPanelOpen}
          hideSkillToggle
          emptyState={null}
          disclaimer={null}
          composerPlaceholder="输入你的需求，或点击上方快捷操作..."
          customWidgets={customWidgets}
          customCatalog={customCatalog}
        />
      </div>
    </div>
  )
}

export default App
