import { ChatPanel } from '@kedge-agentic/react-sdk'
import ChatLayoutControls from './ChatLayoutControls'
import type { ChatLayoutMode } from '../hooks/useChatLayout'
import type { UseQuizSessionReturn } from '../hooks/useQuizSession'

interface ChatSectionProps {
  mode: ChatLayoutMode
  isCollapsed: boolean
  onModeChange: (mode: ChatLayoutMode) => void
  onToggleCollapse: () => void
  session: UseQuizSessionReturn
}

export default function ChatSection({
  mode,
  isCollapsed,
  onModeChange,
  onToggleCollapse,
  session,
}: ChatSectionProps) {
  return (
    <div className="flex flex-col h-full bg-ck-bg1">
      {/* Layout controls */}
      <ChatLayoutControls
        mode={mode}
        isCollapsed={isCollapsed}
        onModeChange={onModeChange}
        onToggleCollapse={onToggleCollapse}
      />

      {/* ChatPanel */}
      <div className="flex-1 overflow-hidden">
        <ChatPanel
          messages={session.messages}
          isProcessing={session.isProcessing}
          connected={session.connected}
          activeTools={session.activeTools}
          isThinking={session.isThinking}
          thinkingContent={session.thinkingContent}
          todoItems={session.todoItems}
          todoStats={session.todoStats}
          activeSubAgents={session.activeSubAgents}
          onSendMessage={session.sendMessage}
          onCancel={session.cancelProcessing}
          title="Quiz Analyzer AI"
          placeholder="问我任何关于题目的问题..."
        />
      </div>

      {/* Token statistics bar */}
      {session.tokenUsage && (
        <div className="px-4 py-1.5 bg-ck-bg2 border-t border-ck-b1 text-xs text-ck-t2 flex-shrink-0">
          <span className="font-medium">Tokens:</span>{' '}
          {session.tokenUsage.inputTokens.toLocaleString()} in /{' '}
          {session.tokenUsage.outputTokens.toLocaleString()} out
        </div>
      )}
    </div>
  )
}
