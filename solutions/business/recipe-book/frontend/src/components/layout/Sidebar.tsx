import { useLocation, useNavigate } from 'react-router-dom'
import { NAV_ROUTES } from './nav-config'

const ICONS: Record<string, React.ReactNode> = {
  '食谱列表': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  ),
  'AI 对话': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
}

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => {
    if (path === '/recipes') return location.pathname === '/recipes' || location.pathname.startsWith('/recipes/')
    return location.pathname.startsWith(path)
  }

  return (
    <aside className="sidebar">
      <div className="sb-logo">食谱助手</div>

      <div className="sb-section">
        <div className="sb-label">导航</div>
        {NAV_ROUTES.map((item) => {
          const active = isActive(item.path)
          return (
            <a
              key={item.label}
              className={`sb-link${active ? ' act' : ''}`}
              onClick={() => navigate(item.path)}
              style={{ cursor: 'pointer' }}
            >
              <div className={`sb-link-icon${active ? ' sb-link-icon--active' : ''}`}>
                {ICONS[item.label]}
              </div>
              {item.label}
            </a>
          )
        })}
      </div>

      <div className="sb-spacer" />

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
          font-size: 10px;
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

        .sb-spacer { flex: 1; }
      `}</style>
    </aside>
  )
}
