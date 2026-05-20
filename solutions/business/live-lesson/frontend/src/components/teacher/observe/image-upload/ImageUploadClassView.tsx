import { useState, useMemo } from 'react'
import type { ObserveData } from '../ObserveDrawer'
import { qColor, qLabel } from '../observe-helpers'

interface RubricStat {
  id: string; label: string; avgScore: number
  distribution: Record<number, number>
}

interface StudentEntry {
  id: string; name: string; score: number
  images: string[]
  rubricResults: Array<{ id: string; label: string; score: number; comment: string }>
  feedback: string
  keyInsights: string[]
  scaffoldTier?: 'independent' | 'partial' | 'full'
  method?: 'handwrite' | 'photo'
}

interface ImageUploadData {
  stats: {
    totalStudents: number; submitted: number; avgScore: number
    perfectCount: number; pendingReview: number
  }
  rubricStats: RubricStat[]
  students: StudentEntry[]
  scaffoldDistribution?: { independent: number; partial: number; full: number }
}

interface Props {
  data: ObserveData
  onStudentSelect: (studentId: string) => void
}

export default function ImageUploadClassView({ data, onStudentSelect }: Props) {
  const d = data as unknown as ImageUploadData
  const stats = d.stats || {} as ImageUploadData['stats']
  const rubricStats = d.rubricStats || []
  const students = d.students || []

  const total = stats.totalStudents ?? 0
  const submitted = stats.submitted ?? 0

  const avgScore = Math.round(stats.avgScore ?? 0)

  // Gap 4: Filter chips + scaffold awareness
  const [filter, setFilter] = useState('all')
  const hasScaffold = students.some(s => s.scaffoldTier)
  const scaffoldDist = d.scaffoldDistribution

  const filterCounts = useMemo(() => ({
    all: students.length,
    high: students.filter(s => s.score >= 80).length,
    low: students.filter(s => s.score < 50).length,
    scaffold: hasScaffold ? students.filter(s => s.scaffoldTier && s.scaffoldTier !== 'independent').length : 0,
  }), [students, hasScaffold])

  const filteredStudents = useMemo(() => {
    switch (filter) {
      case 'high': return students.filter(s => s.score >= 80)
      case 'low': return students.filter(s => s.score < 50)
      case 'scaffold': return students.filter(s => s.scaffoldTier && s.scaffoldTier !== 'independent')
      default: return students
    }
  }, [students, filter])

  return (
    <>
      {/* Gap 5: Hero stats */}
      <div style={{ display: 'flex', gap: 16, padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--t1)', lineHeight: 1 }}>
            {submitted}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--t3)' }}>/{total}</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>已提交</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: avgScore >= 80 ? 'var(--green)' : avgScore >= 50 ? 'var(--amber)' : 'var(--red)', lineHeight: 1 }}>
            {avgScore}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--t3)' }}>%</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>平均正确率</div>
        </div>
        {scaffoldDist && (
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, fontSize: 12, fontWeight: 700 }}>
              <span style={{ color: 'var(--green)' }}>{scaffoldDist.independent}</span>
              <span style={{ color: 'var(--amber)' }}>{scaffoldDist.partial}</span>
              <span style={{ color: 'var(--red)' }}>{scaffoldDist.full}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>独立 / 提示 / 全部</div>
          </div>
        )}
      </div>
      {/* Detail cards */}
      <div className="obs-health">
        <div className="hcard green">
          <div className="hcard-lb">满分</div>
          <div className="hcard-v">{stats.perfectCount ?? 0}</div>
        </div>
        {(stats.pendingReview ?? 0) > 0 && (
          <div className="hcard warn">
            <div className="hcard-lb">待批阅</div>
            <div className="hcard-v">{stats.pendingReview}</div>
          </div>
        )}
      </div>

      {/* Rubric breakdown */}
      {rubricStats.length > 0 && (
        <div>
          <div className="m2-section-h">评分维度分析</div>
          {rubricStats.map(rs => {
            const gradedCount = Object.values(rs.distribution).reduce((a, b) => a + b, 0)
            return (
              <div key={rs.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{rs.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: rs.avgScore >= 2.5 ? 'var(--green)' : rs.avgScore >= 1.5 ? 'var(--blue)' : 'var(--amber)' }}>
                    {rs.avgScore.toFixed(1)}/3
                  </span>
                </div>
                {/* Distribution bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {[3, 2, 1, 0].map(q => {
                    const cnt = rs.distribution[q] || 0
                    const pctVal = gradedCount > 0 ? (cnt / gradedCount) * 100 : 0
                    return (
                      <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 600, color: qColor(q), width: 24 }}>{qLabel(q)}</span>
                        <div style={{ flex: 1, height: 12, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pctVal}%`, height: '100%', borderRadius: 3, background: qColor(q), opacity: .7 }} />
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t2)', width: 18, textAlign: 'right' }}>{cnt}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Student table with filter chips (Gap 4) */}
      {students.length > 0 && (
        <div>
          <div className="m2-section-h">全部学生</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {[
              { id: 'all', label: `全部 ${filterCounts.all}` },
              { id: 'high', label: `优秀 ${filterCounts.high}` },
              { id: 'low', label: `需关注 ${filterCounts.low}` },
              ...(hasScaffold ? [{ id: 'scaffold', label: `使用提示 ${filterCounts.scaffold}` }] : []),
            ].map(chip => (
              <button key={chip.id} className={`obs-tab${filter === chip.id ? ' active' : ''}`} onClick={() => setFilter(chip.id)}>
                {chip.label}
              </button>
            ))}
          </div>
          <table className="obs-table">
            <thead>
              <tr>
                <th>学生</th>
                <th>得分</th>
                <th>关键发现</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(s => (
                <tr key={s.id} onClick={() => onStudentSelect(s.id)}>
                  <td style={{ fontWeight: 600 }}>
                    {s.name}
                    {s.scaffoldTier && s.scaffoldTier !== 'independent' && (
                      <span style={{
                        marginLeft: 4, fontSize: 9, padding: '1px 4px', borderRadius: 2,
                        background: s.scaffoldTier === 'full' ? 'var(--red-soft)' : 'var(--amber-soft)',
                        color: s.scaffoldTier === 'full' ? 'var(--red)' : 'var(--amber)',
                        fontWeight: 600,
                      }}>{s.scaffoldTier === 'full' ? '全部提示' : '部分提示'}</span>
                    )}
                  </td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.score >= 80 ? 'var(--green)' : s.score >= 50 ? 'var(--blue)' : 'var(--amber)' }}>
                      {s.score}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(s.keyInsights || []).map((ins, i) => (
                        <span key={i} style={{
                          fontSize: 9, padding: '2px 6px', borderRadius: 3,
                          background: ins.startsWith('✓') ? 'var(--green-soft)' : ins.startsWith('缺失') ? 'var(--red-soft)' : 'var(--amber-soft)',
                          color: ins.startsWith('✓') ? 'var(--green)' : ins.startsWith('缺失') ? 'var(--red)' : 'var(--amber)',
                          fontWeight: 600,
                        }}>{ins}</span>
                      ))}
                    </div>
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
