import { useMemo, useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export interface SidebarSession {
  sessionId: string
  title: string | null
  lastActivity: string
  messageCount: number
  isPinned?: boolean
  /** Optional explicit status indicator */
  status?: 'active' | 'done'
}

export interface SidebarSkillItem {
  name: string
  iconText: string
  type: 'solution' | 'custom'
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
  /** Callback when Skills entry is clicked */
  onSkillsClick?: () => void
  /** Whether Skills panel is currently active */
  skillsActive?: boolean
  /** Optional content rendered above the user menu (e.g. session context chips) */
  userContext?: React.ReactNode
  /** Product name shown in sidebar header (e.g. "即见教育") */
  productName?: string
  /** Locale for date group labels */
  locale?: 'zh' | 'en'
  /** Skills list with colored icons — renders individual skill items when provided */
  skills?: SidebarSkillItem[]
  /** User role displayed under name */
  userRole?: string
}

const ZH_LABELS = {
  starred: '已固定',
  today: '今天',
  yesterday: '昨天',
  pastWeek: '本周',
  older: '更早',
  search: '搜索会话...',
  noMatch: '无匹配会话',
  noHistory: '暂无会话记录',
  newChat: '新会话',
  skills: '已启用 Skills',
  manageSkills: '管理 Skills',
  logout: '退出登录',
  settings: '设置',
  export: '导出记录',
  help: '帮助',
}

const EN_LABELS = {
  starred: 'Starred',
  today: 'Recents',
  yesterday: 'Yesterday',
  pastWeek: 'Previous 7 Days',
  older: 'Earlier',
  search: 'Search',
  noMatch: 'No matching chats',
  noHistory: 'No chat history yet',
  newChat: 'New chat',
  skills: 'Skills',
  manageSkills: 'Manage Skills',
  logout: 'Log out',
  settings: 'Settings',
  export: 'Export',
  help: 'Help',
}

type Labels = typeof ZH_LABELS

/** Group sessions by relative date */
function groupByDate(sessions: SidebarSession[], labels: Labels): { label: string; sessions: SidebarSession[] }[] {
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
  if (starred.length > 0) result.push({ label: labels.starred, sessions: starred })
  if (today.length > 0) result.push({ label: labels.today, sessions: today })
  if (yesterday.length > 0) result.push({ label: labels.yesterday, sessions: yesterday })
  if (pastWeek.length > 0) result.push({ label: labels.pastWeek, sessions: pastWeek })
  if (older.length > 0) result.push({ label: labels.older, sessions: older })
  return result
}

/** Format session time for sidebar display */
function formatSessionTime(lastActivity: string, locale: 'zh' | 'en'): string {
  const d = new Date(lastActivity)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)

  if (d >= todayStart) {
    return d.toLocaleTimeString(locale === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  if (d >= yesterdayStart) {
    return d.toLocaleTimeString(locale === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  const days = ['日', '一', '二', '三', '四', '五', '六']
  if (locale === 'zh') {
    return `周${days[d.getDay()]}`
  }
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

function sessionTitle(s: SidebarSession): string {
  if (s.title) return s.title
  return `Chat ${s.sessionId.slice(-6)}`
}

/* SVG icon helpers */
function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
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
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      {direction === 'up' ? (
        <path d="M4 10l4-4 4 4" />
      ) : (
        <path d="M4 6l4 4 4-4" />
      )}
    </svg>
  )
}

function IconPuzzle({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.315 8.685a.98.98 0 0 1 .837-.276c.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.61-1.61a2.404 2.404 0 0 1 1.705-.707c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z" />
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
  onSkillsClick,
  skillsActive,
  userContext,
  productName,
  locale = 'en',
  skills,
  userRole,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const labels = locale === 'zh' ? ZH_LABELS : EN_LABELS
  const isZh = locale === 'zh'

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions
    const q = searchQuery.toLowerCase()
    return sessions.filter((s) =>
      sessionTitle(s).toLowerCase().includes(q)
    )
  }, [sessions, searchQuery])

  const grouped = useMemo(() => groupByDate(filteredSessions, labels), [filteredSessions, labels])

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

  // Sidebar content renderer — accepts isCollapsed to allow mobile drawer to force expanded
  function renderSidebarContent(isCollapsed: boolean) {
    return (
      <div className="flex flex-col h-full">
        {/* Header: product name + new chat button */}
        <div className="px-4 py-3.5 border-b-[0.5px] border-ck-b1 flex items-center justify-between shrink-0">
          {!isCollapsed ? (
            <>
              <span className="text-[15px] font-semibold text-ck-t1">{productName ?? (isZh ? '新会话' : 'New chat')}</span>
              <button
                onClick={onNewChat}
                className="w-7 h-7 rounded-[7px] border-[0.5px] border-ck-b1 bg-ck-bg1 flex items-center justify-center text-ck-t2 hover:bg-ck-bg3 hover:text-ck-t1 transition-all duration-150 cursor-pointer"
                title={labels.newChat}
              >
                <IconPlus size={16} />
              </button>
            </>
          ) : (
            <button
              onClick={onNewChat}
              className="w-full flex items-center justify-center text-ck-t2 hover:text-ck-t1"
              title={labels.newChat}
            >
              <IconPlus size={18} />
            </button>
          )}
        </div>

        {/* Search bar */}
        {!isCollapsed && (
          <div className="px-3 py-2 shrink-0">
            <input
              type="text"
              placeholder={labels.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2.5 py-[7px] border-[0.5px] border-ck-b1 rounded-lg text-[12px] bg-ck-bg1 text-ck-t1 placeholder:text-ck-t3 outline-none focus:border-[var(--info-t)] transition-colors"
            />
          </div>
        )}

        {/* Collapsed: toggle button */}
        {isCollapsed && onToggleCollapse && (
          <div className="px-2 py-1 shrink-0">
            <button
              onClick={onToggleCollapse}
              className="w-full flex items-center justify-center py-2 rounded-lg text-ck-t3 hover:text-ck-t1 hover:bg-ck-bg3 transition-colors ease-claude"
              title="展开侧栏"
            >
              <IconPanelLeft size={16} />
            </button>
          </div>
        )}

        {/* Session list — scrollable */}
        {!isCollapsed && (
          <div className="flex-1 overflow-y-auto ck-scrollbar pb-2">
            {filteredSessions.length === 0 && (
              <div className="px-3 py-8 text-center text-ck-t3 text-[12px]">
                {searchQuery ? labels.noMatch : labels.noHistory}
              </div>
            )}

            {grouped.map((group) => (
              <div key={group.label}>
                <div className="px-3 pt-2.5 pb-1 text-[10px] font-medium text-ck-t3 uppercase tracking-[0.3px] select-none">
                  {group.label}
                </div>
                {group.sessions.map((s) => {
                  const isActive = s.sessionId === currentSessionId
                  const sessionStatus = s.status ?? (s.messageCount > 0 ? 'active' : 'done')
                  return (
                    <button
                      key={s.sessionId}
                      onClick={() => onSelectSession(s.sessionId)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 mx-2 rounded-lg text-[12px] transition-colors duration-100 cursor-pointer min-w-0',
                        isActive ? 'bg-ck-bg1 font-medium' : 'hover:bg-ck-bg1',
                      )}
                      style={{ width: 'calc(100% - 16px)' }}
                      title={sessionTitle(s)}
                    >
                      {/* Status dot */}
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0',
                          sessionStatus === 'active' ? 'bg-[var(--info-t)]' : 'bg-ck-t3',
                        )}
                      />
                      {/* Title */}
                      <span className="flex-1 truncate text-ck-t1">{sessionTitle(s)}</span>
                      {/* Time */}
                      <span className="text-[10px] text-ck-t3 shrink-0">
                        {formatSessionTime(s.lastActivity, locale)}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* Collapsed: show icon list */}
        {isCollapsed && (
          <div className="flex-1 overflow-y-auto ck-scrollbar py-1">
            {sessions.slice(0, 20).map((s) => (
              <button
                key={s.sessionId}
                onClick={() => onSelectSession(s.sessionId)}
                className={cn(
                  'w-full flex items-center justify-center py-2 text-sm transition-colors ease-claude active:scale-[0.98]',
                  s.sessionId === currentSessionId ? 'bg-ck-bg3 text-ck-t1' : 'text-ck-t3 hover:text-ck-t1 hover:bg-ck-bg3',
                )}
                title={sessionTitle(s)}
              >
                <IconChat size={16} />
              </button>
            ))}
          </div>
        )}

        {/* Skills list — individual items with colored icons */}
        {!isCollapsed && skills && skills.length > 0 && (
          <div className="border-t-[0.5px] border-ck-b1 py-2 shrink-0">
            <div className="px-3 pt-1 pb-1 text-[10px] font-medium text-ck-t3 uppercase tracking-[0.3px] select-none">
              {labels.skills}
            </div>
            {skills.map((skill) => (
              <div
                key={skill.name}
                className="flex items-center gap-2 px-3 py-1.5 mx-2 rounded-md text-[11px] text-ck-t2 cursor-pointer hover:bg-ck-bg1 transition-colors duration-100"
              >
                <span
                  className={cn(
                    'w-[18px] h-[18px] rounded-[5px] flex items-center justify-center text-[9px] font-semibold shrink-0',
                    skill.type === 'solution'
                      ? 'bg-ck-success-bg text-ck-success-t'
                      : 'bg-ck-coral-bg text-ck-coral-t',
                  )}
                >
                  {skill.iconText}
                </span>
                {skill.name}
              </div>
            ))}
            {onSkillsClick && (
              <div
                onClick={() => { onMobileClose?.(); onSkillsClick?.() }}
                className="flex items-center gap-2 px-3 py-1.5 mx-2 rounded-md text-[11px] text-ck-t3 cursor-pointer hover:bg-ck-bg1 transition-colors duration-100"
              >
                <span className="w-[18px] h-[18px] rounded-[5px] flex items-center justify-center text-[9px] font-semibold shrink-0 bg-ck-bg3 text-ck-t3">+</span>
                {labels.manageSkills}
              </div>
            )}
          </div>
        )}

        {/* Fallback: single Skills entry when no skills array */}
        {!isCollapsed && !skills && onSkillsClick && (
          <div className="px-2.5 pb-1 shrink-0">
            <button
              onClick={() => { onMobileClose?.(); onSkillsClick?.() }}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[14px] transition-colors ease-claude active:scale-[0.98]',
                skillsActive
                  ? 'bg-ck-bg3 text-ck-t1 font-medium'
                  : 'text-ck-t2 hover:bg-ck-bg3 hover:text-ck-t1'
              )}
            >
              <IconPuzzle size={16} />
              <span>Skills</span>
            </button>
          </div>
        )}

        {/* Collapsed: skills icon */}
        {isCollapsed && onSkillsClick && (
          <div className="px-2 pb-1 shrink-0">
            <button
              onClick={() => { onMobileClose?.(); onSkillsClick?.() }}
              className={cn(
                'w-full flex items-center justify-center py-2 rounded-lg transition-colors ease-claude',
                skillsActive ? 'bg-ck-bg3 text-ck-t1' : 'text-ck-t3 hover:text-ck-t1 hover:bg-ck-bg3',
              )}
              title="Skills"
            >
              <IconPuzzle size={16} />
            </button>
          </div>
        )}

        {/* User context — session info chips */}
        {userContext && !isCollapsed && userContext}

        {/* User footer with menu */}
        {onLogout && (
          <div className="relative border-t-[0.5px] border-ck-b1 shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="User menu"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              className={cn(
                'w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-ck-bg1 transition-colors duration-100 cursor-pointer',
                isCollapsed && 'justify-center px-2',
              )}
              title={apiKeyHint ?? 'User'}
            >
              {/* Avatar circle */}
              <span className="shrink-0 w-7 h-7 rounded-full bg-ck-info-bg text-ck-info-t flex items-center justify-center text-[11px] font-semibold">
                {(apiKeyHint ?? 'U').charAt(0).toUpperCase()}
              </span>
              {!isCollapsed && (
                <>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12px] font-medium text-ck-t1 truncate">
                      {apiKeyHint ?? 'User'}
                    </span>
                    {userRole && (
                      <span className="block text-[10px] text-ck-t3 truncate">
                        {userRole}
                      </span>
                    )}
                  </span>
                  <IconChevron direction={menuOpen ? 'down' : 'up'} size={12} />
                </>
              )}
            </button>

            {/* Popover menu — upward */}
            {menuOpen && (
              <div
                role="menu"
                className="absolute bottom-full left-2 right-2 mb-1 py-1.5 rounded-[var(--rl)] bg-ck-bg1 border-[0.5px] border-ck-b1 z-50"
                style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
              >
                {apiKeyHint && !isCollapsed && (
                  <div className="px-3.5 py-2 text-[12px] text-ck-t2 truncate">
                    {apiKeyHint}
                  </div>
                )}
                <div className="border-t-[0.5px] border-ck-b1 my-1" />
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-ck-t1 hover:bg-ck-bg2 transition-colors duration-100 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-ck-t2 shrink-0" viewBox="0 0 16 16"><path d="M8 10a2 2 0 100-4 2 2 0 000 4z" fill="currentColor"/><path d="M13.3 6.8l-.8-.5.1-.9a6 6 0 00-1-1.7l-.7.4-.8-.5V2.8a6 6 0 00-2-.4v.9l-.8.5-.8-.5a6 6 0 00-1.7 1l.4.7-.5.8H3.8a6 6 0 00-.3 1h.8l.5.8-.5.8a6 6 0 001 1.7l.7-.4.8.5v.8a6 6 0 002 .3v-.8l.8-.5.8.5a6 6 0 001.7-1l-.4-.7.5-.8h.8a6 6 0 00.3-1h-.8l-.5-.8z" fill="none" stroke="currentColor" strokeWidth=".8"/></svg>
                  {labels.settings}
                </button>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-ck-t1 hover:bg-ck-bg2 transition-colors duration-100 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-ck-t2 shrink-0" viewBox="0 0 16 16"><path d="M8 2v8m-3-3l3 3 3-3M3 12h10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {labels.export}
                </button>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-ck-t1 hover:bg-ck-bg2 transition-colors duration-100 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-ck-t2 shrink-0" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.2"/><path d="M6.5 6a1.5 1.5 0 012.8.8c0 1-1.3 1-1.3 2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><circle cx="8" cy="11.5" r=".6" fill="currentColor"/></svg>
                  {labels.help}
                </button>
                <div className="border-t-[0.5px] border-ck-b1 my-1" />
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    onLogout()
                  }}
                  className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-ck-t1 hover:bg-ck-bg2 transition-colors duration-100 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-ck-t2 shrink-0" viewBox="0 0 16 16"><path d="M6 2H4a1 1 0 00-1 1v10a1 1 0 001 1h2M10.5 12l3.5-4-3.5-4M14 8H7" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {labels.logout}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Desktop sidebar */}
      <div
        className={cn(
          'hidden lg:flex flex-col bg-ck-bg2 border-r-[0.5px] border-ck-b1 shrink-0 transition-[width] duration-200 ease-claude overflow-hidden',
          collapsed ? 'w-[52px]' : 'w-[260px]',
        )}
      >
        {renderSidebarContent(collapsed)}
      </div>

      {/* Mobile overlay — always expanded */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-40 transition-opacity"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <div className="lg:hidden fixed inset-y-0 left-0 w-[280px] bg-ck-bg2 z-50 shadow-xl">
            {renderSidebarContent(false)}
          </div>
        </>
      )}
    </>
  )
}
