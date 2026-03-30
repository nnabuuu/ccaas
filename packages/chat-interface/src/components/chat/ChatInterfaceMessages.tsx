import { Fragment, type ReactNode } from 'react'
import type { ChatMessage } from '@/types/chat'
import { useChatCore } from '@/context/ChatCoreContext'
import { MessageRenderer } from '@/components/MessageRenderer'
import { ThinkingDots } from '@/components/ThinkingDots'
import { ScrollToBottom } from '@/components/ScrollToBottom'
import { ChatInterfaceEmptyState } from './ChatInterfaceEmptyState'

export interface ChatInterfaceMessagesProps {
  /** Custom empty state — replaces the default ChatInterfaceEmptyState */
  emptyState?: ReactNode
  /** Custom loading skeleton */
  loadingSkeleton?: ReactNode
  /** Custom thinking indicator */
  thinkingIndicator?: ReactNode
  /** Custom message renderer — called per message, replaces default MessageRenderer */
  renderMessage?: (message: ChatMessage) => ReactNode
  className?: string
}

function DefaultLoadingSkeleton() {
  return (
    <div className="flex-1 flex flex-col justify-center gap-4 px-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="space-y-2">
          <div className={`h-3 rounded bg-ck-bg3 animate-ck-shimmer bg-[length:200%_100%] bg-gradient-to-r from-ck-bg3 via-ck-bg1 to-ck-bg3 ${i === 3 ? 'w-2/3' : 'w-full'}`} />
          <div className="h-3 rounded bg-ck-bg3 animate-ck-shimmer bg-[length:200%_100%] bg-gradient-to-r from-ck-bg3 via-ck-bg1 to-ck-bg3 w-4/5" />
        </div>
      ))}
    </div>
  )
}

export function ChatInterfaceMessages({
  emptyState,
  loadingSkeleton,
  thinkingIndicator,
  renderMessage,
  className,
}: ChatInterfaceMessagesProps) {
  const {
    messages,
    isLoadingHistory,
    isProcessing,
    isThinking,
    thinkingVerb,
    widgetStates,
    handleWidgetStateChange,
    handleAction,
    handleWidgetSubmit,
    handleRetry,
    scrollContainerRef,
    messagesEndRef,
    skillPanelOpen,
  } = useChatCore()

  return (
    <div ref={scrollContainerRef} className={`${className ?? 'relative flex-1 overflow-y-auto overflow-x-hidden ck-scrollbar'}${skillPanelOpen ? ' hidden' : ''}`} role="log" aria-live="polite" aria-relevant="additions">
      <div className="max-w-3xl mx-auto px-3 md:px-4 pt-6 pb-4 flex flex-col min-h-full">
        {messages.length === 0 && !isLoadingHistory && (
          emptyState ?? <ChatInterfaceEmptyState />
        )}

        {isLoadingHistory && (
          loadingSkeleton ?? <DefaultLoadingSkeleton />
        )}

        {messages.map((msg) => (
          renderMessage ? (
            <Fragment key={msg.id}>{renderMessage(msg)}</Fragment>
          ) : (
            <MessageRenderer
              key={msg.id}
              message={msg}
              widgetState={widgetStates[msg.id] ?? {}}
              onWidgetStateChange={(key, value) => handleWidgetStateChange(msg.id, key, value)}
              onAction={handleAction}
              onWidgetSubmit={(params) => handleWidgetSubmit(msg.id, params)}
              onRetry={msg.role === 'assistant' ? () => handleRetry(msg.id) : undefined}
            />
          )
        ))}

        {isProcessing && isThinking && (
          thinkingIndicator ?? (
            <div className="mt-1 pl-2">
              <ThinkingDots label={thinkingVerb} />
            </div>
          )
        )}

        <div ref={messagesEndRef} />
      </div>
      <ScrollToBottom scrollRef={scrollContainerRef} />
    </div>
  )
}
