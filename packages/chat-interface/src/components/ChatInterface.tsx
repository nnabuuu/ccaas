import { useState, useRef, useEffect, useCallback } from 'react'
import { useAgentConnection, useAgentChat, useAgentStatus } from '@kedge-agentic/react-sdk'
import type { ChatMessage, ContentBlock, NextAction, QuickSuggestion } from '@/types/chat'
import type { SessionContextChip } from '@/types/session-context'
import type { WidgetRegistry, BlockRendererMap } from '@/types/widget'
import type { WidgetCatalogEntry } from '@/widgets/catalog'
import type { McpBridge } from '@/widgets/mcp-bridge'
import { Toaster, toast } from 'sonner'
import { ChatInterfaceProvider } from '@/context/ChatInterfaceContext'
import { parseAssistantContent } from '@/harness/postprocessor'
import { submitToEngine } from '@/harness/submit-engine'
import { SessionContextBar } from './SessionContextBar'
import { MessageRenderer } from './MessageRenderer'
import { QuickSuggestions } from './QuickSuggestions'
import { SkillPanel } from './SkillPanel'
import { ThinkingDots } from './ThinkingDots'

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
  /** Extra trailing content inserted before the "技能" button in the context bar */
  contextBarTrailing?: React.ReactNode
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
  contextBarTrailing,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [widgetStates, setWidgetStates] = useState<Record<string, Record<string, unknown>>>({})
  const [skillPanelOpen, setSkillPanelOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
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

      return {
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        timestamp: msg.createdAt ?? new Date().toISOString(),
        content: contentBlocks,
        isStreaming: isStreaming && msg.role === 'assistant',
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

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxH = 6 * 24 // ~6 lines
    el.style.height = Math.min(el.scrollHeight, maxH) + 'px'
  }, [])

  useEffect(() => {
    resizeTextarea()
  }, [input, resizeTextarea])

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
      toast.error('消息发送失败，请重试')
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
      toast.error('操作执行失败，请重试')
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
      toast.error('提交失败，请重试')
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
      <Toaster position="top-right" richColors />
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
            <>
              {contextBarTrailing}
              <button
                onClick={() => setSkillPanelOpen(prev => !prev)}
                className="text-[11px] px-[10px] py-[3px] rounded-xl border bg-ck-bg2 text-ck-t2 border-ck-b1 hover:bg-ck-bg2/80"
              >
                技能
              </button>
            </>
          }
        />

        {/* Skill panel */}
        <SkillPanel
          serverUrl={serverUrl}
          tenantId={tenantId}
          apiKey={apiKey}
          open={skillPanelOpen}
          onClose={() => setSkillPanelOpen(false)}
        />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden ck-scrollbar">
          <div className="max-w-3xl mx-auto px-4 pt-6 pb-4 flex flex-col min-h-full">
            {chatMessages.length === 0 && !isLoadingHistory && (
              <div className="flex-1 flex flex-col items-center justify-center gap-8">
                <h1 className="text-3xl font-serif text-ck-t1">有什么可以帮你的？</h1>
                {quickSuggestions.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                    {quickSuggestions.slice(0, 4).map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionSelect(s)}
                        className="text-left px-4 py-3 rounded-xl border border-ck-b1 bg-ck-bg1 text-sm text-ck-t2 hover:bg-ck-bg3 hover:text-ck-t1 transition-all ease-claude cursor-pointer active:scale-[0.98]"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isLoadingHistory && (
              <div className="flex-1 flex items-center justify-center text-ck-t3 text-sm">
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
              <div className="mt-1 pl-2">
                <ThinkingDots label={status.thinkingVerb} />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Quick suggestions — hidden in empty state (shown as cards instead) */}
        {chatMessages.length > 0 && (
          <div className="max-w-3xl mx-auto w-full">
            <QuickSuggestions
              suggestions={quickSuggestions}
              onSelect={handleSuggestionSelect}
            />
          </div>
        )}

        {/* Composer — floating card with multi-layer shadow */}
        <div className="bg-ck-bg2 px-4 pb-4 pt-2">
          <div className="max-w-3xl mx-auto relative rounded-[20px] bg-ck-bg1 shadow-composer hover:shadow-composer-hover focus-within:shadow-composer-focus transition-all duration-200">
            <textarea
              ref={inputRef}
              rows={1}
              className="w-full resize-none bg-transparent text-base text-ck-t1 outline-none px-3.5 pt-3.5 pb-10 placeholder:text-ck-t3"
              placeholder="输入消息..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!connection.sessionReady}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              className="absolute bottom-2.5 right-2.5 w-8 h-8 rounded-lg bg-ck-accent text-white cursor-pointer flex items-center justify-center text-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ck-accent-hover transition-colors active:scale-95"
            >
              &#8593;
            </button>
          </div>
          <p className="text-center text-xs text-ck-t3 mt-2">AI 可能会犯错，请核实重要信息。</p>
        </div>
      </div>
    </div>
    </ChatInterfaceProvider>
  )
}
