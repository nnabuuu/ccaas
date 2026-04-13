import { useLocation, useNavigate } from 'react-router-dom'
import { NAV_ROUTES } from './nav-config'

interface TopNavProps {
  pendingCount?: number
}

export function TopNav({ pendingCount }: TopNavProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string | null) => {
    if (!path) return false
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav className="topnav">
      <span className="topnav-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        精准教学
      </span>
      {NAV_ROUTES.map((item) => {
        const active = isActive(item.path)
        return (
          <a
            key={item.label}
            className={`topnav-link${active ? ' act' : ''}`}
            onClick={() => item.path && navigate(item.path)}
            style={{ cursor: item.path ? 'pointer' : 'default' }}
          >
            {item.label}
            {item.hasBadge && pendingCount && pendingCount > 0 ? (
              <span className="topnav-notif">{pendingCount}</span>
            ) : null}
          </a>
        )
      })}

      <style>{`
        .topnav {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 0 20px;
          height: 48px;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
        }
        @media (min-width: 1200px) {
          .topnav { display: none; }
        }

        .topnav-logo {
          font-size: 14px;
          font-weight: 700;
          margin-right: 20px;
          letter-spacing: -0.3px;
          color: var(--t1);
        }

        .topnav-link {
          font-size: 13px;
          color: var(--t2);
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.12s;
          font-weight: 500;
        }
        .topnav-link:hover { color: var(--t1); background: var(--surface2); }
        .topnav-link.act { color: var(--t1); background: var(--surface2); }

        .topnav-notif {
          font-size: 9px;
          padding: 1px 5px;
          border-radius: 4px;
          background: var(--red-bg);
          color: var(--red);
          margin-left: 2px;
          font-weight: 600;
        }
      `}</style>
    </nav>
  )
}
