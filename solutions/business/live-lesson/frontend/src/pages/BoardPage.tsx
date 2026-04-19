import { useReadingLesson } from '../hooks/useReadingLesson'
import BoardStage from '../components/board/BoardStage'
import '../styles/board.css'

export default function BoardPage() {
  const { manifest, loading, error, embed } = useReadingLesson()

  if (loading) return <div style={{ padding: 40, color: 'var(--rd-t3)' }}>Loading board...</div>
  if (error || !manifest) return <div style={{ padding: 40, color: 'var(--rd-red)' }}>Error: {error}</div>

  return (
    <div data-surface="board">
      <BoardStage board={manifest.boardData} embed={embed} />
    </div>
  )
}
