import { useState, useMemo } from 'react'
import type { ClassroomState } from '../../hooks/useClassroom'
import { clusterQuestions, getCatBadgeClass, formatRelative, stripDiscussTag, countHighlights, buildHighlightLookup, isHighlightMatch } from './teacher-helpers'

function formatAbsTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  state: ClassroomState
  stepNames: Record<number, string>
  questions: ClassroomState['questions']
  onStudentClick: (name: string) => void
  onExpandDrawer?: () => void
}

export function DiscussInsightTab({ state, stepNames, questions, onStudentClick, onExpandDrawer }: Props) {
  const [expandedQ, setExpandedQ] = useState<string | null>(null)

  // ── Cluster Stats (LLM-classified) ──
  const hasClusterStats = state.clusterStats && Object.keys(state.clusterStats).length > 0

  // Highlight count for header badge
  const highlightCount = useMemo(() => countHighlights(state.clusterStats), [state.clusterStats])

  // Build highlight lookup: studentName → detectedAt timestamps
  const highlightLookup = useMemo(
    () => buildHighlightLookup(state.coaching?.highlights ?? []),
    [state.coaching],
  )

  // ── Discussion feed (observation logs discuss events + discuss questions) ──
  const discussFeed = useMemo(() => {
    const entries: Array<{ studentName: string; msg: string; timestamp: number; type: 'obs' | 'question'; isHighlight: boolean }> = []

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
              isHighlight: isHighlightMatch(highlightLookup, log.studentName, evt.timestamp),
            })
          }
        }
      }
    }

    // From questions with category 'discuss'
    for (const q of questions) {
      if (q.category === 'discuss') {
        const ts = new Date(q.timestamp).getTime()
        entries.push({
          studentName: q.studentName,
          msg: stripDiscussTag(q.question),
          timestamp: ts,
          type: 'question',
          isHighlight: isHighlightMatch(highlightLookup, q.studentName, ts),
        })
      }
    }

    return entries.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10)
  }, [state.observation, questions, highlightLookup])

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
      <div>
        <div className="panel-header">
          <span className="title">讨论洞察</span>
          {onExpandDrawer && <button className="expand-btn" onClick={onExpandDrawer}>展开 ↗</button>}
        </div>
        <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
          暂无讨论数据…学生开始讨论后将自动显示洞察
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ── Panel Header ── */}
      <div className="panel-header">
        <span className="title">
          讨论洞察
          {highlightCount > 0 && <span className="highlight-badge">✦ {highlightCount}</span>}
        </span>
        {onExpandDrawer && (
          <button className="expand-btn" onClick={onExpandDrawer}>展开 ↗</button>
        )}
      </div>

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
            <div key={i} className={`df-entry${entry.isHighlight ? ' is-highlight' : ''}`}>
              <div className="df-meta">
                <span className="df-time">{formatAbsTime(entry.timestamp)}</span>
                <span className="name" onClick={() => onStudentClick(entry.studentName)} style={{ cursor: 'pointer' }}>
                  {entry.studentName}
                </span>
              </div>
              <div className="df-msg">{entry.msg}</div>
            </div>
          ))}
          {onExpandDrawer && (
            <div className="feed-more" onClick={onExpandDrawer}>查看完整回放 →</div>
          )}
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
    </div>
  )
}
