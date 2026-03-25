import { useState, useRef, useEffect, useCallback } from 'react'
import { useAgentConnection, useAgentChat, useAgentStatus } from '@kedge-agentic/react-sdk'
import type { ChatMessage, ContentBlock, NextAction, QuickSuggestion } from '@/types/chat'
import type { SessionContextChip } from '@/types/session-context'
import type { WidgetRegistry, BlockRendererMap } from '@/types/widget'
import type { WidgetCatalogEntry } from '@/widgets/catalog'
import type { McpBridge } from '@/widgets/mcp-bridge'
import { ChatInterfaceProvider } from '@/context/ChatInterfaceContext'
import { parseAssistantContent } from '@/harness/postprocessor'
import { submitToEngine } from '@/harness/submit-engine'
import { SessionContextBar } from './SessionContextBar'
import { MessageRenderer } from './MessageRenderer'
import { QuickSuggestions } from './QuickSuggestions'
import { SkillPanel } from './SkillPanel'

export interface ChatInterfaceProps {
  serverUrl: string
  tenantId: string
  sessionTemplate?: string
  contextChips?: SessionContextChip[]
  quickSuggestions?: QuickSuggestion[]
  sessionContext?: Record<string, unknown>
  onChipClick?: (chip: SessionContextChip) => void
  customWidgets?: WidgetRegistry
  customCatalog?: WidgetCatalogEntry[]
  customBlockRenderers?: BlockRendererMap
  mcpBridge?: McpBridge
  userId?: string
  sessionId?: string
  /** API key for X-API-Key header authentication */
  apiKey?: string
  onMenuClick?: () => void
  onMessageSent?: () => void
}

