import { useMemo, useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

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

  const starred: SidebarSession[] = []
  const today: SidebarSession[] = []
  const yesterday: SidebarSession[] = []
  const pastWeek: SidebarSession[] = []
  const older: SidebarSession[] = []

  for (const s of sessions) {
    if (s.isPinned) {
      starred.push(s)
      continue
    }
    const d = new Date(s.lastActivity)
    if (d >= todayStart) today.push(s)
    else if (d >= yesterdayStart) yesterday.push(s)
    else if (d >= weekAgoStart) pastWeek.push(s)
    else older.push(s)
  }

  const result: { label: string; sessions: SidebarSession[] }[] = []
  if (starred.length > 0) result.push({ label: 'Starred', sessions: starred })
  if (today.length > 0) result.push({ label: 'Recents', sessions: today })
  if (yesterday.length > 0) result.push({ label: 'Yesterday', sessions: yesterday })
  if (pastWeek.length > 0) result.push({ label: 'Previous 7 Days', sessions: pastWeek })
  if (older.length > 0) result.push({ label: 'Earlier', sessions: older })
  return result
}

function sessionTitle(s: SidebarSession): string {
  if (s.title) return s.title
  return `Chat ${s.sessionId.slice(-6)}`
}

/* SVG icon helpers — small inline icons matching Claude Web */
function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function IconSearch({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconChat({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconPanelLeft({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  )
}

function IconChevron({ direction = 'up', size = 12 }: { direction?: 'up' | 'down'; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {direction === 'up' ? (
        <polyline points="18 15 12 9 6 15" />
      ) : (
        <polyline points="6 9 12 15 18 9" />
      )}
    </svg>
  )
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
  const [searchQuery, setSearchQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions
    const q = searchQuery.toLowerCase()
    return sessions.filter((s) =>
      sessionTitle(s).toLowerCase().includes(q)
    )
  }, [sessions, searchQuery])

  const grouped = useMemo(() => groupByDate(filteredSessions), [filteredSessions])

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
      {/* Top section: New chat + toggle */}
      <div className="px-2.5 pt-3 pb-1 flex flex-col gap-0.5">
        {!collapsed ? (
          <>
            {/* New chat row with toggle */}
            <div className="flex items-center justify-between">
              <button
                onClick={onNewChat}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[14px] text-ck-t2 hover:bg-ck-bg3 transition-colors ease-claude active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent"
              >
                <IconPlus size={16} />
                <span>New chat</span>
              </button>
              {onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-ck-t3 hover:text-ck-t1 hover:bg-ck-bg3 transition-colors ease-claude focus-visible:ring-2 focus-visible:ring-ck-accent"
                  title="收起侧栏"
                >
                  <IconPanelLeft size={16} />
                </button>
              )}
            </div>
            {/* Search */}
            <div className="relative mt-0.5">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ck-t3 pointer-events-none">
                <IconSearch size={14} />
              </span>
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-[13px] text-ck-t1 placeholder:text-ck-t3 outline-none pl-8 pr-2.5 py-1.5 rounded-lg hover:bg-ck-bg3 focus:bg-ck-bg3 transition-colors ease-claude"
              />
            </div>
          </>
        ) : (
          <>
            <button
              onClick={onNewChat}
              className="w-full flex items-center justify-center py-2 rounded-lg text-ck-t2 hover:text-ck-t1 hover:bg-ck-bg3 transition-colors ease-claude focus-visible:ring-2 focus-visible:ring-ck-accent"
              title="New chat"
            >
              <IconPlus size={18} />
            </button>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="w-full flex items-center justify-center py-2 rounded-lg text-ck-t3 hover:text-ck-t1 hover:bg-ck-bg3 transition-colors ease-claude focus-visible:ring-2 focus-visible:ring-ck-accent"
                title="展开侧栏"
              >
                <IconPanelLeft size={16} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Navigation section (visible when expanded) — only Chats nav */}
      {!collapsed && (
        <div className="px-2.5 py-1 border-b border-ck-b2/50 flex flex-col gap-0.5">
          <button className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[14px] text-ck-t1 bg-ck-bg3 transition-colors ease-claude active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent">
            <IconChat size={16} />
            <span>Chats</span>
          </button>
        </div>
      )}

      {/* Session list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto ck-scrollbar px-1.5 pt-1">
          {filteredSessions.length === 0 && (
            <div className="px-3 py-8 text-center text-ck-t3 text-[13px]">
              {searchQuery ? 'No matching chats' : 'No chat history yet'}
            </div>
          )}

          {grouped.map((group) => (
            <div key={group.label} className="mb-0.5">
              <div className="px-2.5 pt-3 pb-1 text-[11px] font-medium text-ck-t3 tracking-wide select-none">
                {group.label}
              </div>
              {group.sessions.map((s) => {
                const isActive = s.sessionId === currentSessionId
                return (
                  <button
                    key={s.sessionId}
                    onClick={() => onSelectSession(s.sessionId)}
                    className={cn(
                      'w-full text-left px-2.5 py-1.5 rounded-lg text-[14px] transition-colors ease-claude block min-w-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent',
                      isActive ? 'bg-ck-bg3 text-ck-t1' : 'text-ck-t2 hover:bg-ck-bg3',
                    )}
                    title={sessionTitle(s)}
                  >
                    <div className="truncate leading-snug">{sessionTitle(s)}</div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Collapsed: show icon list */}
      {collapsed && (
        <div className="flex-1 overflow-y-auto ck-scrollbar py-1">
          {sessions.slice(0, 20).map((s) => (
            <button
              key={s.sessionId}
              onClick={() => onSelectSession(s.sessionId)}
              className={cn(
                'w-full flex items-center justify-center py-2 text-sm transition-colors ease-claude active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent',
                s.sessionId === currentSessionId ? 'bg-ck-bg3 text-ck-t1' : 'text-ck-t3 hover:text-ck-t1 hover:bg-ck-bg3',
              )}
              title={sessionTitle(s)}
            >
              <IconChat size={16} />
            </button>
          ))}
        </div>
      )}

      {/* User menu */}
      {onLogout && (
        <div className="relative border-t border-ck-b2/50" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="User menu"
            aria-expanded={menuOpen}
            aria-haspopup="true"
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-ck-bg3 transition-colors ease-claude active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent',
              collapsed && 'justify-center',
            )}
            title={apiKeyHint ?? 'API Key'}
          >
            {/* Avatar circle — matching Claude Web style */}
            <span className="shrink-0 w-7 h-7 rounded-full bg-ck-accent/20 flex items-center justify-center text-[11px] font-medium text-ck-accent">
              {(apiKeyHint ?? 'K').charAt(0).toUpperCase()}
            </span>
            {!collapsed && (
              <span className="flex-1 min-w-0 flex items-center justify-between">
                <span className="truncate text-[13px] text-ck-t1">
                  {apiKeyHint ?? 'API Key'}
                </span>
                <IconChevron direction={menuOpen ? 'down' : 'up'} size={12} />
              </span>
            )}
          </button>

          {/* Popover menu */}
          {menuOpen && (
            <div role="menu" className="absolute bottom-full left-2 right-2 mb-1 py-1 rounded-lg bg-ck-bg1 border border-ck-b1 shadow-lg z-50">
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
                className="w-full text-left px-3 py-1.5 text-[13px] text-ck-t2 hover:bg-ck-bg3 rounded-lg transition-colors ease-claude active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent"
              >
                Log out
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
        className={cn(
          'hidden lg:flex flex-col bg-ck-bg2 border-r border-ck-b2/50 shrink-0 transition-[width] duration-200 ease-claude overflow-hidden',
          collapsed ? 'w-[52px]' : 'w-[260px]',
        )}
      >
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-40 transition-opacity"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <div className="lg:hidden fixed inset-y-0 left-0 w-[280px] bg-ck-bg2 z-50 shadow-xl">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  )
}
