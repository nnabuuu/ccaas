/**
 * SimpleChatSection - Simplified chat interface without layout controls
 *
 * Uses @ccaas/react-sdk ChatPanel directly
 */

import { ChatPanel, type Message } from '@ccaas/react-sdk'
import type { ToolActivity, ActiveSubAgent } from '@ccaas/react-sdk'

interface SimpleChatSectionProps {
  messages: Message[]
  isProcessing: boolean
  isThinking: boolean
  thinkingContent: string
  onSendMessage: (content: string) => void
  activeTools: ToolActivity[]
  activeSubAgents: ActiveSubAgent[]
}

export default function SimpleChatSection({
  messages,
  isProcessing,
  isThinking,
  thinkingContent,
  onSendMessage,
  activeTools,
  activeSubAgents,
}: SimpleChatSectionProps) {
  // Convert activeTools array to Map for ChatPanel
  const activeToolsMap = new Map(activeTools.map(tool => [tool.toolId, tool]))

  return (
    <div className="h-full">
      <ChatPanel
        messages={messages}
        isProcessing={isProcessing}
        connected={true}
        activeTools={activeToolsMap}
        isThinking={isThinking}
        thinkingContent={thinkingContent}
        todoItems={[]}
        todoStats={{ total: 0, completed: 0, inProgress: 0, pending: 0 }}
        activeSubAgents={activeSubAgents}
        onSendMessage={onSendMessage}
        onCancel={() => {}}
        title="Quiz Analyzer AI"
        placeholder="问我任何关于题目的问题..."
      />
    </div>
  )
}
