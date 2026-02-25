import { useMemo, useCallback } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { CaretLeft } from '@phosphor-icons/react'
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
    startLesson,
    advanceBeat,
    canAdvanceBeat,
  } = useLiveLesson(id, forceNew)

  // handleContinue: drives the unified "开始课程" / "继续 →" button.
  // Always advances the beat (from manifest); on the very first click also
  // fires '开始上课' to the AI to start the session.
  const handleContinue = useCallback(() => {
    advanceBeat()
    if (!beatState) {
      startLesson()
    }
  }, [advanceBeat, startLesson, beatState])

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
            className="flex items-center gap-1 text-gray-500 hover:text-gray-200 transition-colors duration-[200ms]"
          >
            <CaretLeft size={14} weight="regular" />
            <span className="text-xs">课程列表</span>
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

      {/* Main content: 3-panel layout, left-biased */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-[minmax(180px,1fr)_2fr_minmax(200px,1fr)] overflow-hidden">
        {/* Left: GlobalBoard */}
        <div className="min-w-0 overflow-hidden border-r border-white/10 hidden md:block">
          <GlobalBoard
            nodes={manifest?.globalBoardNodes ?? []}
            revealedNodeIds={revealedNodeIds}
            currentSectionId={beatState?.sectionId ?? null}
          />
        </div>

        {/* Center: DynamicBoard */}
        <div className="min-w-0 overflow-hidden">
          <DynamicBoard
            actions={dynamicBoardActions}
            beatId={beatState?.currentBeatId ?? null}
            isActive={isProcessing || isThinking}
            canContinue={canAdvanceBeat}
            isLoading={!manifest}
            onContinue={handleContinue}
          />
        </div>

        {/* Right: InteractionPanel */}
        <div className="min-w-0 overflow-hidden">
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
            canContinue={canAdvanceBeat && !isProcessing && !isThinking}
            onContinue={handleContinue}
          />
        </div>
      </main>
    </div>
  )
}
