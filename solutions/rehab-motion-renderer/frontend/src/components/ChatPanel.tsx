// ═══════════════════════════════════════════
// CHAT PANEL
// Wraps CCAAS chat with rehab-themed UI
// ═══════════════════════════════════════════

import { useState, useRef, useEffect } from 'react'
import type { Message, ToolActivity } from '@ccaas/react-sdk'
import { MONO_FONT } from '../constants'

interface ChatPanelProps {
  messages: Message[]
  isProcessing: boolean
  isThinking: boolean
  thinkingContent: string
  activeTools: Map<string, ToolActivity>
  currentStreamContent: string
  connected: boolean
  error: string | null
  onSendMessage: (content: string) => void
  onCancelProcessing: () => void
  onClearConversation: () => void
}

function formatToolName(raw: string): string {
  return (raw ?? 'unknown').replace(/^mcp__[^_]+__/, '').replace(/_/g, ' ')
}

function ToolCallBadge({ tool }: { tool: ToolActivity }) {
  const displayName = formatToolName(tool.toolName)
  const icon = tool.phase === 'end'
    ? (tool.success === false ? '✗' : '✓')
    : '⟳'
  const color = tool.phase === 'end'
    ? (tool.success === false ? '#f87171' : '#22d3ee88')
    : '#3a5060'
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: '#0c1525', border: `1px solid ${color}`,
      borderRadius: 4, padding: '2px 6px',
      fontSize: 10, color: '#6a8fa0', margin: '2px 0',
    }}>
      <span style={{ color }}>{icon}</span>
      <span>{displayName}</span>
      {tool.description && <span style={{ color: '#2a3a4a' }}>· {tool.description}</span>}
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const hasContentBlocks = message.role === 'assistant' && message.contentBlocks && message.contentBlocks.length > 0

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 10,
    }}>
      <div style={{
        maxWidth: '85%',
        background: isUser ? '#162033' : '#0c1525',
        border: `1px solid ${isUser ? '#22d3ee33' : '#1a2a3c'}`,
        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        padding: '8px 12px',
        fontSize: 12,
        color: '#cbd5e1',
        fontFamily: MONO_FONT,
        lineHeight: 1.6,
        // pre-wrap only for plain text; contentBlocks mode uses normal flow for inline badges
        whiteSpace: hasContentBlocks ? 'normal' : 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {hasContentBlocks
          ? message.contentBlocks!.map((block, i) =>
              block.type === 'tool'
                ? <ToolCallBadge key={block.tool.toolId || `tool-${i}`} tool={block.tool} />
                : <span key={`text-${i}`} style={{ whiteSpace: 'pre-wrap' }}>{block.text}</span>
            )
          : message.content
        }
      </div>
    </div>
  )
}

