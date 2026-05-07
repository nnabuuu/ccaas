import type { ObserveData } from '../ObserveDrawer'

interface MapStudentData extends ObserveData {
  items: Array<{ id: string; label: string; expected?: [number, number] }>
  students: Array<{
    id: string; name: string
    placements: Record<string, [number, number]>
    reasons: Record<string, string>
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

  return (
    <div className="observe-split">
      <div className="observe-split-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button className="observe-band-close" onClick={onBack} style={{ padding: '4px 8px', fontSize: 11 }}>← 返回</button>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{student.name}</span>
        </div>

        <div className="m2-section-h">逐项放置</div>
        {items.map((item) => {
          const pos = placements[item.id]
          const reason = reasons[item.id]
          const expected = item.expected
          const deviation = pos && expected
            ? Math.sqrt(Math.pow(pos[0] - expected[0], 2) + Math.pow(pos[1] - expected[1], 2))
            : null
          return (
            <div key={item.id} style={{
              padding: '8px 10px', marginBottom: 6, borderRadius: 6,
              background: 'var(--surface)', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{item.label}</div>
              {pos ? (
                <div style={{ fontSize: 10, color: 'var(--t2)' }}>
                  放置: ({pos[0]?.toFixed(1)}, {pos[1]?.toFixed(1)})
                  {expected && (
                    <span style={{ marginLeft: 8, color: 'var(--t3)' }}>
                      预期: ({expected[0]?.toFixed(1)}, {expected[1]?.toFixed(1)})
                    </span>
                  )}
                  {deviation != null && (
                    <span style={{
                      marginLeft: 8, fontWeight: 600,
                      color: deviation < 1 ? 'var(--green)' : deviation < 2 ? 'var(--amber)' : 'var(--red)',
                    }}>偏差 {deviation.toFixed(1)}</span>
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
