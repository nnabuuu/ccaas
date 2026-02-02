import { SessionProvider, useSessionContext } from './context/SessionContext'
import { NavigationHandler } from './context/NavigationHandler'
import { AppHeader } from './components/shared/AppHeader'
import { ChatPanel } from './components/shared/ChatPanel'
import { StatusBar } from './components/shared/StatusBar'
import { HomeView } from './routes/HomeView'
import { LessonPlanView } from './routes/LessonPlanView'
import { ProblemExplainView } from './routes/ProblemExplainView'

function AppContent() {
  const { activeTab } = useSessionContext()

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <NavigationHandler />
      <AppHeader />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: functional area */}
        <main className="flex-1 flex overflow-hidden">
          {activeTab === 'home' && <HomeView />}
          {activeTab === 'lesson-plan' && <LessonPlanView />}
          {activeTab === 'problem-explain' && <ProblemExplainView />}
        </main>

        {/* Right: Chat panel — always visible */}
        <aside className="w-96 border-l border-border shrink-0">
          <ChatPanel placeholder="输入消息..." />
        </aside>
      </div>

      <StatusBar />
    </div>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  )
}
