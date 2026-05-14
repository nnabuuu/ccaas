import { useState, useEffect } from 'react'
import type { ClassroomState } from '../../../hooks/useClassroom'
import { useChatHistory } from '../../../hooks/useClassroom'

type DepthEntry = NonNullable<ClassroomState['depthLeaderboard']>['rankings'][number]

interface Props {
  rankings: DepthEntry[]
  generatedAt: number
  coaching: ClassroomState['coaching']
  clusterStats: ClassroomState['clusterStats']
  sessionCode: string
  onStudentClick: (name: string) => void
  onExpandOverlay: () => void
}

const RANK_CLASSES = ['', 'dl-rank--1', 'dl-rank--2', 'dl-rank--3', 'dl-rank--4', 'dl-rank--5']
const AVATAR_CLASSES = ['', 'dl-avatar--1', 'dl-avatar--2', 'dl-avatar--3', 'dl-avatar--4', 'dl-avatar--5']

function rankClass(rank: number) { return RANK_CLASSES[rank] || 'dl-rank--default' }
function avatarClass(rank: number) { return AVATAR_CLASSES[rank] || 'dl-avatar--default' }

export function DepthLeaderboardCard({ rankings, generatedAt, coaching, clusterStats, sessionCode, onStudentClick, onExpandOverlay }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(rankings[0]?.studentId ?? null)

  if (rankings.length === 0) {
    return (
      <div>
        <div className="dl-header">
          <span className="dl-header-icon">🏆</span>
          <span className="dl-header-title">深度互动排行</span>
        </div>
        <div className="dl-empty">
          <div className="dl-empty-icon">💬</div>
          <div className="dl-empty-title">暂无讨论数据</div>
          <div className="dl-empty-desc">课堂讨论开始后，将自动生成深度互动排行</div>
        </div>
      </div>
    )
  }

  // Few-students layout (1-2)
  if (rankings.length <= 2) {
    return (
      <div>
        <div className="dl-header">
          <span className="dl-header-icon">🏆</span>
          <span className="dl-header-title">深度互动排行</span>
          <span className="dl-header-count">Top {rankings.length}</span>
        </div>
        <div className="dl-few-list">
          {rankings.map(entry => (
            <div key={entry.studentId} className="dl-few-row" onClick={() => onStudentClick(entry.studentName)}>
              <div className={`dl-rank ${rankClass(entry.rank)}`}>{entry.rank}</div>
              <div className={`dl-avatar ${avatarClass(entry.rank)}`}>{entry.studentName[0]}</div>
              <div className="dl-name">{entry.studentName}</div>
              <div className="dl-stats">
                <span className="dl-stat-hl">✦ {entry.highlightCount}</span>
                <span className="dl-stat-tp">● {entry.tpHitCount}</span>
              </div>
            </div>
          ))}
          {rankings[0]?.aiSummary && (
            <div className="dl-few-summary">
              <span className="dl-ai-tag">✦ AI</span>{rankings[0].aiSummary}
            </div>
          )}
        </div>
        <div style={{ padding: '0 12px 8px' }}>
          <button className="dl-expand-btn" onClick={onExpandOverlay}>展开 ↗</button>
        </div>
        <div className="dl-refresh-hint">✦ AI 总结每 30s 刷新一次</div>
      </div>
    )
  }

  return (
    <div>
      <div className="dl-header">
        <span className="dl-header-icon">🏆</span>
        <span className="dl-header-title">深度互动排行</span>
        <span className="dl-header-count">Top {rankings.length}</span>
        <span style={{ flex: 1 }} />
        <div className="dl-stat-legend">
          <span className="dl-stat-legend-item"><span className="dl-stat-hl legend">✦</span> 亮点</span>
          <span className="dl-stat-legend-item"><span className="dl-stat-tp legend">●</span> 目标</span>
        </div>
      </div>

      <div className="dl-list">
        {rankings.map(entry => {
          const isExpanded = expandedId === entry.studentId
          return (
            <div key={entry.studentId}>
              <div
                className="dl-row"
                onClick={() => setExpandedId(isExpanded ? null : entry.studentId)}
              >
                <div className={`dl-rank ${rankClass(entry.rank)}`}>{entry.rank}</div>
                <div className={`dl-avatar ${avatarClass(entry.rank)}`}>{entry.studentName[0]}</div>
                <div className="dl-name">{entry.studentName}</div>
                <div className="dl-stats">
                  <span className="dl-stat-hl">✦ {entry.highlightCount}</span>
                  <span className="dl-stat-tp">● {entry.tpHitCount}</span>
                </div>
                <span className={`dl-expand-arrow${isExpanded ? ' open' : ''}`}>▸</span>
              </div>
              {isExpanded && (
                <ExpandPanel
                  entry={entry}
                  coaching={coaching}
                  clusterStats={clusterStats}
                  sessionCode={sessionCode}
                  onStudentClick={onStudentClick}
                />
              )}
            </div>
          )
        })}
      </div>

      <div style={{ padding: '0 12px 8px' }}>
        <button className="dl-expand-btn" onClick={onExpandOverlay}>展开 ↗</button>
      </div>
      <div className="dl-refresh-hint">✦ AI 总结每 30s 刷新一次</div>
    </div>
  )
}

