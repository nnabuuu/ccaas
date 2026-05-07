import type { ObserveData } from '../ObserveDrawer'
import { scoreColor, formatTime, statusLevel } from '../observe-helpers'

interface EvidenceStudentData extends ObserveData {
  stats: { totalStudents: number; allDone: number; evidenceHitRate: number }
  sections: Array<{ id: string; label: string }>
  students: Array<{
    id: string; name: string; completed: boolean; time: number
    sections: Record<string, {
      func: string; funcCorrect: boolean; attempts: number
      evidenceHit: number; evidenceTotal: number
      wrongPicks?: string[]; perfect: boolean; missed?: string[]
    }>
    keyInsights: string[]
  }>
}

interface Props {
  data: ObserveData
  studentId: string
  onBack?: () => void
}

export default function EvidenceStudentView({ data, studentId }: Props) {
  const d = data as EvidenceStudentData
  const students = d.students || []
  const student = students.find(s => s.id === studentId)
  const sections = d.sections || []
  const stats = (d.stats || {}) as EvidenceStudentData['stats']

  if (!student) {
    return (
      <div className="observe-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--t3)' }}>未找到该学生数据</div>
      </div>
    )
  }

  const studentSections = student.sections || {}
  const sectionEntries = sections.map(sec => ({ def: sec, result: studentSections[sec.id] }))

  const completedCount = sectionEntries.filter(e => e.result).length
  const perfectCount = sectionEntries.filter(e => e.result?.perfect).length
  const wrongPicksCount = sectionEntries.reduce((acc, e) => acc + (e.result?.wrongPicks?.length ?? 0), 0)

  let totalHit = 0
  let totalEvidence = 0
  for (const e of sectionEntries) {
    if (e.result) {
      totalHit += e.result.evidenceHit
      totalEvidence += e.result.evidenceTotal
    }
  }
  const studentHitRate = totalEvidence > 0 ? Math.round((totalHit / totalEvidence) * 100) : 0

  const overallScore = sections.length > 0 ? Math.round((perfectCount / sections.length) * 100) : 0
  const sl = statusLevel(overallScore)

  const classAvgCompleted = stats.allDone ?? 0
  const classAvgHitRate = stats.evidenceHitRate ?? 0

  return (
    <div className="observe-split">
      {/* Left: section details */}
      <div className="observe-split-left">
        {/* Status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 10, color: student.completed ? 'var(--green)' : 'var(--t3)', marginLeft: 'auto' }}>
            {student.completed ? '已完成' : '进行中'}
          </span>
        </div>

        {/* Stats grid */}
        <div className="obs-stats-grid cols-4">
          <div className="obs-stat-cell">
            <div className="obs-stat-v">{completedCount}/{sections.length}</div>
            <div className="obs-stat-lb">已完成</div>
          </div>
          <div className="obs-stat-cell">
            <div className="obs-stat-v" style={{ color: 'var(--green)' }}>{perfectCount}</div>
            <div className="obs-stat-lb">Perfect</div>
          </div>
          <div className="obs-stat-cell">
            <div className="obs-stat-v" style={{ color: scoreColor(studentHitRate) }}>{studentHitRate}%</div>
            <div className="obs-stat-lb">Evidence 命中</div>
          </div>
          <div className="obs-stat-cell">
            <div className="obs-stat-v" style={{ color: wrongPicksCount > 0 ? 'var(--red)' : 'var(--t1)' }}>{wrongPicksCount}</div>
            <div className="obs-stat-lb">错选</div>
          </div>
        </div>

        {/* Section cards */}
        <div className="m2-section-h">逐 Section 详情</div>
        {sectionEntries.map(({ def: sec, result: ss }) => {
          const bg = ss?.perfect
            ? 'var(--green-soft)'
            : ss && ss.funcCorrect === false
              ? 'var(--red-soft)'
              : 'var(--surface)'
          return (
            <div key={sec.id} style={{
              padding: '8px 10px', marginBottom: 6, borderRadius: 6,
              background: bg, border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{sec.label}</div>
              {ss ? (
                <>
                  <div style={{ fontSize: 10, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    功能:
                    <strong style={{ color: ss.funcCorrect ? 'var(--green)' : 'var(--red)' }}>
                      {ss.func} {ss.funcCorrect ? '✓' : '✗'}
                    </strong>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 2 }}>
                    尝试次数: {ss.attempts}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 2 }}>
                    Evidence: {ss.evidenceHit}/{ss.evidenceTotal}
                  </div>
                  {(ss.wrongPicks?.length ?? 0) > 0 && (
                    <div style={{
                      fontSize: 9, color: 'var(--red)', marginTop: 4,
                      padding: '4px 6px', background: 'var(--red-soft)', borderRadius: 4,
                    }}>
                      错选: {ss.wrongPicks!.join(', ')}
                    </div>
                  )}
                  {(ss.missed?.length ?? 0) > 0 && (
                    <div style={{
                      fontSize: 9, color: 'var(--amber)', marginTop: 4,
                      padding: '4px 6px', background: 'var(--amber-soft)', borderRadius: 4,
                    }}>
                      遗漏: {ss.missed!.join(', ')}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 10, color: 'var(--t3)' }}>未作答</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Right: status + comparison */}
      <div className="observe-split-right">
        {/* Status card */}
        <div className={`obs-status-card ${sl.level}`}>
          <div className="obs-sc-title">{sl.title}</div>
          <div className="obs-sc-body">
            {perfectCount === sections.length
              ? '所有 Section 均 Perfect'
              : `${perfectCount}/${sections.length} Section Perfect · Evidence 命中 ${studentHitRate}%`}
          </div>
        </div>

        {/* Evidence hit comparison bars */}
        <div className="m2-section-h">Evidence 命中分布</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {sectionEntries.map(({ def: sec, result: ss }) => {
            const hitRate = ss && ss.evidenceTotal > 0
              ? Math.round((ss.evidenceHit / ss.evidenceTotal) * 100)
              : 0
            return (
              <div key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 9, color: 'var(--t3)', width: 56, flexShrink: 0 }}>{sec.label}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${hitRate}%`, height: '100%', borderRadius: 3,
                    background: ss ? scoreColor(hitRate) : 'var(--surface2)',
                  }} />
                </div>
                <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--t2)', width: 32, textAlign: 'right' }}>
                  {ss ? `${hitRate}%` : '—'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Class comparison */}
        <div className="m2-section-h">班级对比</div>
        <div className="class-compare">
          <div className="cc-row">
            <span className="cc-label">完成</span>
            <div className="cc-bar-wrap">
              <div className="cc-bar-bg" />
              <div className="cc-bar-class" style={{ width: `${stats.totalStudents ? Math.round((classAvgCompleted / stats.totalStudents) * 100) : 0}%` }} />
              <div className="cc-bar-student" style={{
                width: `${sections.length > 0 ? Math.round((completedCount / sections.length) * 100) : 0}%`,
                background: 'var(--green)',
              }} />
            </div>
            <span className="cc-val">{completedCount}/{sections.length}</span>
          </div>
          <div className="cc-row">
            <span className="cc-label">Perfect</span>
            <div className="cc-bar-wrap">
              <div className="cc-bar-bg" />
              <div className="cc-bar-student" style={{
                width: `${sections.length > 0 ? Math.round((perfectCount / sections.length) * 100) : 0}%`,
                background: scoreColor(overallScore),
              }} />
            </div>
            <span className="cc-val">{perfectCount}/{sections.length}</span>
          </div>
          <div className="cc-row">
            <span className="cc-label">Evidence</span>
            <div className="cc-bar-wrap">
              <div className="cc-bar-bg" />
              <div className="cc-bar-class" style={{ width: `${classAvgHitRate}%` }} />
              <div className="cc-bar-student" style={{
                width: `${studentHitRate}%`,
                background: scoreColor(studentHitRate),
              }} />
            </div>
            <span className="cc-val">{studentHitRate}%</span>
          </div>
          {student.time > 0 && (
            <div className="cc-row">
              <span className="cc-label">用时</span>
              <div className="cc-bar-wrap">
                <div className="cc-bar-bg" />
              </div>
              <span className="cc-val">{formatTime(student.time)}</span>
            </div>
          )}
        </div>

        {/* Key insights */}
        {(student.keyInsights || []).length > 0 && (
          <>
            <div className="m2-section-h" style={{ marginTop: 16 }}>关键发现</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {student.keyInsights.map((insight: string, i: number) => (
                <div key={i} style={{
                  fontSize: 11, color: 'var(--t2)', lineHeight: 1.4,
                  padding: '6px 8px', background: 'var(--bg)', borderRadius: 5,
                  borderLeft: '2px solid var(--amber-dot)',
                }}>{insight}</div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
