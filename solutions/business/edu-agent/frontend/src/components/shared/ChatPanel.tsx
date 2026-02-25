import { useRef, useEffect, useState } from 'react'
import { PaperPlaneRight } from '@phosphor-icons/react'
import { useSessionContext } from '../../context/SessionContext'
import { MessageBubble } from './MessageBubble'
import { ThinkingIndicator } from './ThinkingIndicator'

interface ChatPanelProps {
  onSync?: (field: string) => void
  onDiscard?: (field: string) => void
  onUndo?: (field: string) => void
  canUndo?: (field: string) => boolean
  placeholder?: string
  className?: string
}

export function ChatPanel({ onSync, onDiscard, onUndo, canUndo, placeholder, className }: ChatPanelProps) {
  const { chat, status } = useSessionContext()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.messages, status.isThinking])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || chat.isProcessing) return
    setInput('')
    try {
      await chat.sendMessage(trimmed)
    } catch (err) {
      console.error('Failed to send:', err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={`flex flex-col h-full ${className || ''}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {chat.messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-ink-muted text-sm">
            开始对话...
          </div>
        )}

        {chat.messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onSync={onSync}
            onDiscard={onDiscard}
            onUndo={onUndo}
            canUndo={canUndo}
          />
        ))}

        {status.isThinking && (
          <ThinkingIndicator content={status.thinkingContent} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 bg-surface-secondary rounded-xl border border-border px-3 py-2 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20 transition-all duration-button">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || '输入消息...'}
            rows={1}
            className="flex-1 bg-transparent text-sm text-ink resize-none outline-none placeholder:text-ink-muted min-h-[24px] max-h-[120px]"
            style={{ height: 'auto', overflow: input.split('\n').length > 1 ? 'auto' : 'hidden' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || chat.isProcessing}
            className="p-1.5 rounded-lg bg-accent text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors duration-button"
          >
            <PaperPlaneRight size={16} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}
