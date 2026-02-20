import { useState, useRef, useEffect } from 'react'
import {
  AgentActivityLine,
  useTaskTracking,
  TasksView,
  useMessageSplitter,
  AssistantMessageGroup,
  type ToolActivity,
  type UseAgentConnectionReturn,
  type FileMetadata,
  type TokenUsage,
} from '@kedge-agentic/react-sdk'
import type { Message, SyncField, TodoItem, TodoStats, ActiveSubAgent, TabType, MessageTokenUsage, PendingUpdateWithMeta } from '../types'
import MessageBubble from './MessageBubble'
import { SegmentBubble } from './SegmentBubble'
import QuickPrompts from './QuickPrompts'
import FilesView from './FilesView'
import { useFileAttachment } from '../hooks/useFileAttachment'
import { GlobalSyncSection } from './sync/GlobalSyncSection'
import { MessageSquare, File, CheckSquare, RotateCcw } from 'lucide-react'

// Helper functions for custom token usage rendering
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatModelName(model: string): string {
  return model.replace('claude-', '').replace(/-\d+$/, '')
}

function CustomTokenUsageFooter({ usage }: { usage: MessageTokenUsage }) {
  const cacheTokens = usage.cacheReadTokens ?? usage.cachedInputTokens ?? 0
  return (
    <div className="mt-1.5 pt-1.5 border-t border-gray-200/60 flex items-center gap-3 text-[11px] text-gray-400">
      {usage.model && <span>{formatModelName(usage.model)}</span>}
      <span>{'\u2193'}{formatTokens(usage.inputTokens)} {'\u2191'}{formatTokens(usage.outputTokens)}</span>
      {cacheTokens > 0 && (
        <span>{'\u26A1'}{formatTokens(cacheTokens)} cached</span>
      )}
      {usage.estimatedCostUsd !== undefined && (
        <span>${usage.estimatedCostUsd.toFixed(4)}</span>
      )}
    </div>
  )
}

interface ChatPanelProps {
  messages: Message[]
  isProcessing: boolean
  isMainProcessing?: boolean
  isLoadingHistory?: boolean
  hasActiveSubAgents?: boolean
  connected: boolean
  connection?: UseAgentConnectionReturn
  activeTools?: Map<string, ToolActivity>
  isThinking?: boolean
  thinkingContent?: string
  thinkingStartTime?: number | null
  thinkingVerb?: string
  todoItems?: TodoItem[]
  todoStats?: TodoStats | null
  activeSubAgents?: ActiveSubAgent[]
  tokenUsage?: TokenUsage | null
  pendingUpdates?: Map<SyncField, { field: SyncField; value: unknown; preview: string; synced?: boolean; syncedAt?: Date }>
  pendingUpdatesWithMeta?: Map<SyncField, PendingUpdateWithMeta>
  modifiedFields?: Set<SyncField>
  newFilesCount?: number
  sessionId?: string
  lessonPlanId?: string
  onSendMessage: (content: string) => void
  onSync: (field: SyncField) => void
  onSyncAll?: () => Promise<void>
  onDiscard: (field: SyncField) => void
  onCancel?: () => void
  onClearConversation?: () => void
}

