import type { ClassroomState } from '../../hooks/useClassroom'
import { getStudentGlobalStatus, hasAI } from './teacher-helpers'

interface SubTaskRowProps {
  label: string
  icon: string
  count: number
  students: ClassroomState['students']
  onStudentClick: (name: string) => void
  questions: ClassroomState['questions']
  onClick?: () => void
  clickable?: boolean
  avgScore?: number
}

export function SubTaskRow({ label, icon, count, students, onStudentClick, questions, onClick, clickable, avgScore }: SubTaskRowProps) {
  return (
    <div
      className={`subtask-row${clickable ? ' clickable' : ''}`}
      onClick={clickable ? (e) => { e.stopPropagation(); onClick?.() } : undefined}
    >
      <span className="str-icon">{icon}</span>
      <span className="str-label">{label}</span>
      <span className="str-count">{count}</span>
      {avgScore != null && avgScore > 0 && (
        <span className="str-score" style={{ color: avgScore >= 80 ? 'var(--green)' : avgScore >= 50 ? 'var(--amber)' : 'var(--red)' }}>
          {Math.round(avgScore)}%
        </span>
      )}
      {clickable && <span className="str-arrow">→</span>}
      {students.length > 0 && (
        <div className="str-dots">
          {students.slice(0, 8).map(s => {
            const status = getStudentGlobalStatus(s)
            const ai = hasAI(s, questions)
            return (
              <div
                key={s.id}
                className={`sdot sm ${status}`}
                title={s.name}
                onClick={(e) => { e.stopPropagation(); onStudentClick(s.name) }}
              >
                {s.name.substring(0, 2)}
                {ai && <span className="ai-pip" />}
                {s.bonusStatus && s.bonusStatus !== 'none' && <span className="bonus-pip" />}
              </div>
            )
          })}
          {students.length > 8 && <span className="sdot-more">+{students.length - 8}</span>}
        </div>
      )}
    </div>
  )
}
