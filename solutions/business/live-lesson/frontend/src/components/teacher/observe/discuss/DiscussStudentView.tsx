import type { ObserveData } from '../ObserveDrawer'

interface DiscussStudentData extends ObserveData {
  students: Array<{
    id: string; name: string; method: 'socratic' | 'fallback'
    goalReached: boolean; roundsUsed: number; timeUsedSeconds: number
    completionType: string
    conversation: Array<{ role: 'ai' | 'student'; text: string }>
    keyInsights: string[]
  }>
}

interface Props {
  data: ObserveData
  studentId: string
  onBack: () => void
}

export default function DiscussStudentView({ data, studentId, onBack }: Props) {
  const d = data as DiscussStudentData
  const students = d.students || []
  const student = students.find(s => s.id === studentId)

  if (!student) {
    return (
      <div className="observe-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--t3)' }}>未找到该学生数据</div>
        <button className="observe-band-close" onClick={onBack}>返回</button>
      </div>
    )
  }

  const conversation = student.conversation || []

  return (
    <div className="observe-split">
      <div className="observe-split-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button className="observe-band-close" onClick={onBack} style={{ padding: '4px 8px', fontSize: 11 }}>← 返回</button>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{student.name}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, marginLeft: 'auto',
            color: student.goalReached ? 'var(--green)' : 'var(--t3)',
          }}>
            {student.goalReached ? '已达标' : '未达标'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 10, color: 'var(--t3)' }}>
          <span>方式: {student.method === 'socratic' ? '苏格拉底' : '自由讨论'}</span>
          <span>轮次: {student.roundsUsed ?? '—'}</span>
          <span>用时: {student.timeUsedSeconds ? `${Math.round(student.timeUsedSeconds)}s` : '—'}</span>
          <span>结束: {student.completionType || '—'}</span>
        </div>

        <div className="m2-section-h">对话回放</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {conversation.map((msg, i) => (
            <div key={i} className={`chat-row ${msg.role === 'student' ? 'stu' : 'ai'}`}>
              <div className="who">{msg.role === 'student' ? '学生' : 'AI'}</div>
              <div className="chat-bubble">{msg.text}</div>
            </div>
          ))}
          {conversation.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>暂无对话记录</div>
          )}
        </div>
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

        <div className="m2-section-h">讨论评估</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--t2)' }}>
            达标: <strong style={{ color: student.goalReached ? 'var(--green)' : 'var(--red)' }}>
              {student.goalReached ? '是' : '否'}
            </strong>
          </div>
          <div style={{ fontSize: 11, color: 'var(--t2)' }}>
            轮次: <strong>{student.roundsUsed ?? '—'}</strong>
          </div>
        </div>
      </div>
    </div>
  )
}
