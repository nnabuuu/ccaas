import { useMemo, useState } from 'react'
import type { ClassroomState } from '../../hooks/useClassroom'
import OverlayShell from './observe/OverlayShell'
import { buildHighlightLookup, isHighlightMatch, findHighlightGist } from './teacher-helpers'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

interface Props {
  open: boolean
  onClose: () => void
  state: ClassroomState
  stepNames: Record<number, string>
  onStudentClick: (name: string) => void
}

export default function DiscussInsightDrawer({ open, onClose, state, stepNames, onStudentClick }: Props) {
  const clusterStats = state.clusterStats
  const highlights = state.coaching?.highlights ?? []

  // Collect all tasks with cluster data
  const allTasks = useMemo(() => {
    if (!clusterStats) return []
    return Object.entries(clusterStats)
      .map(([k, v]) => ({ taskNum: Number(k), ...v }))
      .filter(d => d.clusters.length > 0)
      .sort((a, b) => a.taskNum - b.taskNum)
  }, [clusterStats])

  const [selectedTaskNum, setSelectedTaskNum] = useState<number | null>(null)

  const taskData = useMemo(() => {
    if (allTasks.length === 0) return null
    if (selectedTaskNum != null) {
      return allTasks.find(t => t.taskNum === selectedTaskNum) ?? allTasks[0]
    }
    return allTasks[0]
  }, [allTasks, selectedTaskNum])

  // Label map
  const labelMap = useMemo(() => {
    if (!taskData) return {}
    const map: Record<string, string> = {}
    for (const d of taskData.definitions) map[d.id] = d.label
    map['other'] = '超越预设'
    return map
  }, [taskData])

  // All unique students across clusters
  const allStudents = useMemo(() => {
    if (!taskData) return []
    const set = new Set<string>()
    for (const c of taskData.clusters) {
      for (const o of c.observations) set.add(o.studentName)
    }
    return [...set].sort()
  }, [taskData])

  // Non-other cluster IDs (for matrix columns)
  const clusterIds = useMemo(() => {
    if (!taskData) return []
    return taskData.clusters
      .filter(c => c.clusterId !== 'other')
      .sort((a, b) => b.uniqueStudents - a.uniqueStudents)
      .map(c => c.clusterId)
  }, [taskData])

  // Build matrix: student → clusterId → { hit, isHighlight }
  const matrix = useMemo(() => {
    if (!taskData) return new Map<string, Map<string, { hit: boolean; isHighlight: boolean }>>()
    const m = new Map<string, Map<string, { hit: boolean; isHighlight: boolean }>>()
    for (const student of allStudents) {
      const row = new Map<string, { hit: boolean; isHighlight: boolean }>()
      for (const cid of [...clusterIds, 'other']) {
        row.set(cid, { hit: false, isHighlight: false })
      }
      m.set(student, row)
    }
    for (const c of taskData.clusters) {
      for (const o of c.observations) {
        const row = m.get(o.studentName)
        if (row) {
          row.set(c.clusterId, { hit: true, isHighlight: !!o.isHighlight })
        }
      }
    }
    return m
  }, [taskData, allStudents, clusterIds])

  // Discussion timeline from observation logs
  const timeline = useMemo(() => {
    const items: Array<{
      timestamp: number
      studentName: string
      text: string
      type: 'discuss' | 'highlight'
      gist?: string
    }> = []

    const hlLookup = buildHighlightLookup(highlights)

    if (state.observation?.logs) {
      for (const log of state.observation.logs) {
        for (const evt of log.events) {
          if (evt.source === 'llm' || (evt.source === 'system' && evt.systemType === 'discuss_depth')) {
            const hl = isHighlightMatch(hlLookup, log.studentName, evt.timestamp)
            const gistTag = hl ? findHighlightGist(hlLookup, highlights, log.studentName, evt.timestamp) : undefined
            items.push({
              timestamp: evt.timestamp,
              studentName: log.studentName,
              text: evt.quote || evt.gist,
              type: hl ? 'highlight' : 'discuss',
              gist: gistTag,
            })
          }
        }
      }
    }

    return items.sort((a, b) => a.timestamp - b.timestamp)
  }, [state.observation, highlights])

  const stepLabel = taskData ? (stepNames[taskData.taskNum] || `Task ${taskData.taskNum}`) : ''
  const highlightCount = highlights.length

  return (
    <OverlayShell open={open} onClose={onClose} depth={0}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div className="drawer-header">
          <span className="title">
            讨论洞察 · {stepLabel}
            {highlightCount > 0 && <span className="highlight-badge">✦ {highlightCount}</span>}
          </span>
          <button className="drawer-close" onClick={onClose}>✕ 关闭</button>
        </div>

        {/* Task selector tabs */}
        {allTasks.length > 1 && (
          <div style={{ display: 'flex', gap: 2, padding: '6px 20px 0', flexShrink: 0 }}>
            {allTasks.map(t => (
              <button
                key={t.taskNum}
                className={`obs-tab${taskData?.taskNum === t.taskNum ? ' active' : ''}`}
                onClick={() => setSelectedTaskNum(t.taskNum)}
              >
                {stepNames[t.taskNum] || `Task ${t.taskNum}`}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="drawer-body">
          {!taskData ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
              暂无讨论聚类数据
            </div>
          ) : (
            <div className="drawer-cols">
              {/* ── Left Column: Clusters + Highlights + Matrix + Diagram ── */}
              <div>
                {/* Cluster Details with evidence */}
                <div className="subsection">聚类详情</div>
                {taskData.clusters
                  .filter(c => c.clusterId !== 'other')
                  .sort((a, b) => b.uniqueStudents - a.uniqueStudents)
                  .map(c => {
                    const label = labelMap[c.clusterId] || c.clusterId
                    return (
                      <div key={c.clusterId} className="qc-cluster-card" style={{ marginBottom: 12 }}>
                        <div className="qc-head">
                          <div className="qc-question">{label}</div>
                          <div className="qc-meta">
                            <span className="qc-count">{c.uniqueStudents}人</span>
                          </div>
                        </div>
                        {/* Evidence spans */}
                        <div style={{ marginTop: 6 }}>
                          {c.observations
                            .filter(o => o.evidenceSpans.length > 0)
                            .slice(0, 3)
                            .map((o, i) => (
                              <div key={i} className="evidence">
                                {o.studentName}: "{o.evidenceSpans[0]}"
                              </div>
                            ))}
                        </div>
                      </div>
                    )
                  })}

                {/* Beyond-preset highlights (full cards) */}
                {highlights.length > 0 && (
                  <>
                    <div className="subsection" style={{ marginTop: 16 }}>
                      <span className="icon">✦</span> 超越预设
                    </div>
                    {highlights.map((h, i) => (
                      <div key={i} className="highlight-full-card">
                        <div className="hf-header">
                          <span className="hf-name" onClick={() => onStudentClick(h.studentName)} style={{ cursor: 'pointer' }}>
                            ✦ {h.studentName}
                          </span>
                          <span className="hf-time">{formatTime(h.detectedAt)}</span>
                        </div>
                        <div className="hf-gist">"{h.gist}"</div>
                        {h.evidenceSpan && <div className="hf-evidence">"{h.evidenceSpan}"</div>}
                        {h.message && <div className="hf-message">{h.message}</div>}
                      </div>
                    ))}
                  </>
                )}

                {/* Student-Cluster Hit Matrix */}
                {allStudents.length > 0 && clusterIds.length > 0 && (
                  <>
                    <div className="subsection" style={{ marginTop: 16 }}>学生-聚类命中矩阵</div>
                    <table className="matrix-table">
                      <thead>
                        <tr>
                          <th>学生</th>
                          {clusterIds.map(cid => (
                            <th key={cid}>{(labelMap[cid] || cid).substring(0, 4)}</th>
                          ))}
                          <th>超越</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allStudents.map(name => {
                          const row = matrix.get(name)
                          if (!row) return null
                          return (
                            <tr key={name}>
                              <td className="student-name" onClick={() => onStudentClick(name)}>{name}</td>
                              {clusterIds.map(cid => {
                                const cell = row.get(cid) ?? { hit: false, isHighlight: false }
                                if (cell.isHighlight) return <td key={cid} className="hit-highlight">✦</td>
                                if (cell.hit) return <td key={cid} className="hit">●</td>
                                return <td key={cid} className="miss">-</td>
                              })}
                              {(() => {
                                const otherCell = row.get('other')
                                if (!otherCell) return <td className="miss">-</td>
                                if (otherCell.isHighlight) return <td className="hit-highlight">✦</td>
                                if (otherCell.hit) return <td className="hit">●</td>
                                return <td className="miss">-</td>
                              })()}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <p style={{ fontSize: 9, color: 'var(--t3)', marginTop: 4 }}>
                      ● = 普通命中 · ✦ = 亮点命中 (isHighlight=true)
                    </p>
                  </>
                )}

                {/* Highlight-Cluster Relationship Diagram */}
                <div className="rel-diagram">
                  <div className="rel-title">亮点-Cluster 关系 (ClusterClassifier 输出路径)</div>
                  <div className="rel-path">
                    <span className="rel-cond normal">clusterId ≠ 'other'</span>
                    <span className="rel-arrow">+</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>isHighlight=false</span>
                    <span className="rel-arrow">→</span>
                    <span className="rel-result">普通 cluster 命中</span>
                  </div>
                  <div className="rel-path">
                    <span className="rel-cond cluster-hl">clusterId ≠ 'other'</span>
                    <span className="rel-arrow">+</span>
                    <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>isHighlight=true</span>
                    <span className="rel-arrow">→</span>
                    <span className="rel-result">cluster 内亮点 (✦)</span>
                  </div>
                  <div className="rel-path">
                    <span className="rel-cond beyond">clusterId = 'other'</span>
                    <span className="rel-arrow">+</span>
                    <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 600 }}>isHighlight=true</span>
                    <span className="rel-arrow">→</span>
                    <span className="rel-result">超越预设</span>
                  </div>
                </div>
              </div>

              {/* ── Right Column: Discussion Replay Timeline ── */}
              <div>
                <div className="subsection">讨论回放</div>
                <p style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 8 }}>
                  亮点消息高亮 + gist 标注
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
                          : {item.text}
                          {item.gist && <span className="tl-gist-tag">✦ {item.gist}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)', fontSize: 11 }}>
                    暂无讨论记录
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </OverlayShell>
  )
}
