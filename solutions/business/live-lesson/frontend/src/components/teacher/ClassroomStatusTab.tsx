import { useMemo } from 'react'
import type { ClassroomState } from '../../hooks/useClassroom'
import { generateCoachingTips } from './coaching-helpers'

interface Props {
  state: ClassroomState
  health: {
    fastest: { step: string; count: number }
    median: { step: string; pct: number }
    stuck: { count: number; where: string }
    ai: { rounds: number; people: number }
  }
  stepNames: Record<number, string>
  taskSteps: Array<{ idx: number; duration?: number }>
  onStudentClick: (name: string) => void
}

type MergedItem = {
  severity: 'urgent' | 'warn' | 'info'
  title: string
  detail?: string
  source: 'alert' | 'tip'
  studentName?: string
}

const SEVERITY_ORDER: Record<string, number> = { urgent: 0, warn: 1, info: 2 }
const EMPTY_ALERTS: NonNullable<ClassroomState['observation']>['alerts'] = []
const EMPTY_INDICATORS: NonNullable<ClassroomState['observation']>['indicatorStats'] = []

export function ClassroomStatusTab({ state, health, stepNames, taskSteps, onStudentClick }: Props) {
  const tips = useMemo(
    () => generateCoachingTips(state, health, stepNames, taskSteps),
    [state, health, stepNames, taskSteps],
  )

  const alerts = state.observation?.alerts ?? EMPTY_ALERTS
  const llmInsights = state.coaching?.llmInsights ?? null
  const indicatorStats = state.observation?.indicatorStats ?? EMPTY_INDICATORS
  const totalStudents = state.students.length

  // ── Merged alerts + tips ──
  const mergedItems = useMemo(() => {
    const items: MergedItem[] = []

    for (const alert of alerts) {
      items.push({
        severity: alert.severity,
        title: alert.message,
        studentName: alert.studentName,
        source: 'alert',
      })
    }

    for (const tip of tips) {
      items.push({
        severity: tip.priority === 'urgent' ? 'urgent' : tip.priority === 'important' ? 'warn' : 'info',
        title: tip.title,
        detail: tip.detail,
        source: 'tip',
      })
    }

    // Deduplicate by title
    const seen = new Set<string>()
    const deduped = items.filter(item => {
      if (seen.has(item.title)) return false
      seen.add(item.title)
      return true
    })

    return deduped.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2))
  }, [alerts, tips])

  const hasAnyContent = mergedItems.length > 0 || (llmInsights && llmInsights.insights.length > 0) || indicatorStats.length > 0

  if (!hasAnyContent) {
    return (
      <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
        课堂运行正常，暂无需要关注的事项
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 14px' }}>
      {/* ── Merged alerts + tips ── */}
      {mergedItems.length > 0 && (
        <div className="status-section">
          <div className="status-section-h">
            告警与建议
            <span className="cnt">{mergedItems.length}</span>
          </div>
          <div className="status-alert-list">
            {mergedItems.map((item, i) => (
              <div key={i} className="alert-item">
                <div className={`alert-dot ${item.severity}`} />
                <div className="alert-text">
                  <div className="alert-title">
                    {item.studentName && (
                      <span
                        style={{ color: 'var(--blue)', cursor: 'pointer', marginRight: 4 }}
                        onClick={() => onStudentClick(item.studentName!)}
                      >
                        {item.studentName}
                      </span>
                    )}
                    {item.title}
                  </div>
                  {item.detail && <div className="alert-source">{item.detail}</div>}
                  <div className="alert-source" style={{ fontStyle: 'italic' }}>
                    {item.source === 'alert' ? '观察引擎' : '规则建议'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LLM Insights ── */}
      {llmInsights && llmInsights.insights.length > 0 && (
        <div className="insight-section">
          <div className="status-section-h">
            深度洞察
            <span className="cnt">
              {new Date(llmInsights.generatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {llmInsights.insights.map((ins, i) => (
            <div key={`${llmInsights.generatedAt}-${i}`} className="insight-card">
              <div className="insight-header">
                <span>{ins.title}</span>
              </div>
              <div className="insight-body">{ins.detail}</div>
              {ins.suggestedAction && (
                <div className="insight-action">{ins.suggestedAction}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Indicator bars ── */}
      {indicatorStats.length > 0 && (
        <div className="indicator-section">
          <div className="status-section-h">知识 / 误解指标</div>
          {indicatorStats
            .sort((a, b) => b.studentCount - a.studentCount)
            .map(ind => {
              const pct = totalStudents > 0 ? Math.round((ind.studentCount / totalStudents) * 100) : 0
              return (
                <div key={ind.indicatorId} className="indicator-bar">
                  <span className={`indicator-label ${ind.type}`} title={ind.label}>
                    {ind.label}
                  </span>
                  <div className="bar-track">
                    <div
                      className={`bar-fill ${ind.type}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="indicator-pct">{pct}%</span>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
