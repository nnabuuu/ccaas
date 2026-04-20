import { useReadingLesson } from '../hooks/useReadingLesson'
import { useSessionCreate } from '../hooks/useClassroom'
import TeacherShell from '../components/teacher/TeacherShell'
import '../styles/teacher.css'

export default function TeacherPage() {
  const { manifest, loading, error, embed, lessonId, sessionParam } = useReadingLesson()

  if (loading) return <div style={{ padding: 40, color: 'var(--t3)' }}>Loading teacher...</div>
  if (error || !manifest || !lessonId) return <div style={{ padding: 40, color: 'var(--red)' }}>Error: {error}</div>

  // If session code is provided via query param (e.g. from DemoShell iframe), use it directly
  if (sessionParam) {
    return <TeacherShell manifest={manifest} lessonId={lessonId} sessionCode={sessionParam} embed={embed} />
  }

  return <TeacherPageInner manifest={manifest} lessonId={lessonId} embed={embed} />
}

function TeacherPageInner({ manifest, lessonId, embed }: { manifest: any; lessonId: string; embed: boolean }) {
  const { session, loading, error } = useSessionCreate(lessonId)

  if (loading) return <div style={{ padding: 40, color: 'var(--t3)' }}>正在创建课堂...</div>
  if (error || !session) return <div style={{ padding: 40, color: 'var(--red)' }}>创建课堂失败: {error}</div>

  return <TeacherShell manifest={manifest} lessonId={lessonId} sessionCode={session.code} embed={embed} />
}
