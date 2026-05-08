import { useState } from 'react'
import type { ClassroomState } from '../../hooks/useClassroom'
import { STUCK_THRESHOLD_MS, stripDiscussTag } from './teacher-helpers'

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

type ObsStatus = 'idle' | 'alert' | 'warn' | 'ok' | 'active'

function deriveObsStatus(obs: ClassroomState['observation'], studentId: string): ObsStatus {
  if (!obs) return 'active'
  const log = obs.logs.find(l => l.studentId === studentId)
  if (!log) return 'active'

  const now = Date.now()
  if (now - log.systemMetrics.lastActiveAt > STUCK_THRESHOLD_MS) return 'idle'
  const recent = log.events.filter(e => now - e.timestamp < 5 * 60 * 1000)
  const misconceptions = recent.filter(e => e.anchors.some(a => a.startsWith('M')))
  if (misconceptions.length >= 3) return 'alert'
  if (misconceptions.length >= 1) return 'warn'
  if (log.systemMetrics.exerciseCorrectRate >= 80 && log.systemMetrics.messageCount <= 2) return 'ok'
  return 'active'
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
    const depthEvent = log?.events
      .filter(e => e.source === 'system' && e.systemType === 'discuss_depth')
      .at(-1)
    const rawDepth = depthEvent?.data?.depth
    const depth = typeof rawDepth === 'string' ? rawDepth : undefined
    const studentMsg = stripDiscussTag(q.question)
    return { ...q, anchors, depth, studentMsg }
  })

  return (
    <div className="obs-panel">
      {/* Student status chips */}
      {obs.logs.length > 0 && (
        <div className="obs-section">
          <div className="obs-section-h">学生状态</div>
          <div className="obs-chip-grid">
            {students.map(s => {
              const status = deriveObsStatus(obs, s.id)
              const log = obs.logs.find(l => l.studentId === s.id)
              const lastEvent = log?.events.length ? log.events[log.events.length - 1] : null
              return (
                <div
                  key={s.id}
                  className={`obs-student-chip ${status}`}
                  title={`${s.name}${lastEvent ? ` · ${lastEvent.gist}` : ''}`}
                >
                  {s.name}
                </div>
              )
            })}
          </div>
          <div className="obs-legend">
            <span className="obs-legend-item"><span className="obs-legend-dot active" />活跃</span>
            <span className="obs-legend-item"><span className="obs-legend-dot ok" />顺畅</span>
            <span className="obs-legend-item"><span className="obs-legend-dot warn" />困惑</span>
            <span className="obs-legend-item"><span className="obs-legend-dot alert" />卡住</span>
            <span className="obs-legend-item"><span className="obs-legend-dot idle" />沉默</span>
          </div>
        </div>
      )}

      {/* Knowledge indicators */}
      {knowledgeIndicators.length > 0 && (
        <div className="obs-section">
          <div className="obs-section-h">知识指标</div>
          <div className="obs-indicators">
            {knowledgeIndicators.map(a => (
              <div key={a.indicatorId} className="obs-indicator-row">
                <span className="obs-ind-id">{a.indicatorId}</span>
                <span className="obs-ind-label">{a.label}</span>
                <div className="obs-ind-bar">
                  <div
                    className="obs-ind-fill"
                    style={{ width: `${Math.min(100, (a.studentCount / Math.max(1, students.length)) * 100)}%` }}
                  />
                </div>
                <span className="obs-ind-count">{a.studentCount}/{students.length}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Misconception signals */}
      {misconceptionIndicators.some(a => a.studentCount > 0) && (
        <div className="obs-section">
          <div className="obs-section-h warn">⚠ 误解信号</div>
          <div className="obs-misconceptions">
            {misconceptionIndicators.filter(a => a.studentCount > 0).map(a => (
              <div key={a.indicatorId} className="obs-misconception-card">
                <div className="obs-mc-head">
                  <span className="obs-mc-id">{a.indicatorId}</span>
                  <span className="obs-mc-label">{a.label}</span>
                  <span className="obs-mc-count">{a.studentCount} 人</span>
                </div>
                {a.latestGist && (
                  <div className="obs-mc-gist">「{a.latestGist}」</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discuss live */}
      {discussLive.length > 0 && (
        <div className="obs-section">
          <div className="obs-section-h">讨论实况</div>
          <div className="obs-discuss-list">
            {discussLive.map(entry => (
              <div key={entry.studentId} className="obs-discuss-entry">
                <div className="obs-discuss-head">
                  <span className="obs-discuss-name">{entry.studentName}</span>
                  {entry.anchors.map(a => (
                    <span key={a} className={`obs-discuss-anchor ${a.startsWith('K') ? 'knowledge' : 'misconception'}`}>{a}</span>
                  ))}
                  {entry.depth && (
                    <span className={`obs-discuss-depth ${entry.depth}`}>{entry.depth}</span>
                  )}
                </div>
                <div className="obs-discuss-msg">{entry.studentMsg}</div>
              </div>
            ))}
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

  return (
    <div className="obs-alerts">
      {alerts.map((alert, i) => (
        <div key={i} className={`obs-alert-card ${alert.severity}`}>
          <div className="obs-alert-head">
            <span className="obs-alert-icon">
              {alert.severity === 'urgent' ? '⚠' : alert.severity === 'warn' ? '△' : 'ℹ'}
            </span>
            <span className="obs-alert-msg">{alert.message}</span>
          </div>
          {alert.indicatorId && (
            <div className="obs-alert-indicator">指标: {alert.indicatorId}</div>
          )}
        </div>
      ))}
    </div>
  )
}
