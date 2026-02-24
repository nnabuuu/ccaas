import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useLiveLesson } from '../hooks/useLiveLesson'
import DynamicBoard from '../components/DynamicBoard'
import TeachingPanel from '../components/TeachingPanel'

interface LocationState {
  forceNew?: boolean
  lessonTitle?: string
}

export default function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const state = (location.state as LocationState) || {}
  const forceNew = state.forceNew ?? false
  const lessonTitle = state.lessonTitle ?? lessonId ?? ''

  const id = lessonId ?? ''

  const {
    connected,
    boardState,
    manifest,
    messages,
    isProcessing,
    isThinking,
    thinkingContent,
    currentStreamContent,
    sendMessage,
    clearConversation,
    sendConfused,
    sendProbeSelected,
  } = useLiveLesson(id, forceNew)

  if (!lessonId) {
    return (
      <div className="h-screen flex items-center justify-center bg-background-dark text-white">
        <p>课程未找到</p>
      </div>
    )
  }

  return (
    <div
      className="h-screen flex flex-col bg-background-dark font-lexend"
      style={{ fontFamily: "'Lexend', sans-serif" }}
    >
      {/* Header bar */}
      <header className="flex items-center justify-between px-5 py-2.5 bg-background-dark border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            ← 课程列表
          </button>
          <div className="h-4 w-px bg-white/20" />
          <div className="text-primary text-lg font-bold tracking-tight">即见·动态教学</div>
          <div className="h-4 w-px bg-white/20" />
          <span className="text-sm text-gray-400">{lessonTitle}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {connected ? (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              已连接
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" />
              连接中...
            </span>
          )}
          {boardState && (
            <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">
              {boardState.currentPhase}
            </span>
          )}
        </div>
      </header>

      {/* Main content: 70/30 split */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: Dynamic Board (70%) */}
        <div className="flex-[7] min-w-0 overflow-hidden">
          <DynamicBoard
            boardState={boardState}
            manifest={manifest}
            onConfused={sendConfused}
          />
        </div>

        {/* Right: Teaching Panel (30%) */}
        <div className="flex-[3] min-w-0 overflow-hidden" style={{ minWidth: '280px', maxWidth: '400px' }}>
          <TeachingPanel
            messages={messages}
            isProcessing={isProcessing}
            isThinking={isThinking}
            thinkingContent={thinkingContent}
            currentStreamContent={currentStreamContent}
            boardState={boardState}
            connected={connected}
            onSendMessage={sendMessage}
            onProbeSelected={sendProbeSelected}
            onConfused={sendConfused}
            onClearConversation={clearConversation}
          />
        </div>
      </main>
    </div>
  )
}
