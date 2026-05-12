import { useMemo } from 'react'
import type { ObserveData } from '../ObserveDrawer'
import { formatTime } from '../observe-helpers'

interface DiscussStudentData extends ObserveData {
  stats: { avgRounds: number; avgTime: number; goalReachedRate: number }
  students: Array<{
    id: string; name: string; method: 'socratic' | 'fallback'
    goalReached: boolean; roundsUsed: number; timeUsedSeconds: number
    completionType: string
    conversation: Array<{ role: 'ai' | 'student'; text: string; round?: number }>
    keyInsights: string[]
    clusterHits?: Array<{ id: string; label: string; hit: boolean }>
  }>
}

interface Props {
  data: ObserveData
  studentId: string
  onBack?: () => void
}

const COMPLETION_LABELS: Record<string, string> = {
  goal_reached: '达标',
  max_rounds: '轮次用尽',
  fallback_rounds: '兜底选择',
}

export default function DiscussStudentView({ data, studentId }: Props) {
  const d = data as DiscussStudentData
  const classStats = (d.stats || {}) as DiscussStudentData['stats']
  const students = d.students || []
  const student = students.find(s => s.id === studentId)

  const conversation = useMemo(() => student?.conversation || [], [student?.conversation])

  const enrichedMessages = useMemo(() => {
    let prevRound = 0
    return conversation.map((msg, i) => {
      const msgRound = msg.round ?? (Math.floor(i / 2) + 1)
      const showRoundMarker = msgRound > prevRound
      if (showRoundMarker) prevRound = msgRound
      return { ...msg, idx: i, showRoundMarker, roundNum: msgRound }
    })
  }, [conversation])

  if (!student) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--t3)' }}>未找到该学生数据</div>
      </div>
    )
  }

  const isFallback = student.completionType === 'fallback_rounds' || student.method === 'fallback'
  const isReached = student.goalReached && !isFallback
  const completionLabel = COMPLETION_LABELS[student.completionType] || student.completionType || '—'

  // Status badge
  const statusBadge = isReached
    ? { label: '已达标', color: 'var(--green)', bg: 'var(--green-soft)' }
    : isFallback
      ? { label: '兜底', color: 'var(--amber)', bg: 'var(--amber-soft)' }
      : { label: '未达标', color: 'var(--red)', bg: 'var(--red-soft)' }

  // Status card
  let statusCard: { cls: string; title: string; body: string }
  if (isReached) {
    statusCard = { cls: 'green', title: '✓ 对话达标', body: '通过苏格拉底对话达成理解目标' }
  } else if (isFallback) {
    statusCard = { cls: 'amber', title: '△ 选择题通过', body: '对话轮次用尽后通过兜底选择题完成' }
  } else {
    statusCard = { cls: 'red', title: '✗ 未达标', body: '未能在规定轮次内达成理解目标' }
  }

  // Class comparison normalization
  const classAvgRounds = classStats.avgRounds ?? 0
  const classAvgTime = classStats.avgTime ?? 0
  const goalReachedRate = classStats.goalReachedRate ?? 0
  const maxRounds = Math.max(student.roundsUsed || 0, classAvgRounds, 1)
  const maxTime = Math.max(student.timeUsedSeconds || 0, classAvgTime, 1)

  return (
    <div className="observe-split">
      {/* Left: header + conversation */}
      <div className="observe-split-left">
        {/* Status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{
            fontSize: 10, fontWeight: 600, marginLeft: 'auto',
            padding: '1px 6px', borderRadius: 3,
            background: statusBadge.bg, color: statusBadge.color,
          }}>
            {statusBadge.label}
          </span>
        </div>

        {/* Stats grid */}
        <div className="obs-stats-grid cols-3">
          <div className="obs-stat-cell">
            <div className="obs-stat-v">{student.roundsUsed ?? '—'}</div>
            <div className="obs-stat-lb">轮次</div>
          </div>
          <div className="obs-stat-cell">
            <div className="obs-stat-v">{student.timeUsedSeconds != null ? formatTime(student.timeUsedSeconds) : '—'}</div>
            <div className="obs-stat-lb">用时</div>
          </div>
          <div className="obs-stat-cell">
            <div className="obs-stat-v" style={{ fontSize: 13 }}>{completionLabel}</div>
            <div className="obs-stat-lb">结束方式</div>
          </div>
        </div>

        {/* Conversation replay */}
        <div className="m2-section-h">对话回放</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {enrichedMessages.map(msg => (
            <div key={msg.idx}>
              {msg.showRoundMarker && (
                <div className="obs-round-marker">
                  <span>Round {msg.roundNum}</span>
                </div>
              )}
              <div className={`chat-row ${msg.role === 'student' ? 'stu' : 'ai'}`} style={msg.role === 'ai' ? { display: 'flex', alignItems: 'flex-start', gap: 6 } : undefined}>
                {msg.role === 'ai' && (
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--ai)', color: '#fff', fontSize: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, marginTop: 2,
                  }}>S</div>
                )}
                <div className="chat-bubble">{msg.text}</div>
              </div>
            </div>
          ))}

          {/* Goal reached celebration */}
          {student.goalReached && conversation.length > 0 && (
            <div className="obs-goal-reached">
              ✓ 学生已达成理解目标
            </div>
          )}

          {conversation.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>暂无对话记录</div>
          )}
        </div>
      </div>

      {/* Right: status + insights + comparison */}
      <div className="observe-split-right">
        {/* Method card */}
        <div className={`obs-status-card ${statusCard.cls}`}>
          <div className="obs-sc-title">{statusCard.title}</div>
          <div className="obs-sc-body">{statusCard.body}</div>
        </div>

        {/* Cluster hits */}
        {student.clusterHits && student.clusterHits.length > 0 && (
          <>
            <div className="m2-section-h">维度探索</div>
            <div className="obs-stu-clusters">
              {student.clusterHits.map(c => (
                <div key={c.id} className={`obs-sc-dot ${c.hit ? 'hit' : ''}`} title={c.label}>
                  {c.label}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Key insights */}
        <div className="m2-section-h">关键发现</div>
        {(student.keyInsights || []).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
            {student.keyInsights.map((insight: string, i: number) => (
              <div key={i} style={{
                fontSize: 11, color: 'var(--t2)', lineHeight: 1.4,
                padding: '6px 8px', background: 'var(--bg)', borderRadius: 5,
                borderLeft: '2px solid var(--amber-dot)',
              }}>{insight}</div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 16 }}>暂无</div>
        )}

        {/* Class comparison */}
        <div className="m2-section-h">班级对比</div>
        <div className="class-compare">
          {/* Rounds comparison */}
          <div className="cc-row">
            <div className="cc-label">轮次</div>
            <div className="cc-bar-wrap">
              <div className="cc-bar-bg" />
              <div className="cc-bar-class" style={{ width: `${(classAvgRounds / maxRounds) * 100}%` }} />
              <div className="cc-bar-student" style={{
                width: `${((student.roundsUsed || 0) / maxRounds) * 100}%`,
                background: isReached ? 'var(--green-dot)' : 'var(--amber-dot)',
              }} />
            </div>
            <div className="cc-val">{student.roundsUsed ?? '—'}</div>
          </div>

          {/* Time comparison */}
          <div className="cc-row">
            <div className="cc-label">用时</div>
            <div className="cc-bar-wrap">
              <div className="cc-bar-bg" />
              <div className="cc-bar-class" style={{ width: `${(classAvgTime / maxTime) * 100}%` }} />
              <div className="cc-bar-student" style={{
                width: `${((student.timeUsedSeconds || 0) / maxTime) * 100}%`,
                background: isReached ? 'var(--green-dot)' : 'var(--amber-dot)',
              }} />
            </div>
            <div className="cc-val">{student.timeUsedSeconds ? formatTime(student.timeUsedSeconds) : '—'}</div>
          </div>

          {/* Goal reached rate */}
          <div className="cc-row">
            <div className="cc-label">达标率</div>
            <div className="cc-bar-wrap">
              <div className="cc-bar-bg" />
              <div className="cc-bar-class" style={{
                width: `${Math.round(goalReachedRate * 100)}%`,
                background: 'var(--green-dot)', opacity: 0.3,
              }} />
              <div className="cc-marker" style={{
                left: `${Math.round(goalReachedRate * 100)}%`,
                background: 'var(--green-dot)',
              }} />
              {/* Student own status marker */}
              {student.goalReached && (
                <div style={{
                  position: 'absolute', right: 0, top: 3,
                  width: 6, height: 6, borderRadius: '50%',
                  background: isReached ? 'var(--green-dot)' : 'var(--amber-dot)',
                }} />
              )}
            </div>
            <div className="cc-val">{Math.round(goalReachedRate * 100)}%</div>
          </div>

          <div className="cc-legend">
            <div className="cc-legend-item">
              <span className="d" style={{ background: 'var(--border-strong)', opacity: 0.5 }} />
              班级均值
            </div>
            <div className="cc-legend-item">
              <span className="d" style={{ background: isReached ? 'var(--green-dot)' : 'var(--amber-dot)' }} />
              该学生
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
