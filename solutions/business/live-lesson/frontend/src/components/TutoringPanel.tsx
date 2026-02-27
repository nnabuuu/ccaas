import { useState, useEffect } from 'react'
import { X } from '@phosphor-icons/react'
import type { Message } from '@kedge-agentic/react-sdk'
import type { Beat, BeatState } from '../types'
import type { TimelineItem } from '../types/blackboard-actions'
import type { TutoringMode, SelectionMode } from '../hooks/useLiveLesson'
import TranscriptPanel from './TranscriptPanel'
import TutoringChatbox from './TutoringChatbox'

interface TutoringPanelProps {
  open: boolean
  onClose: () => void
  // TranscriptPanel props
  timeline: TimelineItem[]
  beatState: BeatState | null
  canContinue: boolean
  onContinue: () => void
  isActive: boolean
  // TutoringChatbox props
  tutoringMode: TutoringMode
  currentBeat: Beat | null
  suggestedQuestions: string[]
  selectionMode: SelectionMode
  messages: Message[]
  isProcessing: boolean
  isThinking: boolean
  thinkingContent: string
  currentStreamContent: string
  connected: boolean
  onRaiseHand: () => void
  onDismissTutoring: () => void
  onSendExplainRequest: (q: string) => void
  onSendFollowUp: (text: string) => void
  onRequestMoreQuestions: () => void
  canAdvanceBeat: boolean
  onContinueLearning: () => void
}

export function TutoringPanel({
  open,
  onClose,
  timeline,
  beatState,
  canContinue,
  onContinue,
  isActive: _isActive,
  tutoringMode,
  currentBeat,
  suggestedQuestions,
  selectionMode,
  messages,
  isProcessing,
  isThinking,
  thinkingContent,
  currentStreamContent,
  connected,
  onRaiseHand,
  onDismissTutoring,
  onSendExplainRequest,
  onSendFollowUp,
  onRequestMoreQuestions,
  canAdvanceBeat,
  onContinueLearning,
}: TutoringPanelProps) {
  // Track whether component should be mounted in DOM
  const [mounted, setMounted] = useState(open)
  // Track animation state (separate from open, to allow exit animation)
  const [visible, setVisible] = useState(open)

  useEffect(() => {
    if (open) {
      // Mount immediately, then trigger enter animation on next frame
      setMounted(true)
      requestAnimationFrame(() => setVisible(true))
    } else {
      // Start exit animation, unmount after transition
      setVisible(false)
      const timer = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(timer)
    }
  }, [open])

  if (!mounted) return null

  return (
    <>
      {/* Backdrop overlay to dim blackboard */}
      <div
        className={[
          'absolute inset-0 bg-black/40 transition-opacity duration-300 z-10',
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
      />

      {/* Sliding panel */}
      <div
        className={[
          'absolute bottom-0 left-0 right-0 z-20',
          'flex flex-col',
          'bg-surface-1 border-t border-white/[0.08] rounded-t-xl',
          'transition-transform duration-300 ease-out',
          visible ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
        style={{ height: '45vh' }}
      >
        {/* Panel header with close button */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] flex-shrink-0">
          <span className="text-xs text-text-secondary">辅导模式</span>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-white/[0.05] transition-colors"
          >
            <X size={14} weight="regular" />
          </button>
        </div>

        {/* Two-column content */}
        <div className="flex flex-1 min-h-0">
          {/* Left: Transcript (55%) */}
          <div className="w-[55%] min-w-0 overflow-hidden border-r border-white/[0.06]">
            <TranscriptPanel
              timeline={timeline}
              beatState={beatState}
              canContinue={canContinue}
              onContinue={onContinue}
            />
          </div>

          {/* Right: Tutoring chat (45%) */}
          <div className="w-[45%] min-w-0 overflow-hidden">
            <TutoringChatbox
              tutoringMode={tutoringMode}
              currentBeat={currentBeat}
              suggestedQuestions={suggestedQuestions}
              selectionMode={selectionMode}
              messages={messages}
              isProcessing={isProcessing}
              isThinking={isThinking}
              thinkingContent={thinkingContent}
              currentStreamContent={currentStreamContent}
              connected={connected}
              onRaiseHand={onRaiseHand}
              onDismissTutoring={onDismissTutoring}
              onSendExplainRequest={onSendExplainRequest}
              onSendFollowUp={onSendFollowUp}
              onRequestMoreQuestions={onRequestMoreQuestions}
              canAdvanceBeat={canAdvanceBeat}
              onContinueLearning={onContinueLearning}
            />
          </div>
        </div>
      </div>
    </>
  )
}

export default TutoringPanel
