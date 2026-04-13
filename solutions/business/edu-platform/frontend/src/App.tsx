import { useState, useMemo, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import {
  ChatInterface,
  ChatSidebar,
  useSessionList,
  useChatCore,
} from '@kedge-agentic/chat-interface'
import type { SidebarSkillItem } from '@kedge-agentic/chat-interface'
import { customWidgets, customCatalog } from './widget-registry'
import type { ToolRendererMap } from '@kedge-agentic/chat-interface'
import { askUserQuestionRenderer, AuqTestHarness } from './components/AskUserQuestionRenderer'
import './wizards/lesson-plan.wizard'
import { LoginPage } from './components/LoginPage'
import { EduEmptyState } from './components/EduEmptyState'
import { DEFAULT_CLASS } from './data/mock-classes'
import type { ClassInfo } from './data/mock-classes'
import { SERVER_URL, TENANT_ID } from './config'
import { useEduAuth } from './hooks/useEduAuth'
import type { EduAuth } from './hooks/useEduAuth'
import { Sidebar } from './components/layout/Sidebar'
import { TopNav } from './components/layout/TopNav'
import { HomePage } from './pages/HomePage'

const customToolRenderers: ToolRendererMap = {
  AskUserQuestion: askUserQuestionRenderer,
}

const SESSION_REFRESH_DELAY_MS = 1000
const FIRST_MESSAGE_REFRESH_DELAY_MS = 2000

const SIDEBAR_SKILLS: SidebarSkillItem[] = [
  { name: '备课助手', iconText: '备', type: 'solution' },
  { name: '出题组卷', iconText: '题', type: 'solution' },
  { name: '学情分析', iconText: '情', type: 'solution' },
  { name: '错题本生成器', iconText: '错', type: 'custom' },
]

/** Wrapper that hooks into ChatCoreContext to provide sendMessage to EduEmptyState */
function EduEmptyStateConnected({ teacherName, selectedClass }: { teacherName: string; selectedClass: ClassInfo }) {
  const { handleAction } = useChatCore()
  const handleSend = useCallback((prompt: string) => {
    handleAction({ label: prompt, prompt })
  }, [handleAction])

  return (
    <EduEmptyState
      teacherName={teacherName}
      selectedClass={selectedClass}
      onSend={handleSend}
    />
  )
}

function App() {
  const auth = useEduAuth()

  // Test mode: render AskUserQuestion component standalone (no backend needed)
  if (import.meta.env.DEV && window.location.search.includes('test=auq')) {
    return <AuqTestHarness />
  }

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

  return <AuthenticatedApp auth={auth} />
}

function AuthenticatedApp({ auth }: { auth: EduAuth }) {
  return (
    <>
      <Sidebar />
      <TopNav />
      <Routes>
        <Route path="/" element={<PageWrapper><HomePage /></PageWrapper>} />
        <Route path="/chat" element={<ChatPage auth={auth} />} />
        <Route path="/lesson-plans" element={<PageWrapper><PlaceholderPage title="教案" /></PageWrapper>} />
        <Route path="/templates" element={<PageWrapper><PlaceholderPage title="模板" /></PageWrapper>} />
      </Routes>
    </>
  )
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="main-content">
        {children}
      </div>
      <style>{`
        .main-content {
          margin-left: 0;
          padding: 32px 24px 80px;
          background: var(--bg);
          min-height: 100vh;
        }
        @media (min-width: 1200px) {
          .main-content {
            margin-left: var(--sidebar-w);
            padding: 32px 48px 80px;
          }
        }
      `}</style>
    </>
  )
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div style={{ maxWidth: '800px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--t1)', marginBottom: '8px' }}>
        {title}
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--t3)' }}>即将推出</p>
    </div>
  )
}

function ChatPage({ auth }: { auth: EduAuth }) {
  const [selectedClass] = useState<ClassInfo>(DEFAULT_CLASS)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [skillPanelOpen, setSkillPanelOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(
    () => `conv_${crypto.randomUUID()}`
  )

  const { sessions, refresh } = useSessionList(SERVER_URL, auth.ccaasApiKey!, TENANT_ID)

  const _apiKeyHint = useMemo(() => {
    if (!auth.ccaasApiKey) return undefined
    const key = auth.ccaasApiKey
    if (key.length <= 6) return `sk-...${key.slice(-2)}`
    return `sk-...${key.slice(-4)}`
  }, [auth.ccaasApiKey])

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
  const teacherName = auth.user?.name ?? '老师'

  return (
    <div className="chat-page">
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
        apiKeyHint={teacherName}
        onSkillsClick={() => setSkillPanelOpen(true)}
        productName="即见教育"
        locale="zh"
        skills={SIDEBAR_SKILLS}
        userRole={`${selectedClass.subject}教师 · ${selectedClass.school}`}
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
          sessionContext={{ classId: selectedClass.id, grade: selectedClass.grade, subject: selectedClass.subject }}
          apiKey={auth.ccaasApiKey ?? undefined}
          sessionId={sessionId}
          onMenuClick={() => setMobileSidebarOpen(true)}
          onMessageSent={handleMessageSent}
          skillPanelOpen={skillPanelOpen}
          onSkillPanelChange={setSkillPanelOpen}
          hideSkillToggle
          emptyState={<EduEmptyStateConnected teacherName={teacherName} selectedClass={selectedClass} />}
          disclaimer={null}
          composerPlaceholder="描述你的需求..."
          customWidgets={customWidgets}
          customCatalog={customCatalog}
          customToolRenderers={customToolRenderers}
        />
      </div>

      <style>{`
        .chat-page {
          height: 100dvh;
          display: flex;
        }
      `}</style>
    </div>
  )
}

export default App
