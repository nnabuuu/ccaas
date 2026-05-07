import type { ObserveData } from '../ObserveDrawer'
import { scoreColor, formatTime, coordToPct, deviationColor, statusLevel } from '../observe-helpers'

interface MapStudentData extends ObserveData {
  stats: { avgAccuracy: number; avgTime: number }
  axes?: { x: { neg: string; pos: string }; y: { neg: string; pos: string } }
  items: Array<{ id: string; label: string; expected?: [number, number] }>
  students: Array<{
    id: string; name: string
    placed: number; totalItems: number; reasoned: number; totalReasons: number
    accuracy: number; time: number
    placements: Record<string, [number, number]>
    reasons: Record<string, string>
    deviations: Record<string, number>
    keyInsights: string[]
    llmFeedback?: string
  }>
}

interface Props {
  data: ObserveData
  studentId: string
  onBack: () => void
}

export default function MapStudentView({ data, studentId, onBack }: Props) {
  const d = data as MapStudentData
  const students = d.students || []
  const student = students.find(s => s.id === studentId)
  const items = d.items || []
  const stats = (d.stats || {}) as MapStudentData['stats']
  const axes = d.axes

  if (!student) {
    return (
      <div className="observe-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--t3)' }}>未找到该学生数据</div>
        <button className="observe-band-close" onClick={onBack}>返回</button>
      </div>
    )
  }

  const placements = student.placements || {}
  const reasons = student.reasons || {}
  const deviations = student.deviations || {}
  const status = statusLevel(student.accuracy)

  return (
    <div className="observe-split">
      <div className="observe-split-left">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button className="observe-band-close" onClick={onBack} style={{ padding: '4px 8px', fontSize: 11 }}>← 返回</button>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{student.name}</span>
        </div>

        {/* Stats grid */}
        <div className="obs-stats-grid cols-4">
          <div className="obs-stat-cell">
            <div className="obs-stat-v">{student.placed}/{student.totalItems}</div>
            <div className="obs-stat-lb">放置</div>
          </div>
          <div className="obs-stat-cell">
            <div className="obs-stat-v">{student.reasoned}/{student.totalReasons}</div>
            <div className="obs-stat-lb">推理</div>
          </div>
          <div className="obs-stat-cell">
            <div className="obs-stat-v" style={{ color: scoreColor(student.accuracy) }}>{Math.round(student.accuracy)}%</div>
            <div className="obs-stat-lb">准确度</div>
          </div>
          <div className="obs-stat-cell">
            <div className="obs-stat-v">{student.time > 0 ? formatTime(student.time) : '--'}</div>
            <div className="obs-stat-lb">用时</div>
          </div>
        </div>

        {/* Mini coordinate plane */}
        <div className="coord-plane" style={{ width: 260, height: 260, margin: '0 auto 12px' }}>
          {/* Grid lines */}
          {[25, 50, 75].map(p => (
            <div key={`v${p}`} className="coord-grid-line" style={{ left: `${p}%`, top: 0, width: 1, height: '100%' }} />
          ))}
          {[25, 50, 75].map(p => (
            <div key={`h${p}`} className="coord-grid-line" style={{ top: `${p}%`, left: 0, height: 1, width: '100%' }} />
          ))}
          <div className="coord-axis" style={{ left: '50%', top: 0, width: 2, height: '100%' }} />
          <div className="coord-axis" style={{ top: '50%', left: 0, height: 2, width: '100%' }} />

          {/* Axis labels */}
          {axes && (
            <>
              <span className="coord-label" style={{ left: 4, top: '50%', transform: 'translateY(-50%)' }}>{axes.x.neg}</span>
              <span className="coord-label" style={{ right: 4, top: '50%', transform: 'translateY(-50%)' }}>{axes.x.pos}</span>
              <span className="coord-label" style={{ top: 4, left: '50%', transform: 'translateX(-50%)' }}>{axes.y.pos}</span>
              <span className="coord-label" style={{ bottom: 4, left: '50%', transform: 'translateX(-50%)' }}>{axes.y.neg}</span>
            </>
          )}

          {/* Expected zones + labels */}
          {items.map(item => item.expected && (
            <div key={`exp-${item.id}`}>
              <div
                className="coord-expected"
                style={{ left: `${coordToPct(item.expected[0])}%`, top: `${100 - coordToPct(item.expected[1])}%` }}
              />
              <div
                className="coord-exp-label"
                style={{ left: `${coordToPct(item.expected[0])}%`, top: `${100 - coordToPct(item.expected[1])}%` }}
              >{item.label.substring(0, 3)}</div>
            </div>
          ))}

          {/* Dashed lines from student placement to expected + student dots */}
          {items.map(item => {
            const pos = placements[item.id]
            if (!pos) return null
            const sx = coordToPct(pos[0])
            const sy = 100 - coordToPct(pos[1])
            const expected = item.expected
            const ex = expected ? coordToPct(expected[0]) : null
            const ey = expected ? 100 - coordToPct(expected[1]) : null

            return (
              <div key={`pl-${item.id}`}>
                {/* Dashed line connecting placement to expected */}
                {ex != null && ey != null && (
                  <svg
                    style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}
                  >
                    <line
                      x1={`${sx}%`} y1={`${sy}%`}
                      x2={`${ex}%`} y2={`${ey}%`}
                      stroke="var(--t3)" strokeWidth="1" strokeDasharray="3,3" opacity="0.6"
                    />
                  </svg>
                )}
                {/* Student dot */}
                <div
                  className="coord-dot"
                  style={{ left: `${sx}%`, top: `${sy}%`, background: 'var(--blue)' }}
                />
              </div>
            )
          })}
        </div>

        {/* Per-item cards */}
        <div className="m2-section-h">逐项放置</div>
        {items.map(item => {
          const pos = placements[item.id]
          const reason = reasons[item.id]
          const dev = deviations[item.id]
          const expected = item.expected
          const badgeColor = dev != null
            ? (dev < 0.3 ? 'var(--green)' : dev < 0.6 ? 'var(--amber)' : 'var(--red)')
            : 'var(--t3)'
          const badgeBg = dev != null
            ? (dev < 0.3 ? 'var(--green-soft)' : dev < 0.6 ? 'var(--amber-soft)' : 'var(--red-soft)')
            : 'var(--surface2)'

          return (
            <div key={item.id} style={{
              padding: '8px 10px', marginBottom: 6, borderRadius: 6,
              background: 'var(--surface)', border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{item.label}</span>
                {dev != null && (
                  <span style={{
                    fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
                    color: badgeColor, background: badgeBg,
                  }}>
                    {dev < 0.3 ? '精准' : dev < 0.6 ? '接近' : '偏离'}
                  </span>
                )}
              </div>
              {pos ? (
                <div style={{ fontSize: 10, color: 'var(--t2)' }}>
                  <div>放置 ({pos[0]?.toFixed(1)}, {pos[1]?.toFixed(1)})</div>
                  {expected && (
                    <div style={{ color: 'var(--t3)' }}>参考 ({expected[0]?.toFixed(1)}, {expected[1]?.toFixed(1)})</div>
                  )}
                  {dev != null && (
                    <div style={{ color: deviationColor(dev), fontWeight: 600, marginTop: 2 }}>
                      偏差 {dev.toFixed(2)}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: 'var(--t3)' }}>未放置</div>
              )}
              {reason && (
                <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 4, lineHeight: 1.4, fontStyle: 'italic' }}>
                  "{reason}"
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="observe-split-right">
        {/* Status card */}
        <div className={`obs-status-card ${status.level}`}>
          <div className="obs-sc-title">{status.title}</div>
          <div className="obs-sc-body">
            准确度 {Math.round(student.accuracy)}%,
            已放置 {student.placed}/{student.totalItems} 项,
            推理 {student.reasoned}/{student.totalReasons}
          </div>
        </div>

        {/* Class comparison */}
        <div className="m2-section-h">班级对比</div>
        <div className="class-compare">
          <div className="cc-row">
            <span className="cc-label">准确度</span>
            <div className="cc-bar-wrap">
              <div className="cc-bar-bg" />
              <div className="cc-bar-class" style={{ width: `${stats.avgAccuracy ?? 0}%` }} />
              <div className="cc-bar-student" style={{ width: `${student.accuracy}%`, background: scoreColor(student.accuracy) }} />
            </div>
            <span className="cc-val">{Math.round(student.accuracy)}%</span>
          </div>
          <div className="cc-row">
            <span className="cc-label">放置</span>
            <div className="cc-bar-wrap">
              <div className="cc-bar-bg" />
              <div className="cc-bar-student" style={{
                width: student.totalItems > 0 ? `${(student.placed / student.totalItems) * 100}%` : '0%',
                background: 'var(--blue)',
              }} />
            </div>
            <span className="cc-val">{student.placed}/{student.totalItems}</span>
          </div>
          <div className="cc-row">
            <span className="cc-label">推理</span>
            <div className="cc-bar-wrap">
              <div className="cc-bar-bg" />
              <div className="cc-bar-student" style={{
                width: student.totalReasons > 0 ? `${(student.reasoned / student.totalReasons) * 100}%` : '0%',
                background: 'var(--ai)',
              }} />
            </div>
            <span className="cc-val">{student.reasoned}/{student.totalReasons}</span>
          </div>
          {student.time > 0 && stats.avgTime > 0 && (
            <div className="cc-row">
              <span className="cc-label">用时</span>
              <div className="cc-bar-wrap">
                <div className="cc-bar-bg" />
                <div className="cc-bar-class" style={{ width: `${Math.min(100, (stats.avgTime / Math.max(stats.avgTime, student.time)) * 100)}%` }} />
                <div className="cc-bar-student" style={{
                  width: `${Math.min(100, (student.time / Math.max(stats.avgTime, student.time)) * 100)}%`,
                  background: 'var(--blue)',
                }} />
              </div>
              <span className="cc-val">{formatTime(student.time)}</span>
            </div>
          )}
        </div>

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

        {student.llmFeedback && (
          <>
            <div className="m2-section-h">AI 评语</div>
            <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.5, padding: '8px 10px', background: 'var(--bg)', borderRadius: 6 }}>
              {student.llmFeedback}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
