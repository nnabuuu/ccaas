import { useState, useEffect, useMemo } from 'react'
import type { ClassroomState } from '../../../hooks/useClassroom'
import { useChatHistory } from '../../../hooks/useClassroom'
import { getAvatarStyle } from './depth-leaderboard-helpers'

type DepthEntry = NonNullable<ClassroomState['depthLeaderboard']>['rankings'][number]

interface Props {
  student: DepthEntry
  state: ClassroomState
  sessionCode: string
  onClose: () => void
  onStudentClick: (name: string) => void
}

type ChatThread = Array<{ role: string; content: string; seq: number; createdAt: string }>

export function DepthStudentDetail({ student, state, sessionCode, onClose, onStudentClick }: Props) {
  const { fetchHistory } = useChatHistory(sessionCode)
  const [threads, setThreads] = useState<Record<string, ChatThread> | null>(null)

  // Load chat history
  useEffect(() => {
    let cancelled = false
    fetchHistory(student.studentId).then(data => {
      if (!cancelled && data) setThreads(data)
    })
    return () => { cancelled = true }
  }, [fetchHistory, student.studentId])

  // Discuss threads sorted by step
  const discussThreads = useMemo(() => {
    if (!threads) return []
    return Object.entries(threads)
      .filter(([k]) => k.startsWith('discuss:'))
      .sort(([a], [b]) => {
        const numA = parseInt(a.split(':')[1]) || 0
        const numB = parseInt(b.split(':')[1]) || 0
        return numA - numB
      })
  }, [threads])

  // Student highlights
  const studentHighlights = useMemo(
    () => state.coaching?.highlights?.filter(h => h.studentId === student.studentId) ?? [],
    [state.coaching?.highlights, student.studentId],
  )
  const highlightTexts = useMemo(() => new Set(studentHighlights.map(h => h.message)), [studentHighlights])

  // Build TP checklist from all steps
  const tpChecklist = useMemo(() => {
    if (!state.clusterStats) return []
    const result: Array<{ id: string; label: string; hit: boolean }> = []
    const seen = new Set<string>()

    for (const [, stepData] of Object.entries(state.clusterStats)) {
      for (const def of stepData.targetPointDefs ?? []) {
        if (seen.has(def.id)) continue
        seen.add(def.id)

        const stat = stepData.targetPointStats?.find(tp => tp.targetPointId === def.id)
        const hit = stat?.students.some(s => s.studentId === student.studentId) ?? false
        result.push({ id: def.id, label: def.label, hit })
      }
    }
    return result
  }, [state.clusterStats, student.studentId])

  // Count total rounds across all threads
  const totalRounds = useMemo(() => {
    return discussThreads.reduce((sum, [, msgs]) => {
      return sum + msgs.filter(m => m.role === 'student' || m.role === 'user').length
    }, 0)
  }, [discussThreads])

  const avatarStyle = getAvatarStyle(student.rank)

  return (
    <div className="dl-d1-root">
      {/* Header */}
      <div className="dl-d1-header">
        <div className="dl-d1-title">
          <div
            className="dl-drawer-avatar"
            style={{ width: 28, height: 28, fontSize: 12, background: avatarStyle.bg, border: `2px solid ${avatarStyle.border}` }}
          >
            {student.studentName[0]}
          </div>
          {student.studentName} · 讨论详情
        </div>
        <div className="dl-stat-legend">
          <span className="dl-stat-legend-item"><span className="dl-stat-hl legend">✦</span> 亮点发言</span>
          <span className="dl-stat-legend-item"><span className="dl-stat-tp legend">●</span> 教学目标命中</span>
        </div>
        <button className="dl-d1-back" onClick={onClose}>← 返回排行</button>
      </div>

      {/* Body */}
      <div className="dl-d1-body">
        {/* Student summary bar */}
        <div className="dl-d1-student-bar">
          <div
            className="dl-drawer-avatar"
            style={{ width: 40, height: 40, fontSize: 16, background: avatarStyle.bg, border: `2px solid ${avatarStyle.border}` }}
          >
            {student.studentName[0]}
          </div>
          <div className="dl-d1-student-summary">
            <div className="dl-d1-student-name">
              {student.studentName}{' '}
              <span className="dl-d1-student-meta">
                #{student.rank} · {discussThreads.length} 次讨论 · {totalRounds} 轮对话
              </span>
            </div>
            {student.aiSummary && (
              <span><span className="dl-ai-tag">✦ AI</span>{student.aiSummary}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <span className="dl-stat-hl" style={{ fontSize: 11 }}>✦ {student.highlightCount}</span>
            <span className="dl-stat-tp" style={{ fontSize: 11 }}>● {student.tpHitCount}</span>
          </div>
        </div>

        {/* TP Checklist */}
        {tpChecklist.length > 0 && (
          <>
            <div className="dl-d1-tp-label">教学目标达成</div>
            <div className="dl-d1-tp-checklist">
              {tpChecklist.map(tp => (
                <div key={tp.id} className={`dl-d1-tp-item ${tp.hit ? 'dl-d1-tp-item--hit' : 'dl-d1-tp-item--miss'}`}>
                  {tp.hit ? '✓' : '○'} {tp.label}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Per-step discussion sections */}
        {discussThreads.map(([threadId, msgs]) => {
          const stepNum = parseInt(threadId.split(':')[1]) || 0
          const stepData = state.clusterStats?.[stepNum]

          // Count this student's highlights in this step
          const stepHighlights = studentHighlights.filter(h => h.taskNum === stepNum)
          // Count TP hits for this step
          const stepTpHits = stepData?.targetPointStats?.filter(tp =>
            tp.students.some(s => s.studentId === student.studentId),
          ).length ?? 0
          const stepTpTotal = stepData?.targetPointDefs?.length ?? 0
          const studentRounds = msgs.filter(m => m.role === 'student' || m.role === 'user').length

          // Build cluster lookup for this step
          const clusterMap = new Map<string, string>()
          for (const cluster of stepData?.clusters ?? []) {
            for (const obs of cluster.observations) {
              if (obs.studentId === student.studentId) {
                const clusterDef = stepData?.definitions?.find(d => d.id === cluster.clusterId)
                if (clusterDef) {
                  for (const span of obs.evidenceSpans) {
                    clusterMap.set(span, clusterDef.label)
                  }
                }
              }
            }
          }

          return (
            <div key={threadId} className="dl-d1-discuss-section">
              <div className="dl-d1-discuss-header">
                <span className="dl-d1-discuss-step">步骤 {stepNum}</span>
                <span className="dl-d1-discuss-title">讨论</span>
                <span className="dl-d1-discuss-meta">
                  {stepTpTotal > 0 && `🎯 ${stepTpHits}/${stepTpTotal} · `}
                  {studentRounds} 轮
                  {stepHighlights.length > 0 && ` · ✦ ${stepHighlights.length} 亮点`}
                </span>
              </div>

              <div className="dl-d1-convo">
                <div className="dl-convo">
                  {msgs.map((m, i) => {
                    const isAi = m.role === 'ai' || m.role === 'assistant'
                    const isHighlight = !isAi && highlightTexts.has(m.content)
                    // Find matching cluster annotations (deduplicated)
                    const matchedClusters = !isAi
                      ? [...new Set([...clusterMap.entries()].filter(([span]) => m.content.includes(span)).map(([, label]) => label))]
                      : []
                    // Find matching highlight with evidence
                    const matchedHighlight = !isAi ? studentHighlights.find(h => h.message === m.content) : null

                    return (
                      <div key={i}>
                        <div className={`dl-convo-role dl-convo-role--${isAi ? 'ai' : 'student'}`}>
                          {isAi ? '🤖 AI' : `${student.studentName} 👤`}
                        </div>
                        <div className={`dl-convo-bubble dl-convo-bubble--${isAi ? 'ai' : 'student'}`}>
                          {isHighlight && <span className="dl-convo-hl-badge">✦ 亮点</span>}
                          {m.content}
                          {(matchedClusters.length > 0 || matchedHighlight?.evidenceSpan) && (
                            <div className="dl-msg-badges">
                              {matchedClusters.map((label, ci) => (
                                <span key={ci} className="dl-badge-cluster">{label}</span>
                              ))}
                            </div>
                          )}
                          {matchedHighlight?.evidenceSpan && (
                            <div className="dl-badge-evidence">"{matchedHighlight.evidenceSpan}"</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* AI insight — show highlight gist for this step */}
                {stepHighlights.length > 0 && stepHighlights[0].gist && (
                  <div className="dl-convo-insight">
                    <div className="dl-convo-insight-label">✦ AI 洞察</div>
                    {stepHighlights[0].gist}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Loading state */}
        {!threads && (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--t3)', fontSize: 12 }}>
            加载对话记录中...
          </div>
        )}

        {threads && discussThreads.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--t3)', fontSize: 12 }}>
            暂无讨论记录
          </div>
        )}
      </div>
    </div>
  )
}
