import { useRef, useEffect } from 'react'
import { renderMd } from './renderMd'

export interface ScaffoldHint {
  level: number
  hintZh: string
  canRetry: boolean
}

interface Props {
  hints: ScaffoldHint[]
  enableMath?: boolean
  onSwitchToText?: () => void
  collapsed?: boolean
  onToggle?: () => void
}

export default function ScaffoldPanel({ hints, enableMath, onSwitchToText, collapsed, onToggle }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new hint added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [hints.length])

  if (collapsed) {
    return (
      <div className="stu-text-rail" onClick={onToggle}>
        <div className="stu-text-rail-icon" style={{ fontSize: 14 }}>?</div>
        <div className="stu-text-rail-label">提示</div>
        {hints.length > 0 && (
          <div className="stu-text-rail-badge">{hints.length}</div>
        )}
      </div>
    )
  }

  return (
    <div className="stu-text-area stu-text-overlay" data-translate-ctx="scaffold-panel">
      <div className="stu-text-inner">
        <div className="stu-text-hd">
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber, #f59e0b)', flex: 1 }}>
            提示 ({hints.length})
          </span>
          {onSwitchToText && (
            <button
              className="stu-text-hd-badge"
              style={{ cursor: 'pointer', background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: 11, color: 'var(--t2)' }}
              onClick={onSwitchToText}
            >
              查看课文
            </button>
          )}
          <button className="stu-text-close" onClick={onToggle} title="收起 (Esc)">×</button>
        </div>
        <div className="stu-text-scroll" ref={scrollRef}>
          {hints.map((hint, i) => (
            <div
              key={i}
              style={{
                padding: '12px 16px',
                marginBottom: 10,
                background: 'var(--bg2, #f8f8f8)',
                borderRadius: 8,
                borderLeft: '3px solid var(--amber, #f59e0b)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber, #f59e0b)', marginBottom: 6 }}>
                提示 {hint.level + 1}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--t1)' }}>
                {renderMd(hint.hintZh, { math: enableMath })}
              </div>
            </div>
          ))}
          {hints.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--t3)', padding: '16px 0' }}>
              暂无提示
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
