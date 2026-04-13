import { useState } from 'react'
import type { PendingData } from '../../types/dashboard'

interface FocusCardProps {
  pending: PendingData | null
}

export function FocusCard({ pending }: FocusCardProps) {
  const [expanded, setExpanded] = useState(false)

  if (!pending || pending.items.length === 0) return null

  const main = pending.items[0]
  const rest = pending.items.slice(1)
  const restCount = pending.total - 1

  return (
    <div>
      {/* Main card */}
      <div style={{
        marginBottom: rest.length > 0 ? '0' : '24px',
        padding: '16px 20px',
        background: 'var(--bg1)',
        border: '1px solid var(--b1)',
        borderRadius: rest.length > 0 ? '10px 10px 0 0' : '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        <div style={{
          width: '4px',
          alignSelf: 'stretch',
          borderRadius: '2px',
          background: 'var(--danger-t)',
          flexShrink: 0,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '10px',
            color: 'var(--t3)',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.4px',
            marginBottom: '2px',
          }}>
            需要处理
          </div>
          <div style={{
            fontSize: '14px',
            fontWeight: 500,
            lineHeight: 1.4,
            color: 'var(--t1)',
          }}>
            {main.title}
          </div>
          <div style={{
            fontSize: '11px',
            color: 'var(--t2)',
            marginTop: '2px',
          }}>
            {main.deadline && `截止${main.deadline}`}
            {main.progress && ` · ${main.progress}`}
            {main.skill_status && ` · ${main.skill_status}`}
          </div>
        </div>
        <a
          href={main.link}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: 'var(--t1)',
            color: 'var(--bg1)',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 500,
            flexShrink: 0,
            textDecoration: 'none',
          }}
        >
          {main.type === 'review' ? '去审核' : '去批改'}
        </a>
      </div>

      {/* Expanded extra items */}
      {rest.length > 0 && expanded && (
        <div style={{ marginTop: '-1px' }}>
          {rest.map((item, i) => (
            <a
              key={item.link || i}
              href={item.link}
              style={{
                padding: '8px 20px',
                fontSize: '12px',
                color: 'var(--t2)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'var(--bg1)',
                border: '1px solid var(--b1)',
                borderTop: 'none',
                borderRadius: i === rest.length - 1 ? '0 0 10px 10px' : '0',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              <strong style={{ color: 'var(--t1)', fontWeight: 500 }}>{item.title}</strong>
              <span style={{
                fontSize: '10px',
                color: 'var(--t3)',
                marginLeft: 'auto',
              }}>
                {item.deadline && `截止${item.deadline}`}
              </span>
            </a>
          ))}
        </div>
      )}

      {/* Toggle button */}
      {restCount > 0 && (
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            padding: expanded ? '6px 20px 10px' : '6px 20px 10px',
            fontSize: '11px',
            color: 'var(--t3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '24px',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span>{expanded ? '收起' : `还有 ${restCount} 项待处理`}</span>
        </div>
      )}

      {/* No rest items — just add bottom margin */}
      {restCount <= 0 && <div style={{ marginBottom: '24px' }} />}
    </div>
  )
}
