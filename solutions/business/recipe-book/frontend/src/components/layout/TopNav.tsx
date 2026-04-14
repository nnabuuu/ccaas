import { useLocation, useNavigate } from 'react-router-dom'
import { NAV_ROUTES } from './nav-config'

export function TopNav() {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => {
    if (path === '/recipes') return location.pathname === '/recipes' || location.pathname.startsWith('/recipes/')
    return location.pathname.startsWith(path)
  }

  return (
    <nav className="topnav">
      <span className="topnav-logo" onClick={() => navigate('/recipes')} style={{ cursor: 'pointer' }}>
        食谱助手
      </span>
      {NAV_ROUTES.map((item) => {
        const active = isActive(item.path)
        return (
          <a
            key={item.label}
            className={`topnav-link${active ? ' act' : ''}`}
            onClick={() => navigate(item.path)}
            style={{ cursor: 'pointer' }}
          >
            {item.label}
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
      `}</style>
    </nav>
  )
}
