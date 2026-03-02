import React, { useState, useEffect, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Header } from './components/Header'
import { ChatPanel } from './components/ChatPanel'
import { FarmerProfilePanel } from './components/FarmerProfilePanel'
import { CreditReportPanel } from './components/CreditReportPanel'
import { SessionDrawer } from './components/SessionDrawer'
import { PolicyDocumentPage } from './pages/PolicyDocumentPage'
import { useAgriSession } from './hooks/useAgriSession'
import { useSessionHistory } from './hooks/useSessionHistory'
import type { ViewMode } from './types'

function MainLayout() {
  const [viewMode, setViewMode] = useState<ViewMode>('farmer')
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const sessionHistory = useSessionHistory()

  // key-based remount: changing this forces all hooks to re-initialize
  const sessionKey = activeSessionId || `new-${viewMode}`
  const session = useAgriSession(viewMode, activeSessionId)

  // Track session in history when user sends first message
  const trackedRef = useRef<string | null>(null)
  useEffect(() => {
    const sid = session.sessionId
    if (!sid || session.messages.length === 0) return
    // Only track once per session, or update message count
    if (trackedRef.current !== sid || session.messages.length > 1) {
      trackedRef.current = sid
      const userMsgs = session.messages.filter(m => m.role === 'user')
      if (userMsgs.length > 0) {
        sessionHistory.trackSession({
          sessionId: sid,
          createdAt: Date.now(),
          viewMode,
          preview: userMsgs[0].content.slice(0, 50),
          messageCount: session.messages.length,
        })
      }
    }
  }, [session.sessionId, session.messages.length, viewMode])

  // Clear session when view mode changes
  const handleViewChange = (mode: ViewMode) => {
    if (mode !== viewMode) {
      setActiveSessionId(undefined)
      setViewMode(mode)
    }
  }

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId)
  }

  const handleNewSession = () => {
    setActiveSessionId(undefined)
  }

  const isFarmer = viewMode === 'farmer'

  return (
    <div className="h-screen flex flex-col">
      <Header
        viewMode={viewMode}
        onViewChange={handleViewChange}
        connected={session.connected}
        onOpenHistory={() => setDrawerOpen(true)}
      />

      <SessionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        history={sessionHistory.history}
        viewMode={viewMode}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
      />

      <div className="flex-1 flex overflow-hidden transition-colors duration-500" key={sessionKey}>
        {/* Chat Panel - 40% */}
        <div className="w-[40%] border-r border-gray-200 shadow-[2px_0_8px_-4px_rgba(0,0,0,0.08)] flex flex-col">
          <ChatPanel
            messages={session.messages}
            isProcessing={session.isProcessing}
            currentStreamContent={session.currentStreamContent}
            onSendMessage={session.sendMessage}
            activeTools={session.activeTools}
            isThinking={session.isThinking}
            thinkingContent={session.thinkingContent}
            viewMode={viewMode}
          />
        </div>

        {/* Right Panel - 60% */}
        <div className={`w-[60%] transition-colors duration-500 ${
          isFarmer
            ? 'bg-gradient-to-b from-agri-green-50/50 to-gray-50'
            : 'bg-gradient-to-b from-bank-blue-50/50 to-gray-50'
        }`}>
          {isFarmer ? (
            <FarmerProfilePanel
              displayData={session.displayData}
              isProcessing={session.isProcessing}
            />
          ) : (
            <CreditReportPanel
              displayData={session.displayData}
              isProcessing={session.isProcessing}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />} />
      <Route path="/policy/:id" element={<PolicyDocumentPage />} />
    </Routes>
  )
}

export default App
