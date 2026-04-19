import { useReadingLesson } from '../hooks/useReadingLesson'
import StudentShell from '../components/student/StudentShell'
import '../styles/student.css'

export default function StudentPage() {
  const { manifest, loading, error, embed } = useReadingLesson()

  if (loading) return <div style={{ padding: 40, color: 'var(--rd-t3)' }}>Loading student...</div>
  if (error || !manifest) return <div style={{ padding: 40, color: 'var(--rd-red)' }}>Error: {error}</div>

  return <StudentShell manifest={manifest} embed={embed} />
}
