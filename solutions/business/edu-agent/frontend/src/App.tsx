import { SessionProvider, useSessionContext } from './context/SessionContext'
import { NavigationHandler } from './context/NavigationHandler'
import { AppHeader } from './components/shared/AppHeader'
import { ChatPanel } from './components/shared/ChatPanel'
import { StatusBar } from './components/shared/StatusBar'
import { HomeView } from './routes/HomeView'
import { LessonPlanView } from './routes/LessonPlanView'
import { ProblemExplainView } from './routes/ProblemExplainView'
import { AnimatePresence, motion } from 'framer-motion'

function AppContent() {
  const { activeTab } = useSessionContext()

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <NavigationHandler />
      <AppHeader />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: functional area */}
        <main className="flex-1 flex overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              className="flex-1 flex overflow-hidden"
            >
              {activeTab === 'home' && <HomeView />}
              {activeTab === 'lesson-plan' && <LessonPlanView />}
              {activeTab === 'problem-explain' && <ProblemExplainView />}
            </motion.div>
          </AnimatePresence>
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