export function ChatPanel({
  messages,
  isProcessing,
  isMainProcessing,
  isLoadingHistory = false,
  connected,
  connection,
  activeTools = new Map(),
  isThinking = false,
  thinkingContent = '',
  thinkingStartTime,
  thinkingVerb,
  todoItems = [],
  todoStats = null,
  activeSubAgents = [],
  tokenUsage = null,
  pendingUpdates,
  pendingUpdatesWithMeta,
  modifiedFields,
  newFilesCount = 0,
  sessionId,
  lessonPlanId,
  onSendMessage,
  onSync,
  onSyncAll,
  onDiscard,
  onCancel,
  onClearConversation,
}: ChatPanelProps) {
  // 向后兼容：如果没有提供 isMainProcessing，使用 isProcessing
  const mainProcessing = isMainProcessing ?? isProcessing
  const [inputValue, setInputValue] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('messages')
  const [highlightedTaskId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Split messages for improved UX
  const { splitMessages } = useMessageSplitter({ messages })

  // Track tasks
  const taskTracking = useTaskTracking({
    activeSubAgents,
    todoItems,
  })

  // File attachment handler - only available when lessonPlanId exists
  const { attachFile } = useFileAttachment(lessonPlanId || '')

  const handleAttachFile = async (file: FileMetadata) => {
    if (!lessonPlanId) {
      console.warn('Cannot attach file: no lesson plan selected')
      return { success: false }
    }

    const result = await attachFile(file)
    return { success: result.success }
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!inputValue.trim() || mainProcessing || !connected) return

    onSendMessage(inputValue.trim())
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleQuickPrompt = (prompt: string) => {
    if (mainProcessing || !connected) return
    onSendMessage(prompt)
  }

  // Calculate unread message count (messages added in last 5 seconds)
  // Only show badge when user is NOT on messages tab (UX best practice)
  const newMessagesCount = activeTab !== 'messages'
    ? messages.filter(m => {
        if (!m.timestamp) return false
        const messageAge = Date.now() - new Date(m.timestamp).getTime()
        return messageAge < 5000 && m.role === 'assistant'
      }).length
    : 0

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <h2 className="font-semibold text-gray-800">AI 备课助手</h2>
        <div className="flex items-center gap-2">
          {tokenUsage && (
            <span className="text-xs text-gray-500">
              Tokens: {tokenUsage.inputTokens.toLocaleString()} in / {tokenUsage.outputTokens.toLocaleString()} out
            </span>
          )}
          {onClearConversation && (
            <button
              onClick={onClearConversation}
              disabled={mainProcessing}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="新对话"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Icon Tab Bar */}
      <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
        <button
          onClick={() => setActiveTab('messages')}
          className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors relative ${
            activeTab === 'messages'
              ? 'text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          title="消息"
        >
          <MessageSquare className="w-5 h-5" />
          <span>消息</span>
          {newMessagesCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
              {newMessagesCount}
            </span>
          )}
          {activeTab === 'messages' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors relative ${
            activeTab === 'files'
              ? 'text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          title="文件"
        >
          <File className="w-5 h-5" />
          <span>文件</span>
          {newFilesCount > 0 && activeTab !== 'files' && (
            <span className="px-2 py-0.5 text-xs bg-amber-500 text-white rounded-full">
              {newFilesCount}
            </span>
          )}
          {activeTab === 'files' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors relative ${
            activeTab === 'tasks'
              ? 'text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          title="任务"
        >
          <CheckSquare className="w-5 h-5" />
          <span>任务</span>
          {taskTracking.badgeState.show && activeTab !== 'tasks' && (
            <span
              className={`px-2 py-0.5 text-xs rounded-full text-white ${
                taskTracking.badgeState.color === 'green'
                  ? 'bg-green-500 animate-pulse'
                  : taskTracking.badgeState.color === 'red'
                    ? 'bg-red-500'
                    : taskTracking.badgeState.color === 'amber'
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
              }`}
            >
              {taskTracking.badgeState.count || ''}
            </span>
          )}
          {activeTab === 'tasks' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>
      </div>

      {/* Messages Area */}
      {activeTab === 'messages' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin relative">
        {isLoadingHistory ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <svg className="w-8 h-8 mb-3 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm">Loading conversation history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg font-medium">开始备课对话</p>
            <p className="mt-1 text-sm">向AI助手描述您的备课需求</p>
          </div>
        ) : (
          splitMessages.map((splitMsg) => (
            splitMsg.role === 'assistant' ? (
              <AssistantMessageGroup
                key={splitMsg.messageId}
                splitMessage={splitMsg}
                tokenUsage={splitMsg.tokenUsage as MessageTokenUsage}
                timestamp={splitMsg.timestamp}
                outputUpdates={splitMsg.original.outputUpdates}
                onSync={(field) => onSync(field as SyncField)}
                onDiscard={(field) => onDiscard(field as SyncField)}
                renderSyncButton={undefined}
                renderTokenUsage={(usage) => <CustomTokenUsageFooter usage={usage as MessageTokenUsage} />}
                renderSegment={(segment, isLast) => (
                  <SegmentBubble
                    key={segment.id}
                    segment={segment}
                    isLast={isLast}
                  />
                )}
              />
            ) : (
              <MessageBubble
                key={splitMsg.messageId}
                message={splitMsg.original as any}
                onSync={onSync}
                onDiscard={onDiscard}
                pendingUpdates={pendingUpdates}
                modifiedFields={modifiedFields}
              />
            )
          ))
        )}
        <div ref={messagesEndRef} />
        </div>
      )}

      {/* Files View */}
      {activeTab === 'files' && connection && sessionId && (
        <div className="flex-1 overflow-hidden">
          <FilesView
            connection={connection}
            sessionId={sessionId}
            onAttachFile={lessonPlanId ? handleAttachFile : undefined}
            attachButtonLabel="附加"
            attachButtonTitle="附加到教案"
          />
        </div>
      )}

      {/* Tasks View */}
      {activeTab === 'tasks' && (
        <div className="flex-1 overflow-hidden">
          <TasksView
            groups={taskTracking.groups}
            todoStats={todoStats}
            highlightedTaskId={highlightedTaskId}
          />
        </div>
      )}

      {/* Activity Status Line */}
      <AgentActivityLine
        isProcessing={isProcessing}
        isThinking={isThinking}
        thinkingContent={thinkingContent}
        thinkingStartTime={thinkingStartTime}
        thinkingVerb={thinkingVerb}
        todoItems={todoItems}
        todoStats={todoStats}
        activeTools={activeTools}
        activeSubAgents={activeSubAgents}
        onCancel={onCancel}
      />

      {/* Global Sync Section */}
      {pendingUpdatesWithMeta && onSyncAll && (
        <GlobalSyncSection
          pendingUpdates={pendingUpdatesWithMeta}
          onSyncAll={onSyncAll}
          onSyncField={onSync}
          onDiscardField={onDiscard}
        />
      )}

      {/* Quick Prompts */}
      <div className="px-4 py-2 bg-white border-t border-gray-100">
        <QuickPrompts onSelect={handleQuickPrompt} disabled={mainProcessing || !connected} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={connected ? '输入您的备课需求...' : '正在连接服务器...'}
              disabled={!connected}
              rows={1}
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>

          <button
            type="submit"
            disabled={!inputValue.trim() || mainProcessing || !connected}
            className="flex-shrink-0 btn-primary px-4 rounded-xl"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}

export default ChatPanel
