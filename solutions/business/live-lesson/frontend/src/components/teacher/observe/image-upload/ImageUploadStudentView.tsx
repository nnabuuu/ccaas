import type { ObserveData } from '../ObserveDrawer'
import { qColor, qBg, qLabel } from '../observe-helpers'
import { RenderMath } from '../../../../utils/render-math'

interface PartEntry {
  completed: boolean; attempts: number; scaffoldLevel: number
  feedback?: string
}

interface StudentEntry {
  id: string; name: string; score: number
  images: string[]
  rubricResults: Array<{ id: string; label: string; score: number; comment: string }>
  feedback: string
  keyInsights: string[]
  parts?: Record<string, PartEntry>
}

interface ImageUploadData {
  stats: {
    totalStudents: number; submitted: number; avgScore: number
  }
  students: StudentEntry[]
}

interface Props {
  data: ObserveData
  studentId: string
}

export default function ImageUploadStudentView({ data, studentId }: Props) {
  const d = data as unknown as ImageUploadData
  const classStats = d.stats || {} as ImageUploadData['stats']
  const allStudents = d.students || []
  const student = allStudents.find(s => s.id === studentId)

  if (!student) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--t3)' }}>未找到该学生数据</div>
      </div>
    )
  }

  const statusCard = student.score >= 80
    ? { cls: 'green', title: '表现优秀', body: `得分 ${student.score}/100，批改结果良好。` }
    : student.score >= 50
      ? { cls: 'blue', title: '基本完成', body: `得分 ${student.score}/100，部分维度需改进。` }
      : { cls: 'red', title: '需重点关注', body: `得分 ${student.score}/100，建议重点辅导。` }

  return (
    <div className="observe-split">
      {/* Left: Image + Rubric results */}
      <div className="observe-split-left">
        {/* Uploaded image */}
        {student.images.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="m2-section-h">学生手写作业</div>
            {student.images.filter(img => typeof img === 'string' && img.startsWith('data:image/')).map((img, i) => (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                <img
                  src={img}
                  alt={`学生作业 ${i + 1}`}
                  style={{ width: '100%', borderRadius: 6, display: 'block' }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Rubric results table */}
        {student.rubricResults.length > 0 && (
          <div>
            <div className="m2-section-h">评分详情</div>
            {student.rubricResults.map(rr => {
              const q = Math.min(3, Math.max(0, Math.round(rr.score)))
              return (
                <div key={rr.id} style={{
                  background: qBg(q),
                  border: `1px solid ${q >= 2 ? 'rgba(45,102,18,.15)' : q === 1 ? 'rgba(196,138,30,.15)' : 'rgba(148,41,41,.15)'}`,
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: rr.comment ? 6 : 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, flex: 1 }}>{rr.label}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: qColor(q), color: '#fff',
                    }}>{qLabel(q)}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: qColor(q), width: 24, textAlign: 'right' }}>
                      {rr.score}
                    </span>
                  </div>
                  {rr.comment && (
                    <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6, padding: '6px 0 0' }}>
                      {rr.comment}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Overall feedback */}
        {student.feedback && (
          <div style={{ marginTop: 12 }}>
            <div className="m2-section-h">AI 总评</div>
            <div style={{
              fontSize: 12, color: 'var(--t1)', lineHeight: 1.7,
              padding: '10px 12px', background: 'var(--surface)', borderRadius: 8,
              border: '1px solid var(--border)',
            }}><RenderMath text={student.feedback} /></div>
          </div>
        )}

        {/* Per-part feedback (OCR / LLM) */}
        {student.parts && Object.entries(student.parts).some(([, p]) => p.feedback) && (
          <div style={{ marginTop: 12 }}>
            <div className="m2-section-h">各题反馈</div>
            {Object.entries(student.parts).map(([partId, p]) => p.feedback ? (
              <div key={partId} style={{
                fontSize: 12, color: 'var(--t1)', lineHeight: 1.6,
                padding: '8px 12px', background: 'var(--surface)', borderRadius: 8,
                border: '1px solid var(--border)', marginBottom: 6,
              }}><RenderMath text={p.feedback} /></div>
            ) : null)}
          </div>
        )}
      </div>

      {/* Right: Status + Insights + Comparison */}
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

        {/* Per-rubric quality bars */}
        {student.rubricResults.length > 0 && (
          <>
            <div className="m2-section-h">维度得分</div>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
              {student.rubricResults.map(rr => {
                const q = Math.min(3, Math.max(0, Math.round(rr.score)))
                return (
                  <div key={rr.id} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--t2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rr.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 12, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${(rr.score / 3) * 100}%`, height: '100%', borderRadius: 3, background: qColor(q), opacity: .7 }} />
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: qColor(q), width: 18, textAlign: 'right' }}>{rr.score}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Class comparison */}
        <div className="m2-section-h">班级对比</div>
        <div className="class-compare">
          {[
            { label: '得分', val: student.score, avg: classStats.avgScore ?? 0, max: 100, format: (v: number) => `${Math.round(v)}` },
          ].map((row, i) => (
            <div key={i} className="cc-row">
              <div className="cc-label">{row.label}</div>
              <div className="cc-bar-wrap">
                <div className="cc-bar-bg" />
                <div className="cc-marker" style={{ left: `${(row.avg / row.max) * 100}%`, background: 'rgba(28,28,26,.14)' }} />
                <div className="cc-bar-student" style={{
                  width: `${(row.val / row.max) * 100}%`,
                  background: row.val >= row.avg ? 'var(--green-dot)' : 'var(--amber-dot)',
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
