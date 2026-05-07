import { useState } from 'react'
import type { ObserveData } from '../ObserveDrawer'
import { scoreColor, formatTime, coordToPct, deviationColor } from '../observe-helpers'

interface MapData extends ObserveData {
  stats: { totalStudents: number; submitted: number; allPlacedCount: number; avgAccuracy: number; misconceptionCount: number }
  axes?: { x: { neg: string; pos: string }; y: { neg: string; pos: string } }
  items: Array<{
    id: string; label: string; expected?: [number, number]
    studentPlacements: Array<{ studentId: string; studentName: string; x: number; y: number; deviation: number }>
    avgDeviation: number; accuracyRate: number
  }>
  misconceptions: Array<{ id: string; label: string; count: number; severity: string }>
  students: Array<{
    id: string; name: string; placed: number; totalItems: number; reasoned: number; totalReasons: number
    avgDeviation: number; accuracy: number; time: number; keyInsights: string[]
  }>
}

interface Props {
  data: ObserveData
  onStudentSelect: (studentId: string) => void
}

export default function MapClassView({ data, onStudentSelect }: Props) {
  const d = data as MapData
  const stats = (d.stats || {}) as MapData['stats']
  const items = d.items || []
  const misconceptions = d.misconceptions || []
  const students = d.students || []
  const axes = d.axes

  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [hoveredDot, setHoveredDot] = useState<{ studentName: string; x: number; y: number } | null>(null)

  const filteredItems = activeFilter ? items.filter(it => it.id === activeFilter) : items

  // Accuracy distribution counts
  const highCount = students.filter(s => s.accuracy >= 70).length
  const midCount = students.filter(s => s.accuracy >= 40 && s.accuracy < 70).length
  const lowCount = students.filter(s => s.accuracy < 40).length
  const totalForDist = students.length || 1

  return (
    <>
      {/* Health cards */}
      <div className="obs-health">
        <div className="hcard">
          <div className="hcard-lb">已提交</div>
          <div className="hcard-v">{stats.submitted ?? 0}/{stats.totalStudents ?? 0}</div>
        </div>
        <div className="hcard green">
          <div className="hcard-lb">全部放置</div>
          <div className="hcard-v">{stats.allPlacedCount ?? 0}</div>
          <div className="hcard-sub">{items.length}/{items.length} items</div>
        </div>
        <div className="hcard">
          <div className="hcard-lb">平均准确度</div>
          <div className="hcard-v" style={{ color: scoreColor(stats.avgAccuracy ?? 0) }}>
            {stats.avgAccuracy != null ? `${Math.round(stats.avgAccuracy)}%` : '--'}
          </div>
        </div>
        <div className="hcard">
          <div className="hcard-lb">误解聚类</div>
          <div className="hcard-v">{stats.misconceptionCount ?? 0}</div>
        </div>
      </div>

      {/* Coordinate Plane */}
      <div className="m2-section-h">坐标分布</div>
      <div className="coord-plane" style={{ width: 340, height: 340 }}>
        {/* Grid lines — vertical at 25%, 50%, 75% */}
        {[25, 50, 75].map(p => (
          <div key={`v${p}`} className="coord-grid-line" style={{ left: `${p}%`, top: 0, width: 1, height: '100%' }} />
        ))}
        {/* Grid lines — horizontal at 25%, 50%, 75% */}
        {[25, 50, 75].map(p => (
          <div key={`h${p}`} className="coord-grid-line" style={{ top: `${p}%`, left: 0, height: 1, width: '100%' }} />
        ))}
        {/* Center axes */}
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

        {/* Expected zones */}
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

        {/* Student dots */}
        {filteredItems.flatMap(item =>
          (item.studentPlacements || []).map(sp => {
            const cx = coordToPct(sp.x)
            const cy = 100 - coordToPct(sp.y)
            return (
              <div
                key={`${item.id}-${sp.studentId}`}
                className="coord-dot"
                style={{
                  left: `${cx}%`,
                  top: `${cy}%`,
                  background: deviationColor(sp.deviation),
                }}
                onMouseEnter={() => setHoveredDot({ studentName: sp.studentName, x: cx, y: cy })}
                onMouseLeave={() => setHoveredDot(null)}
                onClick={() => onStudentSelect(sp.studentId)}
              />
            )
          })
        )}

        {/* Tooltip */}
        {hoveredDot && (
          <div className="coord-tooltip" style={{ left: `${hoveredDot.x}%`, top: `${hoveredDot.y}%` }}>
            {hoveredDot.studentName}
          </div>
        )}
      </div>

      {/* Item filter buttons */}
      <div className="obs-item-filters">
        <button
          className={`obs-item-btn${activeFilter === null ? ' active' : ''}`}
          onClick={() => setActiveFilter(null)}
        >全部</button>
        {items.map(item => (
          <button
            key={item.id}
            className={`obs-item-btn${activeFilter === item.id ? ' active' : ''}`}
            onClick={() => setActiveFilter(item.id)}
          >{item.label}</button>
        ))}
      </div>

      {/* Per-item spread summary */}
      {items.length > 0 && (
        <div>
          <div className="m2-section-h">各项准确度</div>
          <div className="obs-item-spread">
            {items.map(item => {
              const color = item.accuracyRate >= 70 ? 'var(--green-dot)' : item.accuracyRate >= 40 ? 'var(--blue)' : 'var(--red)'
              return (
                <div key={item.id} className="obs-item-spread-row">
                  <span className="obs-item-spread-label">{item.label}</span>
                  <div className="obs-item-spread-bar">
                    <div className="obs-item-spread-fill" style={{ width: `${item.accuracyRate}%`, background: color }} />
                  </div>
                  <span className="obs-item-spread-val">d {item.avgDeviation != null && !isNaN(item.avgDeviation) ? item.avgDeviation.toFixed(2) : '--'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Accuracy distribution */}
      {students.length > 0 && (
        <div>
          <div className="m2-section-h">准确度分布</div>
          <div className="obs-accuracy-dist">
            {highCount > 0 && (
              <div className="obs-accuracy-seg high" style={{ width: `${(highCount / totalForDist) * 100}%` }}>
                {highCount}
              </div>
            )}
            {midCount > 0 && (
              <div className="obs-accuracy-seg mid" style={{ width: `${(midCount / totalForDist) * 100}%` }}>
                {midCount}
              </div>
            )}
            {lowCount > 0 && (
              <div className="obs-accuracy-seg low" style={{ width: `${(lowCount / totalForDist) * 100}%` }}>
                {lowCount}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 9, color: 'var(--t3)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--green-dot)', display: 'inline-block' }} />
              高 &gt;=70% ({highCount})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--blue)', display: 'inline-block' }} />
              中 40-70% ({midCount})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--red)', display: 'inline-block' }} />
              低 &lt;40% ({lowCount})
            </span>
          </div>
        </div>
      )}

      {/* Misconceptions */}
      {misconceptions.length > 0 && (
        <div>
          <div className="m2-section-h">误解模式</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {misconceptions.map(m => (
              <div key={m.id} className={`misc-card${m.severity === 'high' ? ' high' : ''}`}>
                <div className="misc-label">{m.label}</div>
                <div className="misc-count">{m.count} 人</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student table */}
      {students.length > 0 && (
        <div>
          <div className="m2-section-h">学生列表</div>
          <table className="obs-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>放置</th>
                <th>Reasoning</th>
                <th>用时</th>
                <th>准确度</th>
                <th>关键发现</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id} onClick={() => onStudentSelect(s.id)}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{s.placed ?? 0}/{s.totalItems ?? 0}</td>
                  <td>{s.reasoned ?? 0}/{s.totalReasons ?? 0}</td>
                  <td>{s.time > 0 ? formatTime(s.time) : '--'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ flex: 1, height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden', minWidth: 30 }}>
                        <div style={{ width: `${s.accuracy}%`, height: '100%', borderRadius: 2, background: scoreColor(s.accuracy) }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: scoreColor(s.accuracy) }}>
                        {Math.round(s.accuracy)}%
                      </span>
                    </div>
                  </td>
                  <td style={{ fontSize: 10 }}>
                    {(s.keyInsights || []).join('; ') || '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
