import { useReadingLesson } from '../hooks/useReadingLesson'
import TeacherShell from '../components/teacher/TeacherShell'
import '../styles/teacher.css'

export default function TeacherPage() {
  const { manifest, loading, error, embed } = useReadingLesson()

  if (loading) return <div style={{ padding: 40, color: 'var(--rd-t3)' }}>Loading teacher...</div>
  if (error || !manifest) return <div style={{ padding: 40, color: 'var(--rd-red)' }}>Error: {error}</div>

  return <TeacherShell manifest={manifest} embed={embed} />
}
