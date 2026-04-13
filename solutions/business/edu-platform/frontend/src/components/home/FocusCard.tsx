import { useState } from 'react'
import type { PendingData } from '../../types/dashboard'

interface FocusCardProps {
  pending: PendingData | null
}

export function FocusCard({ pending }: FocusCardProps) {
  const [expanded, setExpanded] = useState(false)

  if (!pending || pending.items.length === 0) return null

  const firstItem = pending.items[0]
  const remainingItems = pending.items.slice(1)
  const remainingCount = pending.total - 1

  const actionLabel = firstItem.type === 'grading' ? '去批改' : '去处理'

  return (
    <div>
      <div className="focus">
        <div className="focus-bar" />
        <div className="focus-body">
          <div className="focus-label">需要处理</div>
          <div className="focus-title">{firstItem.title}</div>
          <div className="focus-meta">
            {firstItem.deadline} · {firstItem.progress} · {firstItem.skill_status}
          </div>
        </div>
        {firstItem.link && (
          <a className="focus-btn" href={firstItem.link}>
            {actionLabel}
          </a>
        )}
      </div>

      {remainingCount > 0 && (
        <>
          <div className="focus-more" onClick={() => setExpanded(!expanded)}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <span>{expanded ? '收起' : `还有 ${remainingCount} 项待处理`}</span>
          </div>
          {expanded && (
            <div className="focus-extra">
              {remainingItems.map((item, i) => (
                <a
                  key={i}
                  className="focus-extra-item"
                  href={item.link || undefined}
                  style={{ textDecoration: 'none' }}
                >
                  <strong>{item.title}</strong>
                  <span className="focus-extra-meta">{item.deadline}</span>
                </a>
              ))}
            </div>
          )}
        </>
      )}

      <style>{`
        .focus {
          margin-bottom: 8px;
          padding: 16px 20px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .focus-bar {
          width: 4px;
          align-self: stretch;
          border-radius: 2px;
          background: var(--red);
          flex-shrink: 0;
        }
        .focus-body { flex: 1; }
        .focus-label {
          font-size: 10px;
          color: var(--t3);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 2px;
        }
        .focus-title {
          font-size: 14px;
          font-weight: 500;
          line-height: 1.4;
          color: var(--t1);
        }
        .focus-meta {
          font-size: 11px;
          color: var(--t2);
          margin-top: 2px;
        }
        .focus-btn {
          padding: 8px 16px;
          border-radius: 6px;
          border: none;
          background: var(--t1);
          color: var(--surface);
          font-size: 12px;
          cursor: pointer;
          font-family: inherit;
          font-weight: 500;
          flex-shrink: 0;
          text-decoration: none;
          display: inline-block;
        }
        .focus-btn:hover { opacity: 0.85; }
        .focus-more {
          padding: 6px 20px 10px;
          font-size: 11px;
          color: var(--t3);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 24px;
        }
        .focus-more:hover { color: var(--t2); }
        .focus-extra { margin: -4px 0 24px; }
        .focus-extra-item {
          padding: 8px 20px;
          font-size: 12px;
          color: var(--t2);
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-top: none;
          border-radius: 0 0 10px 10px;
          margin-top: -1px;
          cursor: pointer;
        }
        .focus-extra-item:first-child { border-radius: 0; }
        .focus-extra-item strong {
          color: var(--t1);
          font-weight: 500;
        }
        .focus-extra-meta {
          font-size: 10px;
          color: var(--t3);
          margin-left: auto;
        }
      `}</style>
    </div>
  )
}
