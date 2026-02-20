/**
 * SimpleChatSection - Simplified chat interface without layout controls
 *
 * Uses @kedge-agentic/react-sdk ChatPanel directly
 */

import { ChatPanel, type Message, type TodoItem, type TodoStats } from '@kedge-agentic/react-sdk'
import type { ToolActivity, ActiveSubAgent } from '@kedge-agentic/react-sdk'

interface SimpleChatSectionProps {
  messages: Message[]
  isProcessing: boolean
  isThinking: boolean
  thinkingContent: string
  onSendMessage: (content: string) => void
  activeTools: Map<string, ToolActivity>
  activeSubAgents: ActiveSubAgent[]
  todoItems: TodoItem[]
  todoStats: TodoStats | null
}

export default function SimpleChatSection({
  messages,
  isProcessing,
  isThinking,
  thinkingContent,
  onSendMessage,
  activeTools,
  activeSubAgents,
  todoItems,
  todoStats,
}: SimpleChatSectionProps) {
  return (
    <div className="h-full">
      <ChatPanel
        messages={messages}
        isProcessing={isProcessing}
        connected={true}
        activeTools={activeTools}
        isThinking={isThinking}
        thinkingContent={thinkingContent}
        todoItems={todoItems}
        todoStats={todoStats}
        activeSubAgents={activeSubAgents}
        onSendMessage={onSendMessage}
        onCancel={() => {}}
        title="Quiz Analyzer AI"
        placeholder="问我任何关于题目的问题..."
      />
    </div>
  )
}
