import { useState, useMemo } from 'react'
import type { ClassroomState } from '../../hooks/useClassroom'
import { clusterQuestions, getCatBadgeClass, formatRelative, stripDiscussTag } from './teacher-helpers'

interface Props {
  state: ClassroomState
  stepNames: Record<number, string>
  questions: ClassroomState['questions']
  onStudentClick: (name: string) => void
}

export function DiscussInsightTab({ state, stepNames, questions, onStudentClick }: Props) {
  const [expandedQ, setExpandedQ] = useState<string | null>(null)

  // ── Cluster Stats (LLM-classified) ──
  const hasClusterStats = state.clusterStats && Object.keys(state.clusterStats).length > 0

  // ── Discussion feed (observation logs discuss events + discuss questions) ──
  const discussFeed = useMemo(() => {
    const entries: Array<{ studentName: string; msg: string; timestamp: number; type: 'obs' | 'question' }> = []

    // From observation logs: discuss-related events
    if (state.observation?.logs) {
      for (const log of state.observation.logs) {
        for (const evt of log.events) {
          if (evt.source === 'llm' || (evt.source === 'system' && evt.systemType === 'discuss_depth')) {
            entries.push({
              studentName: log.studentName,
              msg: evt.gist,
              timestamp: evt.timestamp,
              type: 'obs',
            })
          }
        }
      }
    }

    // From questions with category 'discuss'
    for (const q of questions) {
      if (q.category === 'discuss') {
        entries.push({
          studentName: q.studentName,
          msg: stripDiscussTag(q.question),
          timestamp: new Date(q.timestamp).getTime(),
          type: 'question',
        })
      }
    }

    return entries.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10)
  }, [state.observation, questions])

  // ── Fallback text-similarity clustering ──
  const askQuestions = useMemo(() => questions.filter(q => q.category !== 'discuss'), [questions])

  const clusteredQuestions = useMemo(() => {
    const byStep: Record<number, typeof askQuestions> = {}
    for (const q of askQuestions) {
      const s = q.step ?? 0
      if (!byStep[s]) byStep[s] = []
      byStep[s].push(q)
    }
    return Object.entries(byStep)
      .map(([step, qs]) => ({
        step: Number(step),
        clusters: clusterQuestions(qs),
        total: qs.length,
      }))
      .sort((a, b) => a.step - b.step)
  }, [askQuestions])

  const totalAskQuestions = useMemo(
    () => clusteredQuestions.reduce((sum, g) => sum + g.total, 0),
    [clusteredQuestions],
  )

  const isEmpty = !hasClusterStats && totalAskQuestions === 0 && discussFeed.length === 0

  if (isEmpty) {
    return (
      <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
        暂无讨论数据…学生开始讨论后将自动显示洞察
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 14px' }}>
      {/* ── Cluster Stats (per-question LLM classification) ── */}
      {hasClusterStats && (
        <div className="qc-cluster-stats">
          {Object.entries(state.clusterStats!)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([taskNumStr, data]) => {
              const taskNum = Number(taskNumStr)
              const stepLabel = stepNames[taskNum] || `Task ${taskNum}`
              const defs = data.definitions
              const clusterList = data.clusters

              if (defs.length === 0 && clusterList.length === 0) return null

              const labelMap: Record<string, string> = {}
              for (const d of defs) labelMap[d.id] = d.label
              labelMap['other'] = '未分类'

              const sorted = [...clusterList].sort((a, b) => {
                if (a.clusterId === 'other') return 1
                if (b.clusterId === 'other') return -1
                return b.uniqueStudents - a.uniqueStudents || a.clusterId.localeCompare(b.clusterId)
              })

              if (defs.length > 0 && clusterList.length === 0) {
                return (
                  <div key={taskNum} className="qc-step-group">
                    <div className="q-step-h">
                      <span className="step-name">{stepLabel}</span>
                      <span className="tot">暂无观察数据</span>
                    </div>
                  </div>
                )
              }

              const totalDiscussing = new Set(
                clusterList.flatMap(c => c.observations.map(o => o.studentName)),
              ).size

              const taskHighlightCount = clusterList.reduce(
                (sum, c) => sum + c.observations.filter(o => o.isHighlight).length, 0,
              )

              return (
                <div key={taskNum} className="qc-step-group">
                  <div className="q-step-h">
                    <span className="step-name">{stepLabel}</span>
                    <span className="tot">
                      {totalDiscussing}人讨论中
                      {taskHighlightCount > 0 && <span style={{ marginLeft: 6, color: 'var(--amber)' }}>✦ {taskHighlightCount}</span>}
                    </span>
                  </div>
                  {sorted.map(cs => {
                    const label = labelMap[cs.clusterId] || cs.clusterId
                    const isOther = cs.clusterId === 'other'
                    const studentNames = [...new Set(cs.observations.map(obs => obs.studentName))]

                    if (isOther && studentNames.length === 0) return null

                    // Check for beyond-preset: other + has highlights
                    const hasBeyond = isOther && cs.observations.some(o => o.isHighlight)

                    return (
                      <div key={cs.clusterId} className={`qc-cluster-card${isOther ? ' other' : ''}${hasBeyond ? ' beyond' : ''}`}>
                        <div className="qc-head">
                          <div className="qc-question">
                            {hasBeyond ? (
                              <span className="beyond-label">{label}</span>
                            ) : isOther ? (
                              <span className="qc-other-label">{label}</span>
                            ) : label}
                          </div>
                          <div className="qc-meta">
                            <span className={`qc-count${cs.uniqueStudents >= 3 ? ' hot' : ''}`}>{cs.uniqueStudents}人</span>
                          </div>
                        </div>
                        <div className="qc-student-tags">
                          {studentNames.map(name => {
                            const isHighlight = cs.observations.some(o => o.studentName === name && o.isHighlight)
                            return (
                              <span
                                key={name}
                                className={`qc-student-tag${isHighlight ? ' highlight' : ''}`}
                                onClick={() => onStudentClick(name)}
                              >
                                {name}
                              </span>
                            )
                          })}
                        </div>
                        {/* Show highlight gists for beyond-preset */}
                        {hasBeyond && (
                          <div style={{ marginTop: 6 }}>
                            {cs.observations
                              .filter(o => o.isHighlight && o.highlightGist)
                              .map((o, i) => (
                                <div key={i} className="hl-meta" style={{ marginBottom: 4 }}>
                                  <span className="name">{o.studentName}</span>
                                  <span className="hl-gist">{o.highlightGist}</span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
        </div>
      )}

      {/* ── Discussion Activity Feed ── */}
      {discussFeed.length > 0 && (
        <div className="discuss-feed">
          <div className="discuss-feed-h">讨论动态</div>
          {discussFeed.map((entry, i) => (
            <div key={i} className="df-entry">
              <div className="df-meta">
                <span className="name" onClick={() => onStudentClick(entry.studentName)} style={{ cursor: 'pointer' }}>
                  {entry.studentName}
                </span>
                <span>{formatRelative(new Date(entry.timestamp).toISOString())}</span>
              </div>
              <div className="df-msg">{entry.msg}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Fallback: text-similarity clustering ── */}
      {!hasClusterStats && clusteredQuestions.length > 0 && (
        <div className="queue-section">
          <div className="queue-h">
            <span className="lb">问题聚类 · 按 Step</span>
            <span className="cnt">{totalAskQuestions}</span>
          </div>
          <div className="queue">
            {clusteredQuestions.map(group => {
              const stepLabel = stepNames[group.step] || `Step ${group.step}`
              return (
                <div key={group.step} className="qc-step-group">
                  <div className="q-step-h">
                    <span className="step-name">{stepLabel}</span>
                    <span className="tot">{group.total} 条提问</span>
                  </div>
                  {group.clusters.map((cluster, ci) => {
                    const qKey = `${group.step}:${ci}`
                    const isQExpanded = expandedQ === qKey
                    const isHot = cluster.students.length >= 3
                    return (
                      <div key={ci} className={`qc-cluster${isHot ? ' qc-hot' : ''}`}>
                        <div className="qc-head" onClick={() => setExpandedQ(isQExpanded ? null : qKey)}>
                          <div className="qc-question">{cluster.representative.question}</div>
                          <div className="qc-meta">
                            <span className={`qc-count${isHot ? ' hot' : ''}`}>{cluster.students.length}人提问</span>
                            <span className={`cat-badge ${getCatBadgeClass(cluster.category)}`}>{cluster.category}</span>
                          </div>
                        </div>
                        <div className="qc-students">
                          {cluster.students.map(name => (
                            <span key={name} className="qc-student-tag" onClick={() => onStudentClick(name)}>{name}</span>
                          ))}
                        </div>
                        {isQExpanded && (
                          <div className="qc-expanded">
                            {cluster.items.map((item, ii) => (
                              <div key={ii} className="qc-item">
                                <div className="qc-item-head">
                                  <span className="q-student">{item.studentName}</span>
                                  <span className="qmeta">{formatRelative(item.timestamp)}</span>
                                </div>
                                <div className="qq">{item.question}</div>
                                {item.answer && (
                                  <div className="q-answer">
                                    <span className="q-answer-label">AI 回答：</span>
                                    {item.answer}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Truly empty fallback */}
      {!hasClusterStats && totalAskQuestions === 0 && discussFeed.length === 0 && (
        <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 11, color: 'var(--t3)' }}>
          暂无学生提问
        </div>
      )}
    </div>
  )
}
