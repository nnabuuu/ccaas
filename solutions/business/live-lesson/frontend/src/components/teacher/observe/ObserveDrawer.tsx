import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import type { ReadingManifest } from '../../../types/reading'
import { getStepName } from '../teacher-helpers'
import OverlayShell from './OverlayShell'

const McClassView = lazy(() => import('./mc/McClassView'))
const McStudentView = lazy(() => import('./mc/McStudentView'))
const EvidenceClassView = lazy(() => import('./evidence/EvidenceClassView'))
const EvidenceStudentView = lazy(() => import('./evidence/EvidenceStudentView'))
const MapClassView = lazy(() => import('./map/MapClassView'))
const MapStudentView = lazy(() => import('./map/MapStudentView'))
const DiscussClassView = lazy(() => import('./discuss/DiscussClassView'))
const DiscussStudentView = lazy(() => import('./discuss/DiscussStudentView'))
const MatrixClassView = lazy(() => import('./matrix/MatrixClassView'))
const MatrixStudentView = lazy(() => import('./matrix/MatrixStudentView'))
const ImageUploadClassView = lazy(() => import('./image-upload/ImageUploadClassView'))
const ImageUploadStudentView = lazy(() => import('./image-upload/ImageUploadStudentView'))
const GdClassView = lazy(() => import('./guided-discovery/GdClassView'))
const GdStudentView = lazy(() => import('./guided-discovery/GdStudentView'))

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

export default function ObserveDrawer({ type, stepNum, manifest, sessionCode, onClose }: Props) {
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

  useEffect(() => {
    setLoading(true)
    setError(null)
    setData(null)
    setSelectedStudent(null)

    const viewParam = (type === 'mc' || type === 'evidence') ? `?view=${view}` : ''
    fetch(`/api/classroom/${sessionCode}/steps/${stepNum}/observe/${type}${viewParam}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [type, stepNum, sessionCode, view])

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
          {data && !loading && (
            <Suspense fallback={<LoadingView />}>
              {type === 'mc' && <McClassView data={data} onStudentSelect={handleStudentSelect} />}
              {type === 'evidence' && <EvidenceClassView data={data} onStudentSelect={handleStudentSelect} />}
              {type === 'map' && <MapClassView data={mapData!} onStudentSelect={handleStudentSelect} />}
              {type === 'discuss' && <DiscussClassView data={data} onStudentSelect={handleStudentSelect} />}
              {type === 'matrix' && <MatrixClassView data={data} onStudentSelect={handleStudentSelect} />}
              {type === 'image-upload' && <ImageUploadClassView data={data} onStudentSelect={handleStudentSelect} />}
              {type === 'guided-discovery' && <GdClassView data={data} onStudentSelect={handleStudentSelect} />}
            </Suspense>
          )}
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
          {data && selectedStudent && (
            <Suspense fallback={<LoadingView />}>
              {type === 'mc' && <McStudentView data={data} studentId={selectedStudent} />}
              {type === 'evidence' && <EvidenceStudentView data={data} studentId={selectedStudent} />}
              {type === 'map' && <MapStudentView data={mapData!} studentId={selectedStudent} />}
              {type === 'discuss' && <DiscussStudentView data={data} studentId={selectedStudent} />}
              {type === 'matrix' && <MatrixStudentView data={data} studentId={selectedStudent} />}
              {type === 'image-upload' && <ImageUploadStudentView data={data} studentId={selectedStudent} />}
              {type === 'guided-discovery' && <GdStudentView data={data} studentId={selectedStudent} />}
            </Suspense>
          )}
        </div>
      </OverlayShell>
    </>
  )
}
