import type { ReadingManifest } from '../../types/reading'

export function Band({ manifest, total, sessionCode }: { manifest: ReadingManifest; total: number; sessionCode?: string }) {
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
        <div className="band-live">实时同步中</div>
      </div>
    </div>
  )
}
