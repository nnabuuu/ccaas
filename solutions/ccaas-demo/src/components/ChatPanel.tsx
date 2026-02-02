/**
 * Chat Panel Component
 *
 * Main chat interface with message list and input.
 */

import { useState, useRef, useEffect } from 'react'
import type { Message, FileInfo, ChatLayout, TodoItem, TodoStats, ToolActivity } from '../types'
import { MessageBubble } from './MessageBubble'
import { AgentActivityLine } from './AgentActivityLine'

const layoutSegments: { key: ChatLayout; label: string }[] = [
  { key: 'default', label: '侧栏' },
  { key: 'overlay', label: '浮层' },
  { key: 'expanded', label: '展开' },
]

interface ChatPanelProps {
  messages: Message[]
  activeSkill: string | null
  isProcessing: boolean
  todoItems: TodoItem[]
  todoStats: TodoStats | null
  activeTools: Map<string, ToolActivity>
  onSend: (message: string) => void
  onDownload: (file: FileInfo) => void
  onCancel?: () => void
  chatLayout: ChatLayout
  onLayoutChange: (layout: ChatLayout) => void
}

export function ChatPanel({
  messages,
  activeSkill,
  isProcessing,
  todoItems,
  todoStats,
  activeTools,
  onSend,
  onDownload,
  onCancel,
  chatLayout,
  onLayoutChange,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isProcessing) return

    onSend(input.trim())
    setInput('')
  }

  const getSkillName = (skill: string): string => {
    switch (skill) {
      case 'hello-world': return 'Hello World'
      case 'report': return 'Report Generator'
      case 'document': return 'Document Writer'
      case 'analysis': return 'Data Analyzer'
      default: return skill
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50">
      {/* Header with layout segment control */}
      <div className="px-4 py-2 border-b flex items-center justify-between">
        <h2 className="font-medium text-gray-700">对话</h2>
        <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
          {layoutSegments.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onLayoutChange(key)}
              className={`px-2 py-1 rounded-md transition-colors ${
                chatLayout === key
                  ? 'bg-white text-blue-600 shadow-sm font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Skill Banner */}
      {activeSkill && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span className="text-sm text-blue-700 font-medium">
            Using: {getSkillName(activeSkill)}
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-lg font-medium text-gray-700">Start a Conversation</h3>
              <p className="text-sm mt-2 max-w-md">
                Enable skills in the sidebar and try asking for a report,
                document, or analysis to see them in action.
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map(message => (
              <MessageBubble
                key={message.id}
                message={message}
                onDownload={onDownload}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Activity Status Line */}
      <AgentActivityLine
        isProcessing={isProcessing}
        todoItems={todoItems}
        todoStats={todoStats}
        activeTools={activeTools}
        onCancel={onCancel}
      />

      {/* Input */}
      <div className="border-t border-gray-200 bg-white p-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isProcessing ? 'Waiting for response...' : 'Type a message...'}
            disabled={isProcessing}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
