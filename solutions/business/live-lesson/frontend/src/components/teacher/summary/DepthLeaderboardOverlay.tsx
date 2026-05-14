import { useState, useEffect, useMemo } from 'react'
import type { ClassroomState } from '../../../hooks/useClassroom'
import OverlayShell from '../observe/OverlayShell'
import { DepthStudentDetail } from './DepthStudentDetail'
import { getAvatarStyle, getRankColor } from './depth-leaderboard-helpers'

type DepthEntry = NonNullable<ClassroomState['depthLeaderboard']>['rankings'][number]

interface Props {
  open: boolean
  onClose: () => void
  rankings: DepthEntry[]
  state: ClassroomState
  sessionCode: string
}

export default function DepthLeaderboardOverlay({ open, onClose, rankings, state, sessionCode }: Props) {
  const [detailStudent, setDetailStudent] = useState<DepthEntry | null>(null)

  // Reset detail when overlay closes
  useEffect(() => {
    if (!open) setDetailStudent(null)
  }, [open])

  const discussCount = useMemo(() => {
    // Count unique discuss steps across clusterStats
    if (!state.clusterStats) return 0
    return Object.keys(state.clusterStats).length
  }, [state.clusterStats])

  return (
    <>
      <OverlayShell open={open} onClose={onClose} depth={0}>
        <div className="dl-drawer-root">
          {/* Header */}
          <div className="dl-drawer-header">
            <div className="dl-drawer-title">
              <span>🏆</span>
              <span>深度互动排行</span>
              <span className="dl-drawer-meta">Top {rankings.length} · {discussCount} 次讨论</span>
            </div>
            <div className="dl-stat-legend">
              <span className="dl-stat-legend-item"><span className="dl-stat-hl legend">✦</span> 亮点发言</span>
              <span className="dl-stat-legend-item"><span className="dl-stat-tp legend">●</span> 教学目标命中</span>
            </div>
            <button className="dl-drawer-close" onClick={onClose}>✕ 关闭</button>
          </div>

          {/* Body — ranking list */}
          <div className="dl-drawer-body">
            <div className="dl-drawer-list">
              {rankings.map(entry => {
                const avatarStyle = getAvatarStyle(entry.rank)
                const rankColor = getRankColor(entry.rank)
                const isActive = detailStudent?.studentId === entry.studentId

                return (
                  <div
                    key={entry.studentId}
                    className={`dl-drawer-row${isActive ? ' dl-drawer-row--active' : ''}`}
                    onClick={() => setDetailStudent(entry)}
                  >
                    <div
                      className="dl-drawer-avatar"
                      style={{ background: avatarStyle.bg, border: `2px solid ${avatarStyle.border}` }}
                    >
                      {entry.studentName[0]}
                    </div>
                    <div className="dl-drawer-info">
                      <div className="dl-drawer-name-row">
                        <span className="dl-drawer-rank-num" style={{ background: rankColor }}>{entry.rank}</span>
                        <span className="dl-drawer-name">{entry.studentName}</span>
                      </div>
                      {entry.aiSummary && (
                        <div className="dl-drawer-summary">
                          <span className="dl-ai-tag">✦ AI</span>{entry.aiSummary}
                        </div>
                      )}
                    </div>
                    <div className="dl-drawer-stats">
                      <span className="dl-stat-hl">✦ {entry.highlightCount}</span>
                      <span className="dl-stat-tp">● {entry.tpHitCount}</span>
                    </div>
                    <span className="dl-expand-arrow">▸</span>
                  </div>
                )
              })}
            </div>
            <div className="dl-refresh-hint" style={{ marginTop: 8 }}>✦ AI 总结每 30s 刷新一次</div>
          </div>
        </div>
      </OverlayShell>

      {/* Depth-1: Student detail */}
      <OverlayShell open={!!detailStudent} onClose={() => setDetailStudent(null)} depth={1}>
        {detailStudent && (
          <DepthStudentDetail
            student={detailStudent}
            state={state}
            sessionCode={sessionCode}
            onClose={() => setDetailStudent(null)}
          />
        )}
      </OverlayShell>
    </>
  )
}
