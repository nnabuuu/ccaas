import { useReadingLesson } from '../hooks/useReadingLesson'
import DemoShell from '../components/orchestrator/DemoShell'
import '../styles/orchestrator.css'

export default function DemoPage() {
  const { manifest, loading, error } = useReadingLesson()

  if (loading) return <div style={{ padding: 40, color: 'var(--rd-t3)' }}>Loading demo...</div>
  if (error || !manifest) return <div style={{ padding: 40, color: 'var(--rd-red)' }}>Error: {error}</div>

  return <DemoShell manifest={manifest} />
}
