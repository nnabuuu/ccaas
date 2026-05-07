import { useMemo } from 'react'
import type { ObserveData } from '../ObserveDrawer'
import { formatTime, qColor, qBg, qLabel } from '../observe-helpers'

interface MatrixRow {
  id: string; concept: string; paraRef?: string
  whatAvg: number; whyAvg: number
}

interface MatrixStudent {
  id: string; name: string; time: number; submitted: boolean
  completion: { filled: number; total: number; pct: number }
  avgQuality: number
  responses: Record<string, { what: string; why: string; whatQ: number; whyQ: number }>
  keyInsights: string[]
}

interface MatrixData extends ObserveData {
  stats: {
    totalStudents: number; avgCompletion: number; avgQuality: number
    whatAvg: number; whyAvg: number
  }
  rows: MatrixRow[]
  students: MatrixStudent[]
}

interface Props {
  data: ObserveData
  studentId: string
}

export default function MatrixStudentView({ data, studentId }: Props) {
  const d = data as MatrixData
  const classStats = d.stats || {} as MatrixData['stats']
  const rows = d.rows || []
  const allStudents = d.students || []
  const student = allStudents.find(s => s.id === studentId)

  if (!student) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--t3)' }}>未找到该学生数据</div>
      </div>
    )
  }

  const comp = student.completion
  const avgQ = student.avgQuality

  // Per-student what/why averages
  const { whatAvg, whyAvg } = useMemo(() => {
    const vals = Object.values(student.responses)
    if (vals.length === 0) return { whatAvg: 0, whyAvg: 0 }
    const wSum = vals.reduce((a, v) => a + v.whatQ, 0)
    const ySum = vals.reduce((a, v) => a + v.whyQ, 0)
    return { whatAvg: wSum / vals.length, whyAvg: ySum / vals.length }
  }, [student.responses])

  const gap = Math.abs(whatAvg - whyAvg)

  // Status card
  const statusCard = avgQ >= 2.5
    ? { cls: 'green', title: '质量优秀', body: `完成 ${comp.filled}/${comp.total} 格，平均质量 ${avgQ.toFixed(1)}/3.0。` }
    : avgQ >= 1.5
      ? { cls: 'blue', title: '质量良好', body: `完成 ${comp.filled}/${comp.total} 格，平均质量 ${avgQ.toFixed(1)}/3.0。有提升空间。` }
      : { cls: 'red', title: '需重点关注', body: `完成 ${comp.filled}/${comp.total} 格，平均质量 ${avgQ.toFixed(1)}/3.0。建议重点辅导。` }

  // Class averages for comparison
  const classAvgQ = classStats.avgQuality ?? 0
  const classAvgComp = classStats.avgCompletion ?? 0
  const classAvgTime = allStudents.length > 0 ? allStudents.reduce((a, s) => a + s.time, 0) / allStudents.length : 0

  return (
    <div className="observe-split">
      {/* Left: Stats + Full Matrix */}
      <div className="observe-split-left">
        {/* Mini stats */}
        <div className="obs-stats-grid cols-4">
          <div className="obs-stat-cell">
            <div className="obs-stat-v" style={{ color: comp.pct === 100 ? 'var(--green)' : comp.pct > 50 ? 'var(--blue)' : 'var(--red)' }}>{comp.filled}/{comp.total}</div>
            <div className="obs-stat-lb">完成</div>
          </div>
          <div className="obs-stat-cell">
            <div className="obs-stat-v" style={{ color: avgQ >= 2.5 ? 'var(--green)' : avgQ >= 1.5 ? 'var(--blue)' : 'var(--amber)' }}>{avgQ.toFixed(1)}</div>
            <div className="obs-stat-lb">质量</div>
          </div>
          <div className="obs-stat-cell">
            <div className="obs-stat-v">{student.time ? formatTime(student.time) : '—'}</div>
            <div className="obs-stat-lb">用时</div>
          </div>
          <div className="obs-stat-cell">
            <div className="obs-stat-v" style={{ fontSize: 13, color: student.submitted ? 'var(--green)' : 'var(--red)' }}>{student.submitted ? '已交' : '未交'}</div>
            <div className="obs-stat-lb">状态</div>
          </div>
        </div>

        {/* Full matrix responses */}
        <div className="m2-section-h">矩阵回答详情</div>
        {rows.map((row, ri) => {
          const rp = student.responses[row.id]
          const wQ = rp?.whatQ ?? 0
          const yQ = rp?.whyQ ?? 0
          const rowAvg = (wQ + yQ) / 2
          const borderClr = rowAvg >= 2.5 ? 'rgba(45,102,18,.15)' : rowAvg >= 1.5 ? 'rgba(26,95,160,.15)' : rowAvg > 0 ? 'rgba(196,138,30,.15)' : 'rgba(148,41,41,.15)'
          const bgClr = rowAvg >= 2.5 ? 'rgba(45,102,18,.02)' : rowAvg >= 1.5 ? 'rgba(26,95,160,.02)' : rowAvg > 0 ? 'rgba(196,138,30,.02)' : 'rgba(148,41,41,.02)'

          return (
            <div key={row.id} style={{ background: bgClr, border: `1px solid ${borderClr}`, borderRadius: 8, padding: '14px 16px', marginBottom: 10 }}>
              {/* Row header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)' }}>R{ri + 1}</span>
                <span style={{ fontSize: 11, fontWeight: 600 }}>{row.concept}</span>
                {row.paraRef && <span style={{ fontSize: 9, color: 'var(--t3)', background: 'var(--surface2)', padding: '2px 6px', borderRadius: 3 }}>{row.paraRef}</span>}
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: rowAvg >= 2.5 ? 'var(--green)' : rowAvg >= 1.5 ? 'var(--blue)' : rowAvg > 0 ? 'var(--amber)' : 'var(--red)' }}>
                  {rowAvg > 0 ? rowAvg.toFixed(1) : '—'}
                </span>
              </div>
              {/* What */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.4px' }}>What 是什么</span>
                  <span style={{ fontSize: 8, fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: qBg(wQ), color: qColor(wQ) }}>{qLabel(wQ)}</span>
                </div>
                {rp?.what
                  ? <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.7, padding: '8px 10px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)' }}>{rp.what}</div>
                  : <div style={{ fontSize: 11, color: 'var(--t3)', fontStyle: 'italic', padding: '8px 10px', background: 'var(--surface2)', borderRadius: 6 }}>未填写</div>
                }
              </div>
              {/* Why */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Why 为什么</span>
                  <span style={{ fontSize: 8, fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: qBg(yQ), color: qColor(yQ) }}>{qLabel(yQ)}</span>
                </div>
                {rp?.why
                  ? <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.7, padding: '8px 10px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)' }}>{rp.why}</div>
                  : <div style={{ fontSize: 11, color: 'var(--t3)', fontStyle: 'italic', padding: '8px 10px', background: 'var(--surface2)', borderRadius: 6 }}>未填写</div>
                }
              </div>
            </div>
          )
        })}
      </div>

      {/* Right: Insights + Comparison */}
      <div className="observe-split-right">
        {/* Status card */}
        <div className={`obs-status-card ${statusCard.cls}`}>
          <div className="obs-sc-title">{statusCard.title}</div>
          <div className="obs-sc-body">{statusCard.body}</div>
        </div>

        {/* Key insights */}
        <div className="m2-section-h">关键发现</div>
        {(student.keyInsights || []).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
            {student.keyInsights.map((insight, i) => (
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

        {/* Per-row quality bars */}
        <div className="m2-section-h">逐行质量</div>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
          {rows.map((row, ri) => {
            const rp = student.responses[row.id]
            const wQ = rp?.whatQ ?? 0
            const yQ = rp?.whyQ ?? 0
            return (
              <div key={row.id} style={{ marginBottom: ri < rows.length - 1 ? 10 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--teal)', width: 22 }}>R{ri + 1}</span>
                  <span style={{ fontSize: 10, color: 'var(--t2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.concept}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 8, color: 'var(--t3)', width: 26 }}>What</span>
                  <div style={{ flex: 1, height: 12, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${wQ / 3 * 100}%`, height: '100%', borderRadius: 3, background: qColor(wQ), opacity: .7 }} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: qColor(wQ), width: 18, textAlign: 'right' }}>{wQ || '—'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 8, color: 'var(--t3)', width: 26 }}>Why</span>
                  <div style={{ flex: 1, height: 12, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${yQ / 3 * 100}%`, height: '100%', borderRadius: 3, background: qColor(yQ), opacity: .7 }} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: qColor(yQ), width: 18, textAlign: 'right' }}>{yQ || '—'}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* What vs Why comparison */}
        <div className="m2-section-h">What vs Why 对比</div>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <div style={{ flex: 1, textAlign: 'center', padding: 8, background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: whatAvg >= 2 ? 'var(--green)' : whatAvg >= 1 ? 'var(--blue)' : 'var(--amber)' }}>{whatAvg.toFixed(1)}</div>
              <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', marginTop: 2 }}>What 均分</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: 8, background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: whyAvg >= 2 ? 'var(--green)' : whyAvg >= 1 ? 'var(--blue)' : 'var(--amber)' }}>{whyAvg.toFixed(1)}</div>
              <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', marginTop: 2 }}>Why 均分</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--t2)', lineHeight: 1.5 }}>
            {gap < 0.3
              ? 'What和Why水平均衡。'
              : whatAvg > whyAvg
                ? `What (${whatAvg.toFixed(1)}) 明显优于 Why (${whyAvg.toFixed(1)})——能描述现象但难以解释原因。`
                : `Why (${whyAvg.toFixed(1)}) 优于 What (${whatAvg.toFixed(1)})——分析能力较好但描述不够具体。`}
          </div>
        </div>

        {/* Class comparison */}
        <div className="m2-section-h">班级对比</div>
        <div className="class-compare">
          {[
            { label: '质量', val: avgQ, avg: classAvgQ, max: 3, format: (v: number) => v.toFixed(1) },
            { label: '完成率', val: comp.pct, avg: classAvgComp, max: 100, format: (v: number) => `${Math.round(v)}%` },
            { label: '用时', val: student.time, avg: classAvgTime, max: Math.max(student.time, classAvgTime, 1), format: (v: number) => v ? formatTime(v) : '—', invert: true },
          ].map((row, i) => (
            <div key={i} className="cc-row">
              <div className="cc-label">{row.label}</div>
              <div className="cc-bar-wrap">
                <div className="cc-bar-bg" />
                <div className="cc-marker" style={{ left: `${(row.avg / row.max) * 100}%`, background: 'rgba(28,28,26,.14)' }} />
                <div className="cc-bar-student" style={{
                  width: `${(row.val / row.max) * 100}%`,
                  background: (row.invert ? row.val < row.avg : row.val > row.avg) ? 'var(--green-dot)' : 'var(--amber-dot)',
                }} />
              </div>
              <div className="cc-val">{row.format(row.val)}</div>
            </div>
          ))}
          <div className="cc-legend">
            <div className="cc-legend-item">
              <span className="d" style={{ background: 'var(--green-dot)' }} />
              该学生
            </div>
            <div className="cc-legend-item">
              <span className="d" style={{ background: 'rgba(28,28,26,.14)' }} />
              班级均值
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