// Lazily-loaded expand panel with chat history
function ExpandPanel({ entry, coaching, clusterStats, sessionCode, onStudentClick }: {
  entry: DepthEntry
  coaching: ClassroomState['coaching']
  clusterStats: ClassroomState['clusterStats']
  sessionCode: string
  onStudentClick: (name: string) => void
}) {
  const { fetchHistory } = useChatHistory(sessionCode)
  const [messages, setMessages] = useState<Array<{ role: string; content: string }> | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchHistory(entry.studentId).then(data => {
      if (cancelled || !data) return
      const threads = Object.entries(data)
        .filter(([k]) => k.startsWith('discuss:'))
        .sort(([a], [b]) => a.localeCompare(b))
      if (threads.length === 0) return
      const lastThread = threads[threads.length - 1][1]
      setMessages(lastThread.map(m => ({ role: m.role, content: m.content })))
    })
    return () => { cancelled = true }
  }, [fetchHistory, entry.studentId])

  // Find highlights for this student
  const studentHighlights = coaching?.highlights?.filter(h => h.studentId === entry.studentId) ?? []
  const highlightTexts = new Set(studentHighlights.map(h => h.message))

  return (
    <div className="dl-expand">
      {entry.aiSummary && (
        <div className="dl-ai-summary">
          <span className="dl-ai-tag">✦ AI</span>{entry.aiSummary}
        </div>
      )}
      {messages && messages.length > 0 && (
        <div className="dl-convo">
          {messages.slice(-6).map((m, i) => {
            const isAi = m.role === 'ai' || m.role === 'assistant'
            const isHighlight = !isAi && highlightTexts.has(m.content)
            return (
              <div key={i}>
                <div className={`dl-convo-role dl-convo-role--${isAi ? 'ai' : 'student'}`}>
                  {isAi ? '🤖 AI' : `${entry.studentName} 👤`}
                </div>
                <div className={`dl-convo-bubble dl-convo-bubble--${isAi ? 'ai' : 'student'}`}>
                  {isHighlight && <span className="dl-convo-hl-badge">✦ 亮点</span>}
                  {m.content}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {studentHighlights.length > 0 && studentHighlights[0].gist && (
        <div className="dl-convo-insight">
          <div className="dl-convo-insight-label">✦ AI 洞察</div>
          {studentHighlights[0].gist}
        </div>
      )}
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        <span
          style={{ fontSize: 11, color: 'var(--blue)', cursor: 'pointer', fontWeight: 600 }}
          onClick={() => onStudentClick(entry.studentName)}
        >
          查看详情 →
        </span>
      </div>
    </div>
  )
}
