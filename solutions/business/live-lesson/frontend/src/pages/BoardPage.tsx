import { useState, useEffect, useCallback } from 'react'
import { useReadingLesson } from '../hooks/useReadingLesson'
import BoardStage from '../components/board/BoardStage'
import BoardScrubber from '../components/board/BoardScrubber'
import type { RevealPointer } from '../types/reading'
import '../styles/board.css'

export default function BoardPage() {
  const { manifest, loading, error, embed } = useReadingLesson()
  const [pointer, setPointer] = useState<RevealPointer>({ step: 1, sub: 1 })
  const [justRevealedId, setJustRevealedId] = useState<string>()

  const handleRevealCommand = useCallback((dir: string) => {
    setPointer(prev => {
      if (dir === 'next') return { step: prev.step, sub: prev.sub + 1 }
      if (dir === 'prev') return { step: prev.step, sub: Math.max(1, prev.sub - 1) }
      if (dir === 'reset') return { step: 1, sub: 1 }
      if (dir === 'all') return { step: 99, sub: 999 }
      return prev
    })
  }, [])

  // postMessage sync listener
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'sync' && typeof e.data.step === 'number') {
        // step from orchestrator is 0-indexed, board steps are 1-indexed
        setPointer({ step: e.data.step + 1, sub: 999 })
      }
      if (e.data?.type === 'reveal') {
        handleRevealCommand(e.data.dir)
      }
    }
    window.addEventListener('message', onMessage)
    // Send ready signal
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'ready', role: 'board' }, window.location.origin)
    }
    return () => window.removeEventListener('message', onMessage)
  }, [handleRevealCommand])

  const handlePointerChange = useCallback((p: RevealPointer) => {
    setPointer(p)
    setJustRevealedId(undefined)
  }, [])

  if (loading) return <div style={{ padding: 40, color: 'var(--t3)' }}>Loading board...</div>
  if (error || !manifest) return <div style={{ padding: 40, color: 'var(--red)' }}>Error: {error}</div>
  if (!manifest.boardData) return <div style={{ padding: 40, color: 'var(--t3)' }}>No board data available.</div>

  return (
    <div data-surface="board" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--t1)' }}>
      <BoardStage
        board={manifest.boardData}
        pointer={pointer}
        justRevealedId={justRevealedId}
      />
      {!embed && (
        <BoardScrubber
          blocks={manifest.boardData.blocks}
          steps={manifest.boardData.steps}
          pointer={pointer}
          onPointerChange={handlePointerChange}
        />
      )}
    </div>
  )
}
