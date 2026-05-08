import { useState } from 'react'
import type { ObserveData } from '../ObserveDrawer'
import { formatTime, qColor, qBg, qLabel } from '../observe-helpers'

interface MatrixRow {
  id: string; concept: string; paraRef?: string
  whatAvg: number; whyAvg: number
  whatDist: [number, number, number, number]
  whyDist: [number, number, number, number]
}

interface MatrixStudent {
  id: string; name: string; time: number; submitted: boolean
  completion: { filled: number; total: number; pct: number }
  avgQuality: number
  responses: Record<string, { what: string; why: string; whatQ: number; whyQ: number }>
  keyInsights: string[]
}

interface MatrixPattern {
  id: string; label: string; count: number
  severity: 'high' | 'medium' | 'low'
  students: Array<{ id: string; name: string }>
}

interface MatrixData {
  stats: {
    totalStudents: number; submitted: number; avgCompletion: number
    avgQuality: number; whatAvg: number; whyAvg: number; needAttention: number
  }
  rows: MatrixRow[]
  patterns: MatrixPattern[]
  students: MatrixStudent[]
}

interface Props {
  data: ObserveData
  onStudentSelect: (studentId: string) => void
}

export default function MatrixClassView({ data, onStudentSelect }: Props) {
  const d = data as unknown as MatrixData
  const stats = d.stats || {} as MatrixData['stats']
  const rows = d.rows || []
  const patterns = d.patterns || []
  const students = d.students || []
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const total = stats.totalStudents ?? 0
  const submitted = stats.submitted ?? 0
  const colCount = rows.length * 2

  return (
    <>
      {/* Health cards */}
      <div className="obs-health">
        <div className="hcard green">
          <div className="hcard-lb">完成率</div>
          <div className="hcard-v">{stats.avgCompletion ?? 0}%</div>
          <div className="hcard-sub">{stats.submitted ?? 0}/{total} 已提交</div>
        </div>
        <div className="hcard">
          <div className="hcard-lb">平均质量</div>
          <div className="hcard-v">{(stats.avgQuality ?? 0).toFixed(1)}</div>
          <div className="hcard-sub">满分 3.0 · {qLabel(Math.round(stats.avgQuality ?? 0))}水平</div>
        </div>
        <div className="hcard">
          <div className="hcard-lb">What vs Why</div>
          <div className="hcard-v">{(stats.whatAvg ?? 0) > (stats.whyAvg ?? 0) ? 'What ↑' : 'What ≈ Why'}</div>
          <div className="hcard-sub">What {(stats.whatAvg ?? 0).toFixed(1)} · Why {(stats.whyAvg ?? 0).toFixed(1)}</div>
        </div>
        <div className="hcard warn">
          <div className="hcard-lb">需关注</div>
          <div className="hcard-v">{stats.needAttention ?? 0}</div>
          <div className="hcard-sub">质量 {'<'} 1.5 的学生</div>
        </div>
      </div>

      {/* Quality Heatmap */}
      {rows.length > 0 && students.length > 0 && (
        <div>
          <div className="m2-section-h">质量热力图</div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', marginBottom: 20, overflowX: 'auto' }}>
            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${colCount}, 1fr)`, gap: 3, marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
              <span />
              {rows.flatMap(r => [
                <span key={r.id + 'w'} style={{ fontSize: 8, fontWeight: 600, color: 'var(--t3)', textAlign: 'center', letterSpacing: '.3px' }}>{r.concept.slice(0, 6)} W</span>,
                <span key={r.id + 'y'} style={{ fontSize: 8, fontWeight: 600, color: 'var(--t3)', textAlign: 'center', letterSpacing: '.3px' }}>{r.concept.slice(0, 6)} Y</span>,
              ])}
            </div>
            {/* Student rows */}
            {students.map(s => (
              <div
                key={s.id}
                onClick={() => onStudentSelect(s.id)}
                style={{ display: 'grid', gridTemplateColumns: `80px repeat(${colCount}, 1fr)`, gap: 3, padding: '3px 0', cursor: 'pointer', borderRadius: 4 }}
                className="heatmap-row"
              >
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {s.name}
                  {!s.submitted && <span style={{ fontSize: 7, color: 'var(--red)', fontWeight: 700 }}>未交</span>}
                </span>
                {rows.flatMap(r => {
                  const rp = s.responses[r.id]
                  const wQ = rp?.whatQ ?? 0
                  const yQ = rp?.whyQ ?? 0
                  return [
                    <div key={r.id + 'w'} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <div style={{ width: 20, height: 16, borderRadius: 3, background: qBg(wQ), border: `1px solid ${wQ > 0 ? 'transparent' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: qColor(wQ) }}>
                        {wQ > 0 ? wQ : '·'}
                      </div>
                    </div>,
                    <div key={r.id + 'y'} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <div style={{ width: 20, height: 16, borderRadius: 3, background: qBg(yQ), border: `1px solid ${yQ > 0 ? 'transparent' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: qColor(yQ) }}>
                        {yQ > 0 ? yQ : '·'}
                      </div>
                    </div>,
                  ]
                })}
              </div>
            ))}
            {/* Legend */}
            <div style={{ display: 'flex', gap: 12, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 9, color: 'var(--t3)' }}>
              {[3, 2, 1, 0].map(q => (
                <span key={q} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 12, height: 10, borderRadius: 2, background: qBg(q), border: `1px solid ${q > 0 ? 'transparent' : 'var(--border)'}` }} />
                  {q} {qLabel(q)}
                </span>
              ))}
              <span style={{ marginLeft: 'auto', fontWeight: 600 }}>W = What · Y = Why</span>
            </div>
          </div>
        </div>
      )}

      {/* Per-row analysis */}
      {rows.length > 0 && (
        <div>
          <div className="m2-section-h">逐行分析</div>
          {rows.map((row, ri) => {
            const isOpen = expandedRow === row.id
            const rowAvg = ((row.whatAvg + row.whyAvg) / 2).toFixed(1)
            return (
              <div key={row.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', boxShadow: isOpen ? '0 2px 8px rgba(28,28,26,.06)' : 'none' }}>
                <div onClick={() => setExpandedRow(isOpen ? null : row.id)} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, width: 28, color: 'var(--teal)' }}>R{ri + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.concept}</div>
                    {row.paraRef && <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2 }}>{row.paraRef}</div>}
                  </div>
                  {/* Mini quality bars */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 8, color: 'var(--t3)', marginBottom: 2 }}>What</div>
                      <div style={{ width: 50, height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${row.whatAvg / 3 * 100}%`, height: '100%', borderRadius: 3, background: row.whatAvg > 2 ? 'var(--green)' : row.whatAvg > 1 ? 'var(--blue)' : 'var(--amber)' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 8, color: 'var(--t3)', marginBottom: 2 }}>Why</div>
                      <div style={{ width: 50, height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${row.whyAvg / 3 * 100}%`, height: '100%', borderRadius: 3, background: row.whyAvg > 2 ? 'var(--green)' : row.whyAvg > 1 ? 'var(--blue)' : 'var(--amber)' }} />
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: Number(rowAvg) >= 2 ? 'var(--green)' : Number(rowAvg) >= 1.2 ? 'var(--blue)' : 'var(--amber)', width: 28, textAlign: 'right' }}>{rowAvg}</span>
                  <span style={{ fontSize: 8, color: 'var(--t3)', transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
                </div>
                {isOpen && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    {/* Distribution bars */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                      {(['What', 'Why'] as const).map((col, ci) => {
                        const dist = ci === 0 ? row.whatDist : row.whyDist
                        return (
                          <div key={col}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t2)', marginBottom: 6 }}>{col} 分布</div>
                            {[3, 2, 1, 0].map(q => {
                              const cnt = dist[3 - q]
                              const pctVal = submitted > 0 ? cnt / submitted * 100 : 0
                              return (
                                <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                  <span style={{ fontSize: 9, fontWeight: 600, color: qColor(q), width: 20 }}>{qLabel(q)}</span>
                                  <div style={{ flex: 1, height: 14, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ width: `${pctVal}%`, height: '100%', borderRadius: 3, background: qColor(q), opacity: .7 }} />
                                  </div>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t2)', width: 18, textAlign: 'right' }}>{cnt}</span>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                    {/* Low-score students */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {students.filter(s => {
                        const rp = s.responses[row.id]
                        return (rp?.whatQ ?? 0) <= 1 || (rp?.whyQ ?? 0) <= 1
                      }).map(s => {
                        const rp = s.responses[row.id]
                        const worstQ = Math.min(rp?.whatQ ?? 0, rp?.whyQ ?? 0)
                        return (
                          <span key={s.id} onClick={e => { e.stopPropagation(); onStudentSelect(s.id) }} style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 3, background: worstQ === 0 ? 'var(--red-soft)' : 'var(--amber-soft)', color: worstQ === 0 ? 'var(--red)' : 'var(--amber)', cursor: 'pointer' }}>{s.name}</span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Patterns */}
      {patterns.length > 0 && (
        <div>
          <div className="m2-section-h">回答模式</div>
          {patterns.map(p => (
            <div key={p.id} style={{ background: p.severity === 'high' ? 'rgba(148,41,41,.03)' : p.severity === 'medium' ? 'rgba(196,138,30,.03)' : 'var(--surface)', border: `1px solid ${p.severity === 'high' ? 'rgba(148,41,41,.18)' : p.severity === 'medium' ? 'rgba(196,138,30,.18)' : 'var(--border)'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 3, background: p.severity === 'high' ? 'var(--red)' : p.severity === 'medium' ? 'var(--amber)' : 'var(--t3)', color: '#fff' }}>
                  {p.severity === 'high' ? '高频' : p.severity === 'medium' ? '中频' : '低频'}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{p.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: 'var(--t2)' }}>{p.count} 人</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {p.students.map(s => (
                  <span key={s.id} onClick={() => onStudentSelect(s.id)} style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: 'var(--surface2)', color: 'var(--t2)', cursor: 'pointer' }}>{s.name}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Student table */}
      {students.length > 0 && (
        <div>
          <div className="m2-section-h">全部学生</div>
          <table className="obs-table">
            <thead>
              <tr>
                <th>学生</th>
                <th>完成</th>
                <th>用时</th>
                <th>质量</th>
                <th>What/Why</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const wAvg = rows.length > 0
                  ? rows.reduce((a, r) => a + (s.responses[r.id]?.whatQ ?? 0), 0) / rows.length
                  : 0
                const yAvg = rows.length > 0
                  ? rows.reduce((a, r) => a + (s.responses[r.id]?.whyQ ?? 0), 0) / rows.length
                  : 0
                return (
                  <tr key={s.id} onClick={() => onStudentSelect(s.id)}>
                    <td style={{ fontWeight: 600 }}>
                      {s.name}
                      {!s.submitted && <span style={{ fontSize: 8, color: 'var(--red)', fontWeight: 700, marginLeft: 4 }}>未交</span>}
                    </td>
                    <td>
                      <span style={{ fontSize: 10, color: s.completion.pct === 100 ? 'var(--green)' : s.completion.pct > 50 ? 'var(--t2)' : 'var(--red)', fontWeight: 600 }}>
                        {s.completion.pct}%
                      </span>
                    </td>
                    <td style={{ color: 'var(--t2)', fontSize: 10 }}>{s.time ? formatTime(s.time) : '—'}</td>
                    <td>
                      <span style={{ fontSize: 10, fontWeight: 700, color: s.avgQuality >= 2.5 ? 'var(--green)' : s.avgQuality >= 1.5 ? 'var(--blue)' : 'var(--amber)' }}>
                        {s.avgQuality.toFixed(1)}
                      </span>
                    </td>
                    <td style={{ fontSize: 9, color: 'var(--t3)' }}>{wAvg.toFixed(1)} / {yAvg.toFixed(1)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
