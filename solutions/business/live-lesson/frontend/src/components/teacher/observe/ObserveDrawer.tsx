import { useState, useEffect, useMemo, Suspense } from 'react'
import type { ReadingManifest } from '../../../types/reading'
import { getStepName } from '../teacher-helpers'
import OverlayShell from './OverlayShell'
import { getObserveView } from './observe-view-registry'

export interface ObserveData {
  stats: Record<string, unknown>
  students: Array<Record<string, unknown>>
  [key: string]: unknown
}

interface Props {
  type: string
  stepNum: number
  manifest: ReadingManifest
  sessionCode: string
  partIds?: string[]
  onClose: () => void
}

const TYPE_LABELS: Record<string, string> = {
  mc: 'Quiz 观察',
  evidence: 'Evidence 观察',
  map: 'Map 观察',
  discuss: 'Discuss 观察',
  matrix: 'Matrix 观察',
  'image-upload': '手写批改观察',
  'guided-discovery': '引导探究观察',
}

function LoadingView() {
  return (
    <div className="observe-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: 'var(--t3)' }}>加载中...</div>
    </div>
  )
}

function ErrorView({ error }: { error: string }) {
  return (
    <div className="observe-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: 'var(--red)' }}>加载失败: {error}</div>
    </div>
  )
}

export default function ObserveDrawer({ type, stepNum, manifest, sessionCode, partIds, onClose }: Props) {
  const [data, setData] = useState<ObserveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [view, setView] = useState<'first' | 'latest'>('first')

  const taskSteps = manifest.readingSteps
    .filter(rs => rs.type === 'task')
    .sort((a, b) => a.idx - b.idx)
  const step = taskSteps[stepNum - 1]
  const stepName = step ? getStepName(step) : `Step ${stepNum}`
  const axes = step?.answerKey?.axes as { x: { neg: string; pos: string }; y: { neg: string; pos: string } } | undefined

  const partIdsKey = partIds?.join(',') ?? ''

  useEffect(() => {
    setLoading(true)
    setError(null)
    setData(null)
    setSelectedStudent(null)

    const params = new URLSearchParams()
    if (type === 'mc' || type === 'evidence') params.set('view', view)
    if (partIdsKey) params.set('partIds', partIdsKey)
    const qs = params.toString()
    fetch(`/api/classroom/${sessionCode}/steps/${stepNum}/observe/${type}${qs ? `?${qs}` : ''}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [type, stepNum, sessionCode, view, partIdsKey])

  const studentIds = useMemo(
    () => (data?.students || []).map(s => s.id as string),
    [data],
  )

  const selectedStudentName = useMemo(
    () => data?.students?.find(s => s.id === selectedStudent)?.name as string ?? '',
    [data, selectedStudent],
  )

  const currentIdx = selectedStudent ? studentIds.indexOf(selectedStudent) : -1
  const prevStudent = currentIdx > 0 ? studentIds[currentIdx - 1] : null
  const nextStudent = currentIdx >= 0 && currentIdx < studentIds.length - 1 ? studentIds[currentIdx + 1] : null

  const handleStudentSelect = (studentId: string) => {
    setSelectedStudent(studentId)
  }

  const handleCloseStudent = () => {
    setSelectedStudent(null)
  }

  const mapData = axes && data && !data.axes ? { ...data, axes } : data

  return (
    <>
      {/* Layer 0: Class observe */}
      <OverlayShell open={true} onClose={onClose} depth={0}>
        <div className="observe-band">
          <span className="observe-band-title">{TYPE_LABELS[type] || type}</span>
          <span className="observe-band-sub">{stepName} · Step {stepNum}</span>
          {(type === 'mc' || type === 'evidence') && (
            <div className="obs-view-toggle">
              <button
                className={`obs-vt-btn${view === 'first' ? ' active' : ''}`}
                onClick={() => setView('first')}
              >首次</button>
              <button
                className={`obs-vt-btn${view === 'latest' ? ' active' : ''}`}
                onClick={() => setView('latest')}
              >最新</button>
            </div>
          )}
          <button className="observe-band-close" onClick={onClose}>✕</button>
        </div>
        <div className="observe-body">
          {loading && <LoadingView />}
          {error && <ErrorView error={error} />}
          {data && !loading && (() => {
            const entry = getObserveView(type)
            if (!entry) return null
            const ClassView = entry.ClassView
            const cvData = entry.useMapData ? mapData! : data
            return (
              <Suspense fallback={<LoadingView />}>
                <ClassView data={cvData} onStudentSelect={handleStudentSelect} />
              </Suspense>
            )
          })()}
        </div>
      </OverlayShell>

      {/* Layer 1: Student detail */}
      <OverlayShell open={!!selectedStudent} onClose={handleCloseStudent} depth={1}>
        <div className="observe-band">
          <button
            className="observe-band-nav"
            disabled={!prevStudent}
            onClick={() => prevStudent && handleStudentSelect(prevStudent)}
          >‹</button>
          <span className="observe-band-title">{selectedStudentName}</span>
          <button
            className="observe-band-nav"
            disabled={!nextStudent}
            onClick={() => nextStudent && handleStudentSelect(nextStudent)}
          >›</button>
          <button className="observe-band-close" onClick={handleCloseStudent}>✕</button>
        </div>
        <div className="observe-body">
          {data && selectedStudent && (() => {
            const entry = getObserveView(type)
            if (!entry) return null
            const StudentView = entry.StudentView
            const svData = entry.useMapData ? mapData! : data
            return (
              <Suspense fallback={<LoadingView />}>
                <StudentView data={svData} studentId={selectedStudent} />
              </Suspense>
            )
          })()}
        </div>
      </OverlayShell>
    </>
  )
}
