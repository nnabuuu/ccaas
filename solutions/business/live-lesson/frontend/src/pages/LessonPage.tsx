import { useMemo } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useLiveLesson } from '../hooks/useLiveLesson'
import DynamicBoard from '../components/DynamicBoard'
import GlobalBoard from '../components/GlobalBoard'
import InteractionPanel from '../components/InteractionPanel'

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
    beatState,
    dynamicBoardActions,
    globalBoardOps,
    timeline,
    currentBeat,
    messages,
    isProcessing,
    isThinking,
    thinkingContent,
    currentStreamContent,
    sendMessage,
    clearConversation,
    advanceBeat,
    canAdvanceBeat,
  } = useLiveLesson(id, forceNew)

  // Compute revealedNodeIds from globalBoardOps
  const revealedNodeIds = useMemo(
    () => new Set(globalBoardOps.filter(op => op.op === 'reveal').map(op => op.nodeId)),
    [globalBoardOps],
  )

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
          {beatState && beatState.totalBeats > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">
              {beatState.currentBeatIndex + 1} / {beatState.totalBeats}
            </span>
          )}
          {!beatState && boardState && (
            <span className="ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">
              {boardState.currentPhase}
            </span>
          )}
        </div>
      </header>

      {/* Main content: 3-panel layout (25/50/25) */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left: GlobalBoard (25%) */}
        <div className="flex-[2.5] min-w-0 overflow-hidden border-r border-white/10" style={{ minWidth: '200px' }}>
          <GlobalBoard
            nodes={manifest?.globalBoardNodes ?? []}
            revealedNodeIds={revealedNodeIds}
            currentSectionId={beatState?.sectionId ?? null}
          />
        </div>

        {/* Center: DynamicBoard (50%) */}
        <div className="flex-[5] min-w-0 overflow-hidden">
          <DynamicBoard
            actions={dynamicBoardActions}
            beatId={beatState?.currentBeatId ?? null}
            isActive={isProcessing || isThinking}
            canContinue={canAdvanceBeat}
            isLoading={!manifest}
            onContinue={advanceBeat}
          />
        </div>

        {/* Right: InteractionPanel (25%) */}
        <div className="flex-[2.5] min-w-0 overflow-hidden" style={{ minWidth: '200px' }}>
          <InteractionPanel
            timeline={timeline}
            currentBeat={currentBeat}
            isActive={isProcessing || isThinking}
            connected={connected}
            messages={messages}
            isThinking={isThinking}
            thinkingContent={thinkingContent}
            currentStreamContent={currentStreamContent}
            onSendMessage={sendMessage}
            onClearConversation={clearConversation}
          />
        </div>
      </main>
    </div>
  )
}
