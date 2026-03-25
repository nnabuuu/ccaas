import { useEduSession } from './hooks/useEduSession'
import { Header } from './components/Header'
import { ChatPanel } from './components/ChatPanel'
import { LessonPlanPanel } from './components/LessonPlanPanel'

function App() {
  const session = useEduSession()

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header connected={session.connected} />
      <div className="flex-1 flex overflow-hidden">
        <div className="w-[40%] border-r border-gray-200">
          <ChatPanel
            messages={session.messages}
            isProcessing={session.isProcessing}
            currentStreamContent={session.currentStreamContent}
            sendMessage={session.sendMessage}
          />
        </div>
        <div className="w-[60%]">
          <LessonPlanPanel
            displayData={session.displayData}
            isProcessing={session.isProcessing}
          />
        </div>
      </div>
    </div>
  )
}

export default App
