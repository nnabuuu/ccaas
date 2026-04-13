import { useLocation, useNavigate } from 'react-router-dom'
import { useEduAuth } from '../../hooks/useEduAuth'

interface NavItem {
  label: string
  path: string | null
  icon: React.ReactNode
  badge?: number
}

const NAV_ITEMS: NavItem[] = [
  {
    label: '首页',
    path: '/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: '教案',
    path: '/lesson-plans',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    label: '课堂',
    path: null,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    label: '作业',
    path: null,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    label: '学情',
    path: null,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    label: '资源',
    path: null,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      </svg>
    ),
  },
]

const MANAGE_ITEMS: NavItem[] = [
  {
    label: '管理',
    path: null,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
]

interface SidebarProps {
  pendingCount?: number
}

export function Sidebar({ pendingCount }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const auth = useEduAuth()
  const userName = auth.user?.name ?? '老师'
  const initial = userName.charAt(0)

  const isActive = (path: string | null) => {
    if (!path) return false
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const handleClick = (item: NavItem) => {
    if (item.path) navigate(item.path)
  }

  const renderItem = (item: NavItem) => {
    const active = isActive(item.path)
    const showBadge = item.label === '作业' && pendingCount && pendingCount > 0
    return (
      <a
        key={item.label}
        className={`sb-link${active ? ' act' : ''}`}
        onClick={() => handleClick(item)}
        style={{ cursor: item.path ? 'pointer' : 'default' }}
      >
        <div className={`sb-link-icon${active ? ' sb-link-icon--active' : ''}`}>
          {item.icon}
        </div>
        {item.label}
        {showBadge && <span className="sb-notif">{pendingCount}</span>}
      </a>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sb-logo">精准教学</div>

      <div className="sb-section">
        <div className="sb-label">导航</div>
        {NAV_ITEMS.map(renderItem)}
      </div>

      <div className="sb-section">
        <div className="sb-label">管理</div>
        {MANAGE_ITEMS.map(renderItem)}
      </div>

      <div className="sb-spacer" />

      <div className="sb-user">
        <div className="sb-avatar">{initial}</div>
        <div>
          <div className="sb-user-name">{userName}</div>
          <div className="sb-user-role">数学 · 八年级</div>
        </div>
      </div>

      <style>{`
        .sidebar {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: var(--sidebar-w);
          background: var(--surface);
          border-right: 1px solid var(--border);
          flex-direction: column;
          padding: 20px 0;
          z-index: 100;
          overflow-y: auto;
        }
        @media (min-width: 1200px) {
          .sidebar { display: flex; }
        }

        .sb-logo {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.3px;
          padding: 0 20px;
          margin-bottom: 28px;
          color: var(--t1);
        }

        .sb-section { margin-bottom: 20px; }

        .sb-label {
          font-size: 9px;
          font-weight: 600;
          color: var(--t3);
          text-transform: uppercase;
          letter-spacing: 0.6px;
          padding: 0 20px;
          margin-bottom: 6px;
        }

        .sb-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 20px;
          font-size: 13px;
          color: var(--t2);
          cursor: pointer;
          transition: all 0.1s;
          text-decoration: none;
          font-weight: 500;
          position: relative;
          height: 36px;
          box-sizing: border-box;
        }
        .sb-link:hover { color: var(--t1); background: var(--surface2); }
        .sb-link.act { color: var(--t1); background: var(--surface2); }
        .sb-link.act::before {
          content: '';
          position: absolute;
          left: 0;
          top: 6px;
          bottom: 6px;
          width: 3px;
          border-radius: 0 2px 2px 0;
          background: var(--t1);
        }

        .sb-link-icon {
          width: 20px;
          height: 20px;
          border-radius: 5px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: var(--surface2);
        }
        .sb-link-icon svg { width: 12px; height: 12px; }
        .sb-link.act .sb-link-icon {
          background: var(--t1);
          color: var(--surface);
        }

        .sb-notif {
          font-size: 9px;
          padding: 1px 5px;
          border-radius: 4px;
          background: var(--red-bg);
          color: var(--red);
          margin-left: auto;
          font-weight: 600;
        }

        .sb-spacer { flex: 1; }

        .sb-user {
          padding: 12px 20px;
          border-top: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 8px;
        }

        .sb-avatar {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: var(--surface2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
          color: var(--t2);
          flex-shrink: 0;
        }

        .sb-user-name { font-size: 12px; font-weight: 500; }
        .sb-user-role { font-size: 10px; color: var(--t3); }
      `}</style>
    </aside>
  )
}
