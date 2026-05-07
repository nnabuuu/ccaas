import type { ObserveData } from '../ObserveDrawer'

interface EvidenceStudentData extends ObserveData {
  sections: Array<{ id: string; label: string }>
  students: Array<{
    id: string; name: string; completed: boolean
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
  onBack: () => void
}

export default function EvidenceStudentView({ data, studentId, onBack }: Props) {
  const d = data as EvidenceStudentData
  const students = d.students || []
  const student = students.find(s => s.id === studentId)
  const sections = d.sections || []

  if (!student) {
    return (
      <div className="observe-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--t3)' }}>未找到该学生数据</div>
        <button className="observe-band-close" onClick={onBack}>返回</button>
      </div>
    )
  }

  const studentSections = student.sections || {}

  return (
    <div className="observe-split">
      <div className="observe-split-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button className="observe-band-close" onClick={onBack} style={{ padding: '4px 8px', fontSize: 11 }}>← 返回</button>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{student.name}</span>
          <span style={{ fontSize: 10, color: student.completed ? 'var(--green)' : 'var(--t3)', marginLeft: 'auto' }}>
            {student.completed ? '已完成' : '进行中'}
          </span>
        </div>

        <div className="m2-section-h">逐 Section 详情</div>
        {sections.map((sec) => {
          const ss = studentSections[sec.id] || {}
          return (
            <div key={sec.id} style={{
              padding: '8px 10px', marginBottom: 6, borderRadius: 6,
              background: ss.perfect ? 'var(--green-soft)' : ss.funcCorrect === false ? 'var(--red-soft)' : 'var(--surface)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{sec.label}</div>
              <div style={{ fontSize: 10, color: 'var(--t2)' }}>
                功能: <strong style={{ color: ss.funcCorrect ? 'var(--green)' : ss.funcCorrect === false ? 'var(--red)' : 'var(--t3)' }}>
                  {ss.func || '—'} {ss.funcCorrect ? '✓' : ss.funcCorrect === false ? '✗' : ''}
                </strong>
              </div>
              {ss.evidenceHit != null && (
                <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 2 }}>
                  Evidence: {ss.evidenceHit}/{ss.evidenceTotal}
                </div>
              )}
              {(ss.wrongPicks?.length ?? 0) > 0 && (
                <div style={{ fontSize: 9, color: 'var(--red)', marginTop: 2 }}>
                  错选: {ss.wrongPicks!.join(', ')}
                </div>
              )}
              {(ss.missed?.length ?? 0) > 0 && (
                <div style={{ fontSize: 9, color: 'var(--amber)', marginTop: 2 }}>
                  遗漏: {ss.missed!.join(', ')}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="observe-split-right">
        <div className="m2-section-h">关键发现</div>
        {(student.keyInsights || []).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {student.keyInsights.map((insight: string, i: number) => (
              <div key={i} style={{
                fontSize: 11, color: 'var(--t2)', lineHeight: 1.4,
                padding: '6px 8px', background: 'var(--bg)', borderRadius: 5,
                borderLeft: '2px solid var(--amber-dot)',
              }}>{insight}</div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>暂无</div>
        )}
      </div>
    </div>
  )
}
