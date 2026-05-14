import { useMemo, useCallback, useEffect } from 'react'
import { useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CaretLeft } from '@phosphor-icons/react'
import { useLiveLesson } from '../hooks/useLiveLesson'
import BeatCarousel from '../components/BeatCarousel'
import ProgressPills from '../components/ProgressPills'
import LessonDock from '../components/LessonDock'
import TutoringPanel from '../components/TutoringPanel'

interface LocationState {
  forceNew?: boolean
  lessonTitle?: string
}

export default function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionFromUrl = searchParams.get('session') ?? undefined
  const state = (location.state as LocationState) || {}
  const forceNew = state.forceNew ?? false
  const lessonTitle = state.lessonTitle ?? lessonId ?? ''

  const id = lessonId ?? ''

  const {
    connected,
    sessionId,
    boardState,
    manifest,
    beatState,
    dynamicBoardActions,
    globalBoardOps,
    timeline,
    currentBeat,
    messages: _messages,
    tutoringMessages,
    isProcessing,
    isThinking,
    thinkingContent,
    currentStreamContent,
    startLesson,
    advanceBeat,
    canAdvanceBeat,
    tutoringMode,
    beatSnapshots,
    viewingBeatIndex,
    viewingSectionId,
    captureBeatSnapshot,
    navigateToBeat,
    stickerActions,
    stickerVisible,
    stickerExpanded,
    dismissSticker,
    toggleStickerExpanded,
    collapseStickerFromBackdrop,
    hasDismissedSticker,
    restoreSticker,
    suggestedQuestions,
    selectionMode,
    raiseHand,
    dismissTutoring,
    sendExplainRequest,
    sendFollowUp,
    requestMoreQuestions,
    handleAnimationChange,
    tutoringPanelOpen,
    openTutoringPanel,
    closeTutoringPanel,
  } = useLiveLesson(id, forceNew, sessionFromUrl)

  // Write sessionId back to URL so the link is shareable/bookmarkable
  useEffect(() => {
    if (sessionId && id) {
      const currentSession = searchParams.get('session')
      if (currentSession !== sessionId) {
        const params = new URLSearchParams(searchParams)
        params.set('session', sessionId)
        navigate(`${location.pathname}?${params.toString()}`, { replace: true })
      }
    }
  }, [sessionId, id, searchParams, navigate, location.pathname])

  // handleContinue: advances to the next beat (used after lesson has started)
  const handleContinue = useCallback(() => {
    advanceBeat()
  }, [advanceBeat])

  // handleStart: first beat + start lesson
  const handleStart = useCallback(() => {
    advanceBeat()
    startLesson()
  }, [advanceBeat, startLesson])

  // handleRaiseHand: opens tutoring panel + enters picking mode
  const handleRaiseHand = useCallback(() => {
    raiseHand()
    openTutoringPanel()
  }, [raiseHand, openTutoringPanel])

  // handleDismissTutoring: closes panel + exits tutoring mode
  const handleDismissTutoring = useCallback(() => {
    dismissTutoring()
    closeTutoringPanel()
  }, [dismissTutoring, closeTutoringPanel])

  // handleContinueLearning: dismiss tutoring + close panel + auto-advance beat
  const handleContinueLearning = useCallback(() => {
    dismissTutoring()
    closeTutoringPanel()
    if (canAdvanceBeat && !isProcessing && !isThinking) {
      advanceBeat()
    }
  }, [dismissTutoring, closeTutoringPanel, canAdvanceBeat, isProcessing, isThinking, advanceBeat])

  // handleCloseTutoringPanel: X button / backdrop = full dismiss (not just hide)
  const handleCloseTutoringPanel = useCallback(() => {
    dismissTutoring()
    closeTutoringPanel()
  }, [dismissTutoring, closeTutoringPanel])

  // Compute revealedNodeIds from globalBoardOps
  const revealedNodeIds = useMemo(
    () => new Set(globalBoardOps.filter(op => op.op === 'reveal').map(op => op.nodeId)),
    [globalBoardOps],
  )

  if (!lessonId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0 text-text-primary">
        <p>课程未找到</p>
      </div>
    )
  }

  // Current narrator text for Dock
  const currentNarratorText = currentBeat?.narratorText ?? null

  // Whether to show "开始课程" (no beat state yet)
  const showStart = !beatState

  // Beat progress for Dock display
  const beatProgress = beatState && beatState.totalBeats > 0
    ? { current: beatState.currentBeatIndex + 1, total: beatState.totalBeats }
    : null

  return (
    <div className="min-h-screen h-screen flex flex-col bg-surface-0">
      {/* Header: back + title | progress pills | connection dot */}
      <header className="flex items-center justify-between px-5 py-2.5 bg-surface-0 border-b border-white/[0.04] flex-shrink-0 gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-text-tertiary hover:text-text-primary transition-colors"
          >
            <CaretLeft size={14} weight="regular" />
          </button>
          <span className="text-sm font-medium text-text-primary">{lessonTitle}</span>
        </div>

        {/* Center: Progress Pills */}
        <div className="flex-1 min-w-0 flex justify-center">
          <ProgressPills
            nodes={manifest?.globalBoardNodes ?? []}
            revealedNodeIds={revealedNodeIds}
            currentSectionId={viewingSectionId}
          />
        </div>

        {/* Right: connection dot */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {!beatState && boardState && (
            <span className="text-[11px] text-text-tertiary">{boardState.currentPhase}</span>
          )}
          <span
            className={[
              'w-1.5 h-1.5 rounded-full',
              connected ? 'bg-success' : 'bg-text-tertiary animate-pulse',
            ].join(' ')}
          />
        </div>
      </header>

      {/* Main: Blackboard fills remaining space */}
      <main className="flex-1 min-h-0 relative overflow-hidden">
        <div className="h-full max-w-[1400px] mx-auto">
          <BeatCarousel
            snapshots={beatSnapshots}
            activeActions={dynamicBoardActions}
            activeBeatId={beatState?.currentBeatId ?? null}
            activeBeatIndex={beatState?.currentBeatIndex ?? -1}
            isLoading={!manifest}
            onStart={handleStart}
            onAnimationChange={handleAnimationChange}
            onSnapshot={captureBeatSnapshot}
            paused={tutoringMode !== 'idle'}
            stickerActions={stickerActions}
            stickerVisible={stickerVisible}
            stickerExpanded={stickerExpanded}
            onDismissSticker={dismissSticker}
            onToggleStickerExpand={toggleStickerExpanded}
            onCollapseStickerBackdrop={collapseStickerFromBackdrop}
            hasDismissedSticker={hasDismissedSticker}
            onRestoreSticker={restoreSticker}
            viewingIndex={viewingBeatIndex}
            onNavigate={navigateToBeat}
          />
        </div>

        {/* Tutoring panel (absolute, slides up from bottom) */}
        <TutoringPanel
          open={tutoringPanelOpen}
          onClose={handleCloseTutoringPanel}
          timeline={timeline}
          beatState={beatState}
          canContinue={canAdvanceBeat}
          onContinue={handleContinue}
          isActive={isProcessing || isThinking}
          tutoringMode={tutoringMode}
          currentBeat={currentBeat}
          suggestedQuestions={suggestedQuestions}
          selectionMode={selectionMode}
          messages={tutoringMessages}
          isProcessing={isProcessing}
          isThinking={isThinking}
          thinkingContent={thinkingContent}
          currentStreamContent={currentStreamContent}
          connected={connected}
          onRaiseHand={handleRaiseHand}
          onDismissTutoring={handleDismissTutoring}
          onSendExplainRequest={sendExplainRequest}
          onSendFollowUp={sendFollowUp}
          onRequestMoreQuestions={requestMoreQuestions}
          canAdvanceBeat={canAdvanceBeat}
          onContinueLearning={handleContinueLearning}
        />
      </main>

      {/* Bottom Dock: narrator text + action buttons */}
      <LessonDock
        narratorText={currentNarratorText}
        canContinue={canAdvanceBeat}
        onContinue={handleContinue}
        onRaiseHand={handleRaiseHand}
        tutoringActive={tutoringMode !== 'idle'}
        onOpenTutoring={openTutoringPanel}
        showStart={showStart}
        onStart={handleStart}
        connected={connected}
        hasCurrentBeat={!!currentBeat}
        beatProgress={beatProgress}
      />
    </div>
  )
}
