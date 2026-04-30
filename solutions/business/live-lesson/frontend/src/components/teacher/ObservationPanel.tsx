import { useState } from 'react'
import type { ClassroomState } from '../../hooks/useClassroom'
import { STUCK_THRESHOLD_MS } from './teacher-helpers'

type ObsMode = 'glance' | 'alert'

export function ObservationPanel({ state }: { state: ClassroomState }) {
  const [mode, setMode] = useState<ObsMode>('glance')
  const obs = state.observation

  if (!obs || (obs.logs.length === 0 && obs.alerts.length === 0 && obs.indicatorStats.length === 0)) {
    return (
      <div>
        <div className="sh" style={{ marginBottom: 6 }}><span className="sh-lb">观察要点</span></div>
        <div className="patterns">
          <div className="pat">
            <div className="pat-h info"><span className="dot" />等待数据</div>
            <div className="pat-body">观察系统已就绪，学生互动后将自动生成教学洞察。</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="sh" style={{ marginBottom: 6 }}>
        <span className="sh-lb">观察要点</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <button
            className={`obs-tab${mode === 'glance' ? ' active' : ''}`}
            onClick={() => setMode('glance')}
          >概览</button>
          <button
            className={`obs-tab${mode === 'alert' ? ' active' : ''}`}
            onClick={() => setMode('alert')}
          >
            告警
            {obs.alerts.filter(a => a.severity === 'urgent').length > 0 && (
              <span className="obs-badge urgent">{obs.alerts.filter(a => a.severity === 'urgent').length}</span>
            )}
          </button>
        </div>
      </div>

      {mode === 'glance' && <GlanceView obs={obs} students={state.students} questions={state.questions} />}
      {mode === 'alert' && <AlertView alerts={obs.alerts} />}
    </div>
  )
}

function deriveObsColor(obs: ClassroomState['observation'], studentId: string): string {
  if (!obs) return 'var(--blue)'
  const log = obs.logs.find(l => l.studentId === studentId)
  if (!log) return 'var(--blue)'

  const now = Date.now()
  if (now - log.systemMetrics.lastActiveAt > STUCK_THRESHOLD_MS) return 'var(--t3)' // idle
  const recent = log.events.filter(e => now - e.timestamp < 5 * 60 * 1000)
  const misconceptions = recent.filter(e => e.anchors.some(a => a.startsWith('M')))
  if (misconceptions.length >= 3) return 'var(--red)' // stuck
  if (misconceptions.length >= 1) return 'var(--amber-dot)' // struggling
  if (log.systemMetrics.exerciseCorrectRate >= 80 && log.systemMetrics.messageCount <= 2) return 'var(--green-dot)' // cruising
  return 'var(--blue)' // active
}

function GlanceView({ obs, students, questions }: {
  obs: NonNullable<ClassroomState['observation']>
  students: ClassroomState['students']
  questions: ClassroomState['questions']
}) {
  const knowledgeIndicators = obs.indicatorStats.filter(a => a.type === 'knowledge')
  const misconceptionIndicators = obs.indicatorStats.filter(a => a.type === 'misconception').sort((a, b) => b.studentCount - a.studentCount)

  // Discuss live: students currently in discuss phase (from questions with category === 'discuss')
  const discussEntries = (questions ?? [])
    .filter(q => q.category === 'discuss')
    .reduce<Map<string, typeof questions[number]>>((map, q) => {
      // Keep the latest discuss entry per student
      const existing = map.get(q.studentId)
      if (!existing || q.timestamp > existing.timestamp) {
        map.set(q.studentId, q)
      }
      return map
    }, new Map())

  // Enrich discuss entries with observation data
  const discussLive = Array.from(discussEntries.values()).map(q => {
    const log = obs.logs.find(l => l.studentId === q.studentId)
    const anchors = log?.events
      .filter(e => e.source === 'llm')
      .flatMap(e => e.anchors)
      .filter((a, i, arr) => arr.indexOf(a) === i) ?? []
    // Find the latest discuss_depth event for this student
    const depthEvent = log?.events
      .filter(e => e.source === 'system' && e.systemType === 'discuss_depth')
      .at(-1)
    const rawDepth = depthEvent?.data?.depth
    const depth = typeof rawDepth === 'string' ? rawDepth : undefined
    // Extract student's actual message (strip the [discuss:...] prefix)
    const studentMsg = q.question.replace(/^\[discuss:\w+\]\s*/, '')
    return { ...q, anchors, depth, studentMsg }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Student dots with observation-derived colors */}
      {obs.logs.length > 0 && (
        <div className="patterns" style={{ gridTemplateColumns: '1fr' }}>
          <div className="pat">
            <div className="pat-h info"><span className="dot" />学生状态</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {students.map(s => {
                const color = deriveObsColor(obs, s.id)
                const log = obs.logs.find(l => l.studentId === s.id)
                const lastEvent = log?.events.length ? log.events[log.events.length - 1] : null
                return (
                  <div
                    key={s.id}
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: color, color: '#fff',
                      fontSize: 9, fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'default',
                    }}
                    title={`${s.name}${lastEvent ? ` · ${lastEvent.gist}` : ''}`}
                  >
                    {s.name.substring(0, 2)}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 9, color: 'var(--t3)' }}>
              <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 2, background: 'var(--blue)', marginRight: 3 }} />活跃</span>
              <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 2, background: 'var(--green-dot)', marginRight: 3 }} />顺畅</span>
              <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 2, background: 'var(--amber-dot)', marginRight: 3 }} />困惑</span>
              <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 2, background: 'var(--red)', marginRight: 3 }} />卡住</span>
              <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 2, background: 'var(--t3)', marginRight: 3 }} />沉默</span>
            </div>
          </div>
        </div>
      )}

      {/* Knowledge indicator progress */}
      {knowledgeIndicators.length > 0 && (
        <div className="patterns" style={{ gridTemplateColumns: '1fr' }}>
          <div className="pat">
            <div className="pat-h info"><span className="dot" />知识指标</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {knowledgeIndicators.map(a => (
                <div key={a.indicatorId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--t2)', width: 22, flexShrink: 0 }}>{a.indicatorId}</span>
                  <span style={{ fontSize: 10, color: 'var(--t2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label}</span>
                  <div style={{ width: 60, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{
                      width: `${Math.min(100, (a.studentCount / Math.max(1, students.length)) * 100)}%`,
                      height: '100%', background: 'var(--green-dot)', borderRadius: 3,
                    }} />
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--t3)', width: 30, textAlign: 'right', flexShrink: 0 }}>{a.studentCount}/{students.length}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Misconception indicators sorted by impact */}
      {misconceptionIndicators.some(a => a.studentCount > 0) && (
        <div className="patterns" style={{ gridTemplateColumns: '1fr' }}>
          <div className="pat alert">
            <div className="pat-h warn"><span className="dot" />误解信号</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {misconceptionIndicators.filter(a => a.studentCount > 0).map(a => (
                <div key={a.indicatorId}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--amber)', width: 22, flexShrink: 0 }}>{a.indicatorId}</span>
                    <span style={{ fontSize: 10, color: 'var(--t2)', flex: 1 }}>{a.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--amber)' }}>{a.studentCount} 人</span>
                  </div>
                  {a.latestGist && (
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2, marginLeft: 28 }}>{a.latestGist}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Discuss live — students currently in discuss phase */}
      {discussLive.length > 0 && (
        <div className="patterns" style={{ gridTemplateColumns: '1fr' }}>
          <div className="pat">
            <div className="pat-h info"><span className="dot" />讨论实况</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {discussLive.map(entry => (
                <div key={entry.studentId} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--t2)' }}>{entry.studentName}</span>
                    {entry.anchors.map(a => (
                      <span key={a} style={{
                        fontSize: 8, fontWeight: 600, padding: '1px 4px', borderRadius: 3,
                        background: a.startsWith('K') ? 'rgba(34,197,94,.15)' : 'rgba(245,158,11,.15)',
                        color: a.startsWith('K') ? 'var(--green-dot)' : 'var(--amber)',
                      }}>{a}</span>
                    ))}
                    {entry.depth && (
                      <span style={{
                        fontSize: 8, fontWeight: 600, padding: '1px 4px', borderRadius: 3, marginLeft: 'auto',
                        background: entry.depth === 'deep' ? 'rgba(34,197,94,.15)' : entry.depth === 'partial' ? 'rgba(59,130,246,.12)' : 'rgba(156,163,175,.12)',
                        color: entry.depth === 'deep' ? 'var(--green-dot)' : entry.depth === 'partial' ? 'var(--blue)' : 'var(--t3)',
                      }}>{entry.depth}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.studentMsg.length > 40 ? entry.studentMsg.slice(0, 40) + '...' : entry.studentMsg}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AlertView({ alerts }: { alerts: NonNullable<ClassroomState['observation']>['alerts'] }) {
  if (alerts.length === 0) {
    return (
      <div className="patterns" style={{ gridTemplateColumns: '1fr' }}>
        <div className="pat">
          <div className="pat-h info"><span className="dot" />暂无告警</div>
          <div className="pat-body">课堂运行正常，暂无需要关注的事项。</div>
        </div>
      </div>
    )
  }

  const severityColor: Record<string, string> = {
    urgent: 'var(--red)',
    warn: 'var(--amber)',
    info: 'var(--blue)',
  }
  const severityBg: Record<string, string> = {
    urgent: 'rgba(220,38,38,.06)',
    warn: 'rgba(245,158,11,.06)',
    info: 'rgba(59,130,246,.06)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {alerts.map((alert, i) => (
        <div
          key={i}
          style={{
            padding: '8px 12px', borderRadius: 8,
            background: severityBg[alert.severity] || 'var(--surface)',
            borderLeft: `3px solid ${severityColor[alert.severity] || 'var(--border)'}`,
            fontSize: 11, lineHeight: 1.5, color: 'var(--t2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 600, color: severityColor[alert.severity] }}>
              {alert.severity === 'urgent' ? '⚠' : alert.severity === 'warn' ? '△' : 'ℹ'}
            </span>
            <span>{alert.message}</span>
          </div>
          {alert.indicatorId && (
            <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2, marginLeft: 18 }}>
              指标: {alert.indicatorId}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
