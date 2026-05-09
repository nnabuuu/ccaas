import { useState, useEffect, useRef, useCallback } from 'react'
import type { ReadingManifest } from '../../types/reading'

export function Band({ manifest, total, sessionCode, onEndSession, ending }: {
  manifest: ReadingManifest; total: number; sessionCode?: string
  onEndSession?: () => void; ending?: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => { clearTimeout(timer.current) }, [])

  const handleClick = useCallback(() => {
    if (ending) return
    if (!confirming) {
      setConfirming(true)
      timer.current = setTimeout(() => setConfirming(false), 3000)
    } else {
      clearTimeout(timer.current)
      setConfirming(false)
      onEndSession?.()
    }
  }, [confirming, ending, onEndSession])

  return (
    <div className="band">
      <div className="band-mark">R</div>
      <div className="band-title">课堂观察台</div>
      <div className="band-mode">观察模式</div>
      <div className="band-self">学生自主推进</div>
      <div className="band-class">
        {sessionCode && <>{sessionCode} · </>}
        {manifest.title} · {total} 人 · {manifest.readingSteps.length} Tasks
      </div>
      <div className="band-right">
        {onEndSession && (
          <button
            className={`band-end-btn${confirming ? ' confirming' : ''}`}
            onClick={handleClick}
            disabled={ending}
          >
            {ending ? '结束中...' : confirming ? '确认结束？' : '结束课堂'}
          </button>
        )}
        <div className="band-live">实时同步中</div>
      </div>
    </div>
  )
}
