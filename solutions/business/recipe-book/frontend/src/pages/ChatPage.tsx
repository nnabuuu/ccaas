import { useState, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ChatInterface,
  ChatSidebar,
  useSessionList,
  useChatCore,
} from '@kedge-agentic/chat-interface'
import { MentionProvider, MentionPicker, MentionTrigger } from '../lib/mention'
import { CCAAS_URL, RECIPE_BACKEND_URL, TENANT_ID, SESSION_TEMPLATE, API_KEY } from '../config'

const STARTER_CARDS = [
  { emoji: '\u{1F373}', title: '改良菜谱', desc: '优化现有食谱的做法和调味', prompt: '帮我改良一道菜的做法' },
  { emoji: '\u{1F4CA}', title: '营养分析', desc: '计算食谱的营养成分', prompt: '分析一道菜的营养成分' },
  { emoji: '\u{1F4CB}', title: '菜单规划', desc: '根据需求规划一周菜单', prompt: '帮我规划一周菜单' },
  { emoji: '\u2753', title: '烹饪问答', desc: '解答各种烹饪疑问', prompt: '我有一个烹饪问题' },
]

function RecipeWelcome() {
  const { handleAction } = useChatCore()
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-3xl mx-auto w-full">
      <div className="text-center mb-10">
        <div
          className="w-16 h-16 rounded-[var(--radius-md)] flex items-center justify-center mx-auto mb-6"
          style={{ background: 'var(--surface2)' }}
        >
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="var(--t1)" aria-hidden="true">
            <path d="M12 1C12.8 8 16 11.2 23 12C16 12.8 12.8 16 12 23C11.2 16 8 12.8 1 12C8 11.2 11.2 8 12 1Z" />
          </svg>
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--t1)' }}>
          你好，厨师！
        </h2>
        <p className="mt-3 text-base max-w-md mx-auto" style={{ color: 'var(--t2)' }}>
          我是你的食谱助手，可以帮你改良菜谱、分析营养、规划菜单。
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 w-full">
        {STARTER_CARDS.map((card) => (
          <button
            key={card.title}
            type="button"
            className="p-5 text-left rounded-[var(--radius-md,10px)] cursor-pointer transition-colors"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
            onClick={() => handleAction({ label: card.prompt, prompt: card.prompt })}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">{card.emoji}</span>
              <h3 className="text-sm font-bold" style={{ color: 'var(--t1)' }}>{card.title}</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--t2)' }}>{card.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

const SESSION_REFRESH_DELAY_MS = 1000
const FIRST_MESSAGE_REFRESH_DELAY_MS = 2000

export function ChatPage() {
  const [searchParams] = useSearchParams()
  const recipeName = searchParams.get('recipeName')

  const clearRefsRef = useRef<(() => void) | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(
    () => `conv_${crypto.randomUUID()}`
  )

  const placeholder = useMemo(
    () => recipeName ? `讨论「${recipeName}」的做法...` : '问我关于食谱的问题...',
    [recipeName],
  )

  const { sessions, refresh } = useSessionList(CCAAS_URL, API_KEY, TENANT_ID)

  const handleNewChat = useCallback(() => {
    const freshId = `conv_${crypto.randomUUID()}`
    setSessionId(freshId)
    setMobileSidebarOpen(false)
    setTimeout(() => refresh(), SESSION_REFRESH_DELAY_MS)
  }, [refresh])

  const handleSelectSession = useCallback((sid: string) => {
    setSessionId(sid)
    setMobileSidebarOpen(false)
  }, [])

  const handleMessageSent = useCallback(() => {
    clearRefsRef.current?.()
    setTimeout(() => refresh(), FIRST_MESSAGE_REFRESH_DELAY_MS)
  }, [refresh])

  const chatKey = sessionId ?? 'new'

  return (
    <div className="chat-page">
      <ChatSidebar
        sessions={sessions}
        currentSessionId={sessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        productName="食谱助手"
        locale="zh"
      />
      <div className="flex-1 flex flex-col min-w-0">
        <MentionProvider>
          <MentionTrigger clearRefsRef={clearRefsRef} />
          <ChatInterface
            key={chatKey}
            serverUrl={CCAAS_URL}
            tenantId={TENANT_ID}
            sessionTemplate={SESSION_TEMPLATE}
            apiKey={API_KEY}
            sessionId={sessionId}
            onMenuClick={() => setMobileSidebarOpen(true)}
            onMessageSent={handleMessageSent}
            composerPlaceholder={placeholder}
            emptyState={<RecipeWelcome />}
            disclaimer={null}
          />
          <MentionPicker
            baseUrl={RECIPE_BACKEND_URL}
            sessionId={sessionId}
            sessionTemplate={SESSION_TEMPLATE}
          />
        </MentionProvider>
      </div>

      <style>{`
        .chat-page {
          height: 100dvh;
          display: flex;
        }
        @media (min-width: 1200px) {
          .chat-page {
            margin-left: var(--sidebar-w);
          }
        }
      `}</style>
    </div>
  )
}
