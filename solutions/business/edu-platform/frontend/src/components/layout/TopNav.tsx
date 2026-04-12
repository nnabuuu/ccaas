import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const SOLUTION_URL = import.meta.env.VITE_SOLUTION_BACKEND_URL || 'http://localhost:3011'

interface NavItem {
  label: string
  path: string | null
}

const NAV_ITEMS: NavItem[] = [
  { label: '首页', path: '/' },
  { label: '教案', path: '/lesson-plans' },
  { label: '课堂', path: null },
  { label: '作业', path: null },
  { label: '学情', path: null },
  { label: '资源', path: null },
  { label: '管理', path: null },
]

export function TopNav() {
  const location = useLocation()
  const [pendingTotal, setPendingTotal] = useState<number>(0)
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${SOLUTION_URL}/api/dashboard/pending`)
      .then(r => r.json())
      .then(data => setPendingTotal(data.total ?? 0))
      .catch(() => setPendingTotal(0))
  }, [])

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '0 24px',
      height: '44px',
      borderBottom: '1px solid var(--b1)',
      background: 'var(--bg1)',
      fontFamily: '-apple-system, "SF Pro Text", "PingFang SC", sans-serif',
      flexShrink: 0,
    }}>
      <Link to="/" style={{
        fontSize: '13px',
        fontWeight: 600,
        marginRight: '16px',
        letterSpacing: '-0.3px',
        color: 'var(--t1)',
        textDecoration: 'none',
      }}>
        精准教学
      </Link>
      {NAV_ITEMS.map(item => {
        const isActive = item.path !== null && (
          item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path)
        )
        const isHovered = hoveredLabel === item.label

        const style: React.CSSProperties = {
          fontSize: '12px',
          color: isActive ? 'var(--t1)' : isHovered ? 'var(--t2)' : 'var(--t3)',
          fontWeight: isActive ? 500 : 400,
          padding: '4px 10px',
          borderRadius: '6px',
          cursor: item.path !== null ? 'pointer' : 'default',
          textDecoration: 'none',
          transition: 'all 0.12s',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px',
          background: isHovered && !isActive ? 'var(--bg2)' : 'transparent',
        }

        const badge = item.label === '作业' && pendingTotal > 0 ? (
          <span style={{
            fontSize: '9px',
            padding: '1px 4px',
            borderRadius: '4px',
            background: 'var(--danger-bg)',
            color: 'var(--danger-t)',
            marginLeft: '2px',
            fontWeight: 600,
          }}>
            {pendingTotal}
          </span>
        ) : null

        const hoverHandlers = {
          onMouseEnter: () => setHoveredLabel(item.label),
          onMouseLeave: () => setHoveredLabel(null),
        }

        if (item.path !== null) {
          return (
            <Link key={item.label} to={item.path} style={style} {...hoverHandlers}>
              {item.label}{badge}
            </Link>
          )
        }

        return (
          <span key={item.label} style={style} {...hoverHandlers}>
            {item.label}{badge}
          </span>
        )
      })}
    </nav>
  )
}