export function ChatInterface({
  serverUrl,
  tenantId,
  sessionTemplate,
  contextChips = [],
  quickSuggestions = [],
  sessionContext = {},
  onChipClick,
  customWidgets,
  customCatalog,
  customBlockRenderers,
  mcpBridge,
  userId,
  sessionId: externalSessionId,
  apiKey,
  onMenuClick,
  onMessageSent,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [widgetStates, setWidgetStates] = useState<Record<string, Record<string, unknown>>>({})
  const [skillPanelOpen, setSkillPanelOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const connection = useAgentConnection({
    serverUrl,
    tenantId,
    autoConnect: true,
    transport: 'sse',
    sessionId: externalSessionId,
    userId,
    apiKey,
  })

  const chat = useAgentChat({
    connection,
    tenantId,
    sessionTemplate,
    transport: 'sse',
    userId,
  })

  const status = useAgentStatus({ connection })

  // Destructure for stable callback dependencies
  const { sendMessage, isProcessing, messages, isLoadingHistory, currentStreamContent } = chat

  // Convert react-sdk messages to ChatMessage format
  useEffect(() => {
    const converted: ChatMessage[] = messages.map((msg) => {
      const contentText = msg.content || ''
      const isStreaming = msg.isStreaming ?? false

      let contentBlocks: ContentBlock[]
      if (msg.role === 'assistant' && contentText) {
        contentBlocks = parseAssistantContent(contentText, isStreaming)
      } else if (contentText) {
        contentBlocks = [{ type: 'text', content: contentText }]
      } else {
        contentBlocks = []
      }

      // Add streaming cursor to the last text block
      if (isStreaming && msg.role === 'assistant') {
        const lastBlock = contentBlocks[contentBlocks.length - 1]
        if (lastBlock?.type === 'text') {
          lastBlock.content += ' \u258C'
        } else if (contentBlocks.length === 0) {
          contentBlocks.push({ type: 'text', content: '\u258C' })
        }
      }

      return {
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        timestamp: msg.createdAt ?? new Date().toISOString(),
        content: contentBlocks,
      }
    })
    setChatMessages(converted)
  }, [messages])

  // Throttled auto-scroll to bottom
  useEffect(() => {
    clearTimeout(scrollTimeoutRef.current)
    scrollTimeoutRef.current = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }, [chatMessages, currentStreamContent])

  const onMessageSentRef = useRef(onMessageSent)
  onMessageSentRef.current = onMessageSent

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isProcessing) return
    setInput('')
    try {
      await sendMessage(text)
      onMessageSentRef.current?.()
    } catch (err) {
      setInput(text)
      console.error('Failed to send message:', err)
    }
  }, [input, isProcessing, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSuggestionSelect = (suggestion: QuickSuggestion) => {
    setInput(suggestion.prompt)
    inputRef.current?.focus()
  }

  const handleAction = useCallback(async (action: NextAction) => {
    try {
      await sendMessage(action.prompt)
    } catch (err) {
      console.error('Failed to send action:', err)
    }
  }, [sendMessage])

  const handleWidgetSubmit = useCallback(async (messageId: string, params: Record<string, unknown>) => {
    try {
      await submitToEngine({
        submission: {
          sourceWidgetType: (params._widgetType as string) ?? 'unknown',
          targetSkill: (params._action as string) ?? 'default',
          params,
          context: sessionContext,
        },
        sendMessage,
      })
    } catch (err) {
      console.error('Failed to submit widget:', err)
    }
  }, [sendMessage, sessionContext])

  const handleWidgetStateChange = useCallback((messageId: string, key: string, value: unknown) => {
    setWidgetStates(prev => ({
      ...prev,
      [messageId]: { ...(prev[messageId] ?? {}), [key]: value },
    }))
  }, [])

  return (
    <ChatInterfaceProvider
      customWidgets={customWidgets}
      customCatalog={customCatalog}
      customBlockRenderers={customBlockRenderers}
      mcpBridge={mcpBridge}
    >
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 flex flex-col overflow-hidden bg-ck-bg2">
        {/* Context bar */}
        <SessionContextBar
          chips={contextChips}
          onChipClick={onChipClick}
          leading={onMenuClick && (
            <button
              onClick={onMenuClick}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded text-ck-t2 hover:text-ck-t1 hover:bg-ck-bg3 text-base"
              title="会话列表"
            >
              &#9776;
            </button>
          )}
          trailing={
            <button
              onClick={() => setSkillPanelOpen(prev => !prev)}
              className="text-[11px] px-[10px] py-[3px] rounded-xl border bg-ck-bg2 text-ck-t2 border-ck-b1 hover:bg-ck-bg2/80"
            >
              技能
            </button>
          }
        />

        {/* Skill panel */}
        <SkillPanel
          serverUrl={serverUrl}
          tenantId={tenantId}
          open={skillPanelOpen}
          onClose={() => setSkillPanelOpen(false)}
        />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 flex flex-col gap-[14px] min-h-full">
            {chatMessages.length === 0 && !isLoadingHistory && (
              <div className="flex-1 flex items-center justify-center text-ck-t3 text-sm">
                开始对话...
              </div>
            )}

            {isLoadingHistory && (
              <div className="flex-1 flex items-center justify-center text-ck-t3 text-xs">
                加载历史记录...
              </div>
            )}

            {chatMessages.map((msg) => (
              <MessageRenderer
                key={msg.id}
                message={msg}
                widgetState={widgetStates[msg.id] ?? {}}
                onWidgetStateChange={(key, value) => handleWidgetStateChange(msg.id, key, value)}
                onAction={handleAction}
                onWidgetSubmit={(params) => handleWidgetSubmit(msg.id, params)}
              />
            ))}

            {/* Thinking indicator */}
            {isProcessing && status.isThinking && (
              <div className="self-start max-w-[88%]">
                <div className="text-xs text-ck-t3 mb-1 animate-pulse">
                  {status.thinkingVerb}...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Quick suggestions */}
        <div className="max-w-3xl mx-auto w-full">
          <QuickSuggestions
            suggestions={quickSuggestions}
            onSelect={handleSuggestionSelect}
          />
        </div>

        {/* Input bar */}
        <div className="border-t border-ck-b1 bg-ck-bg1">
          <div className="max-w-3xl mx-auto flex items-center gap-2 px-4 py-[10px]">
            <input
              ref={inputRef}
              className="flex-1 px-3 py-2 border border-ck-b1 rounded-[20px] text-[13px] bg-ck-bg1 text-ck-t1 font-inherit outline-none focus:border-ck-info-t"
              placeholder="输入消息..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!connection.sessionReady}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              className="w-8 h-8 rounded-full border-none bg-ck-t1 text-ck-bg1 cursor-pointer flex items-center justify-center text-sm shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              &#8593;
            </button>
          </div>
        </div>
      </div>
    </div>
    </ChatInterfaceProvider>
  )
}
