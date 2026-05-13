import { useMemo } from 'react'
import type { ClassroomState } from '../../hooks/useClassroom'
import OverlayShell from './observe/OverlayShell'
import { getStudentGlobalStatus } from './teacher-helpers'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

type StudentStatus = 'active' | 'struggling' | 'stuck' | 'cruising' | 'idle'

interface Props {
  open: boolean
  onClose: () => void
  state: ClassroomState
  onStudentClick: (name: string) => void
}

export default function ClassroomStatusDrawer({ open, onClose, state, onStudentClick }: Props) {
  const alerts = state.observation?.alerts ?? []
  const llmInsights = state.coaching?.llmInsights ?? null
  const indicatorStats = state.observation?.indicatorStats ?? []
  const totalStudents = state.students.length

  // Student status chips — map from global status to drawer status
  const statusChips = useMemo(() => {
    const severityOrder: Record<string, number> = { urgent: 0, warn: 1, info: 2 }
    const alertMap = new Map<string, typeof alerts[number]>()
    for (const a of alerts) {
      if (!a.studentName) continue
      const existing = alertMap.get(a.studentName)
      if (!existing || (severityOrder[a.severity] ?? 2) < (severityOrder[existing.severity] ?? 2)) {
        alertMap.set(a.studentName, a)
      }
    }
    const chips: Array<{ name: string; status: StudentStatus }> = []
    for (const s of state.students) {
      const globalStatus = getStudentGlobalStatus(s)
      let chipStatus: StudentStatus
      switch (globalStatus) {
        case 'done': chipStatus = 'active'; break
        case 'prog': chipStatus = 'active'; break
        case 'stuck': chipStatus = 'stuck'; break
        case 'reading': chipStatus = 'cruising'; break
        default: chipStatus = 'idle'
      }
      // Override with alert info if available
      const alert = alertMap.get(s.name)
      if (alert) {
        if (alert.severity === 'urgent') chipStatus = 'stuck'
        else if (alert.severity === 'warn') chipStatus = 'struggling'
      }
      chips.push({ name: s.name, status: chipStatus })
    }
    // Sort: stuck first, then struggling, then others
    const order: Record<StudentStatus, number> = { stuck: 0, struggling: 1, active: 2, cruising: 3, idle: 4 }
    return chips.sort((a, b) => order[a.status] - order[b.status])
  }, [state.students, alerts])

  // Event timeline from observation logs (all types)
  const timeline = useMemo(() => {
    const items: Array<{
      timestamp: number
      studentName: string
      text: string
      type: 'alert' | 'exercise' | 'discuss'
    }> = []

    if (state.observation?.logs) {
      for (const log of state.observation.logs) {
        for (const evt of log.events) {
          let type: 'alert' | 'exercise' | 'discuss' = 'discuss'
          let text = evt.gist

          if (evt.source === 'system') {
            if (evt.systemType === 'status_change' || evt.systemType === 'stuck' || evt.systemType === 'idle') {
              type = 'alert'
            } else if (evt.systemType === 'exercise_submit' || evt.systemType === 'step_complete') {
              type = 'exercise'
              text = evt.gist || `完成练习`
            } else if (evt.systemType === 'discuss_depth') {
              type = 'discuss'
            } else {
              type = 'exercise'
            }
          } else if (evt.source === 'llm') {
            type = 'discuss'
          }

          items.push({
            timestamp: evt.timestamp,
            studentName: log.studentName,
            text,
            type,
          })
        }
      }
    }

    // Sort descending (newest first)
    return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 30)
  }, [state.observation])

  return (
    <OverlayShell open={open} onClose={onClose} depth={0}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div className="drawer-header">
          <span className="title">课堂状态 · 全景观察</span>
          <button className="drawer-close" onClick={onClose}>✕ 关闭</button>
        </div>

        {/* Body */}
        <div className="drawer-body">
          <div className="drawer-cols">
            {/* ── Left Column: Status + Alerts + AI Insights ── */}
            <div>
              {/* Student Status Chips */}
              <div className="subsection">学生状态 (LLM 分级)</div>
              <div className="status-chips" style={{ marginBottom: 12 }}>
                {statusChips.map(chip => (
                  <span
                    key={chip.name}
                    className={`s-chip ${chip.status}`}
                    onClick={() => onStudentClick(chip.name)}
                  >
                    {chip.name}
                  </span>
                ))}
              </div>

              {/* Full Alert List */}
              {alerts.length > 0 && (
                <>
                  <div className="subsection">完整告警列表</div>
                  {alerts
                    .sort((a, b) => {
                      const order: Record<string, number> = { urgent: 0, warn: 1, info: 2 }
                      return (order[a.severity] ?? 2) - (order[b.severity] ?? 2)
                    })
                    .map((alert, i) => (
                      <div key={i} className="alert-item">
                        <div className={`alert-dot ${alert.severity}`} />
                        <div className="alert-text">
                          <div className="alert-title">
                            {alert.studentName && (
                              <span
                                style={{ color: 'var(--blue)', cursor: 'pointer', marginRight: 4 }}
                                onClick={() => onStudentClick(alert.studentName)}
                              >
                                {alert.studentName}
                              </span>
                            )}
                            {alert.message}
                          </div>
                        </div>
                      </div>
                    ))}
                </>
              )}

              {/* AI Insight History */}
              {llmInsights && llmInsights.insights.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="subsection">AI 洞察历史</div>
                  {llmInsights.insights.map((ins, i) => (
                    <div key={i} className="insight-card">
                      <div className="insight-header">
                        <span>{ins.title}</span>
                        <span style={{ fontWeight: 500, color: 'var(--t3)' }}>
                          {new Date(llmInsights.generatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="insight-body">{ins.detail}</div>
                      {ins.suggestedAction && <div className="insight-action">→ {ins.suggestedAction}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Right Column: Event Timeline + Indicator Matrix ── */}
            <div>
              {/* Event Timeline */}
              <div className="subsection">事件时间线 (全班)</div>
              <p style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 8 }}>
                所有观察事件按时间倒序
              </p>

              {timeline.length > 0 ? (
                <div className="drawer-timeline">
                  {timeline.map((item, i) => (
                    <div key={i} className={`drawer-tl-item ${item.type}`}>
                      <div className="drawer-tl-time">{formatTime(item.timestamp)}</div>
                      <div className="drawer-tl-text">
                        <strong
                          onClick={() => onStudentClick(item.studentName)}
                          style={{ cursor: 'pointer' }}
                        >
                          {item.studentName}
                        </strong>
                        {' '}{item.text}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)', fontSize: 11 }}>
                  暂无事件记录
                </div>
              )}

              {/* Knowledge Indicator Detail Matrix */}
              {indicatorStats.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="subsection">知识指标详情</div>
                  <table className="matrix-table">
                    <thead>
                      <tr>
                        <th>指标</th>
                        <th>类型</th>
                        <th>命中人数</th>
                        <th>占比</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indicatorStats
                        .sort((a, b) => b.studentCount - a.studentCount)
                        .map(ind => {
                          const pct = totalStudents > 0 ? Math.round((ind.studentCount / totalStudents) * 100) : 0
                          return (
                            <tr key={ind.indicatorId}>
                              <td className="student-name">{ind.label}</td>
                              <td style={{ color: ind.type === 'knowledge' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                                {ind.type === 'knowledge' ? '知识' : '误解'}
                              </td>
                              <td>{ind.studentCount}/{totalStudents}</td>
                              <td>{pct}%</td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </OverlayShell>
  )
}