export function ChatPanel({
  messages,
  isProcessing,
  isThinking,
  thinkingContent,
  activeTools,
  currentStreamContent,
  connected,
  error,
  onSendMessage,
  onCancelProcessing,
  onClearConversation,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentStreamContent])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isProcessing) return
    onSendMessage(text)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const SUGGESTIONS = [
    '我有L4-L5椎管狭窄，想要一套在家康复训练',
    '腰椎间盘突出，急性期刚过，需要保守康复方案',
    '帮我设计一套适合老年人的核心稳定训练',
  ]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      fontFamily: MONO_FONT,
      background: '#080d16',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1a2332',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#0a1120',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 9, color: '#22d3ee', letterSpacing: 2.5 }}>康复 AI</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginTop: 2 }}>
            康复训练规划师
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? '#22d3ee' : '#f87171',
            boxShadow: connected ? '0 0 6px #22d3ee88' : 'none',
          }} />
          <button
            onClick={onClearConversation}
            style={{
              background: 'transparent',
              border: '1px solid #1e2d40',
              borderRadius: 6,
              padding: '3px 8px',
              color: '#4a6070',
              fontSize: 10,
              cursor: 'pointer',
              fontFamily: MONO_FONT,
            }}
          >
            新对话
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: '8px 16px',
          background: '#1a0e0e',
          borderBottom: '1px solid #dc262633',
          fontSize: 11,
          color: '#f87171',
          flexShrink: 0,
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {messages.length === 0 && (
          <div style={{ marginTop: 'auto' }}>
            <div style={{
              textAlign: 'center',
              color: '#2a3a4a',
              fontSize: 12,
              marginBottom: 24,
              paddingTop: 40,
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🦴</div>
              <div>描述您的检查报告或症状</div>
              <div style={{ fontSize: 10, color: '#1a2a38', marginTop: 4 }}>AI 将生成个性化康复训练方案</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(s)
                  }}
                  style={{
                    background: '#0c1525',
                    border: '1px solid #1a2a3c',
                    borderRadius: 8,
                    padding: '8px 12px',
                    color: '#6a8fa0',
                    fontSize: 11,
                    fontFamily: MONO_FONT,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all .15s',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming content */}
        {isProcessing && currentStreamContent && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-start',
            marginBottom: 10,
          }}>
            <div style={{
              maxWidth: '85%',
              background: '#0c1525',
              border: '1px solid #1a2a3c',
              borderRadius: '12px 12px 12px 2px',
              padding: '8px 12px',
              fontSize: 12,
              color: '#cbd5e1',
              fontFamily: MONO_FONT,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {currentStreamContent}
              <span style={{ color: '#22d3ee', animation: 'blink 1s step-end infinite' }}>▊</span>
            </div>
          </div>
        )}

        {/* Thinking indicator */}
        {isThinking && !currentStreamContent && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: '#3a5060',
            fontSize: 11,
            padding: '4px 0',
          }}>
            <div style={{
              display: 'flex',
              gap: 3,
            }}>
              {[0, 1, 2].map((j) => (
                <div key={j} style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: '#22d3ee',
                  opacity: 0.6,
                  animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite`,
                }} />
              ))}
            </div>
            <span>{thinkingContent || '思考中...'}</span>
          </div>
        )}

        {/* Active tool indicator — only show tools still running (phase !== 'end') */}
        {isProcessing && [...activeTools.values()].some(t => t.phase !== 'end') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3a5060', fontSize: 11, padding: '2px 0' }}>
            <span style={{ color: '#22d3ee' }}>⟳</span>
            <span>{formatToolName([...activeTools.values()].find(t => t.phase !== 'end')!.toolName)}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #1a2332',
        background: '#0a1120',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述您的病情、MRI结果或症状..."
            rows={2}
            style={{
              flex: 1,
              background: '#111a2e',
              border: '1px solid #1e2d40',
              borderRadius: 8,
              padding: '8px 10px',
              color: '#cbd5e1',
              fontSize: 12,
              fontFamily: MONO_FONT,
              resize: 'none',
              outline: 'none',
            }}
          />
          {isProcessing ? (
            <button
              onClick={onCancelProcessing}
              style={{
                background: 'linear-gradient(135deg,#dc2626,#991b1b)',
                border: 'none',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#fff',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: MONO_FONT,
                flexShrink: 0,
              }}
            >
              停止
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !connected}
              style={{
                background: input.trim() && connected
                  ? 'linear-gradient(135deg,#0891b2,#06b6d4)'
                  : '#111a2e',
                border: 'none',
                borderRadius: 8,
                padding: '10px 14px',
                color: input.trim() && connected ? '#fff' : '#3a5060',
                fontSize: 12,
                cursor: input.trim() && connected ? 'pointer' : 'not-allowed',
                fontFamily: MONO_FONT,
                flexShrink: 0,
              }}
            >
              发送
            </button>
          )}
        </div>
        <div style={{ fontSize: 9, color: '#1a2a38', marginTop: 6, textAlign: 'center' }}>
          Enter 发送 · Shift+Enter 换行
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
