import { useMemo, useState, useRef, useEffect } from 'react'

export interface SidebarSession {
  sessionId: string
  title: string | null
  lastActivity: string
  messageCount: number
  isPinned?: boolean
}

export interface ChatSidebarProps {
  sessions: SidebarSession[]
  currentSessionId?: string
  onNewChat: () => void
  onSelectSession: (sessionId: string) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
  onLogout?: () => void
  apiKeyHint?: string
}

/** Group sessions by relative date */
function groupByDate(sessions: SidebarSession[]): { label: string; sessions: SidebarSession[] }[] {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  const weekAgoStart = new Date(todayStart.getTime() - 7 * 86400000)

  const groups: Record<string, SidebarSession[]> = {
    '今天': [],
    '昨天': [],
    '过去 7 天': [],
    '更早': [],
  }

  for (const s of sessions) {
    const d = new Date(s.lastActivity)
    if (d >= todayStart) groups['今天'].push(s)
    else if (d >= yesterdayStart) groups['昨天'].push(s)
    else if (d >= weekAgoStart) groups['过去 7 天'].push(s)
    else groups['更早'].push(s)
  }

  return Object.entries(groups)
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, sessions: list }))
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function sessionTitle(s: SidebarSession): string {
  if (s.title) return s.title
  return `对话 ${s.sessionId.slice(-6)}`
}

export function ChatSidebar({
  sessions,
  currentSessionId,
  onNewChat,
  onSelectSession,
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onMobileClose,
  onLogout,
  apiKeyHint,
}: ChatSidebarProps) {
  const grouped = useMemo(() => groupByDate(sessions), [sessions])
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close popover on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  // Sidebar content (shared between desktop and mobile)
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3">
        {!collapsed && (
          <button
            onClick={onNewChat}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium text-ck-t2 hover:bg-ck-bg3 transition-colors focus-visible:ring-2 focus-visible:ring-ck-accent"
          >
            <span className="text-base leading-none">+</span>
            新对话
          </button>
        )}
        {collapsed && (
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center py-2 rounded-lg text-base border border-ck-b1 text-ck-t1 hover:bg-ck-bg3 transition-colors focus-visible:ring-2 focus-visible:ring-ck-accent"
            title="新对话"
          >
            +
          </button>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded text-ck-t3 hover:text-ck-t1 hover:bg-ck-bg3 transition-colors text-xs focus-visible:ring-2 focus-visible:ring-ck-accent"
            title={collapsed ? '展开' : '收起'}
          >
            {collapsed ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            )}
          </button>
        )}
      </div>

      {/* Session list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 && (
            <div className="px-3 py-8 text-center text-ck-t3 text-xs">
              暂无会话记录
            </div>
          )}

          {grouped.map((group) => (
            <div key={group.label}>
              <div className="px-4 pt-3 pb-1 text-[11px] font-medium text-ck-t3 uppercase tracking-wider">
                {group.label}
              </div>
              {group.sessions.map((s) => (
                <button
                  key={s.sessionId}
                  onClick={() => onSelectSession(s.sessionId)}
                  className={`w-full text-left px-3 py-2 mx-1 rounded-lg text-[13px] transition-colors block min-w-0 focus-visible:ring-2 focus-visible:ring-ck-accent ${
                    s.sessionId === currentSessionId
                      ? 'bg-ck-bg3 text-ck-t1 font-medium'
                      : 'text-ck-t2 hover:bg-ck-bg3'
                  }`}
                  title={sessionTitle(s)}
                >
                  <div className="truncate">{sessionTitle(s)}</div>
                  <div className="text-[11px] text-ck-t3 mt-0.5">
                    {formatTime(s.lastActivity)}
                    {s.messageCount > 0 && ` · ${s.messageCount} 条`}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Collapsed: show icon list */}
      {collapsed && (
        <div className="flex-1 overflow-y-auto py-2">
          {sessions.slice(0, 20).map((s) => (
            <button
              key={s.sessionId}
              onClick={() => onSelectSession(s.sessionId)}
              className={`w-full flex items-center justify-center py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ck-accent ${
                s.sessionId === currentSessionId
                  ? 'bg-ck-bg3 text-ck-t1'
                  : 'text-ck-t3 hover:text-ck-t1 hover:bg-ck-bg2'
              }`}
              title={sessionTitle(s)}
            >
              &#9776;
            </button>
          ))}
        </div>
      )}

      {/* User menu */}
      {onLogout && (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="用户菜单"
            aria-expanded={menuOpen}
            aria-haspopup="true"
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-ck-bg2 transition-colors focus-visible:ring-2 focus-visible:ring-ck-accent ${
              collapsed ? 'justify-center' : ''
            }`}
            title={apiKeyHint ?? 'API Key'}
          >
            {/* Avatar circle */}
            <span className="shrink-0 w-7 h-7 rounded-full bg-ck-bg3 flex items-center justify-center text-xs text-ck-t2">
              K
            </span>
            {!collapsed && (
              <span className="truncate text-[13px] text-ck-t2 min-w-0">
                {apiKeyHint ?? 'API Key'}
              </span>
            )}
          </button>

          {/* Popover menu */}
          {menuOpen && (
            <div role="menu" className="absolute bottom-full left-2 right-2 mb-1 py-1 rounded-ck-lg bg-ck-bg1 border border-ck-b1 z-50">
              {apiKeyHint && !collapsed && (
                <div className="px-3 py-1.5 text-[11px] text-ck-t3 truncate">
                  {apiKeyHint}
                </div>
              )}
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onLogout()
                }}
                className="w-full text-left px-3 py-1.5 text-[13px] text-ck-t2 hover:bg-ck-bg2 transition-colors focus-visible:ring-2 focus-visible:ring-ck-accent"
              >
                断开连接
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className={`hidden md:flex flex-col border-r border-ck-b1 bg-ck-bg1 shrink-0 transition-[width] duration-200 ${
          collapsed ? 'w-[52px]' : 'w-[260px]'
        }`}
      >
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-40"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <div className="md:hidden fixed inset-y-0 left-0 w-[280px] bg-ck-bg1 z-50 shadow-xl">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  )
}
