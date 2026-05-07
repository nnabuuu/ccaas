import { useState, useEffect, lazy, Suspense } from 'react'
import type { ReadingManifest } from '../../../types/reading'
import type { ClassroomState } from '../../../hooks/useClassroom'
import { getStepName } from '../teacher-helpers'

const McClassView = lazy(() => import('./mc/McClassView'))
const McStudentView = lazy(() => import('./mc/McStudentView'))
const EvidenceClassView = lazy(() => import('./evidence/EvidenceClassView'))
const EvidenceStudentView = lazy(() => import('./evidence/EvidenceStudentView'))
const MapClassView = lazy(() => import('./map/MapClassView'))
const MapStudentView = lazy(() => import('./map/MapStudentView'))
const DiscussClassView = lazy(() => import('./discuss/DiscussClassView'))
const DiscussStudentView = lazy(() => import('./discuss/DiscussStudentView'))

export interface ObserveData {
  stats: Record<string, unknown>
  students: Array<Record<string, unknown>>
  [key: string]: unknown
}

interface Props {
  type: string
  stepNum: number
  manifest: ReadingManifest
  state: ClassroomState
  sessionCode: string
  onClose: () => void
  onStudentClick: (name: string) => void
}

const TYPE_LABELS: Record<string, string> = {
  mc: 'Quiz 观察',
  evidence: 'Evidence 观察',
  map: 'Map 观察',
  discuss: 'Discuss 观察',
}

export default function ObserveDrawer({ type, stepNum, manifest, state: _state, sessionCode, onClose, onStudentClick: _onStudentClick }: Props) {
  const [data, setData] = useState<ObserveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'class' | 'student'>('class')
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)

  const taskSteps = manifest.readingSteps
    .filter(rs => rs.type === 'task')
    .sort((a, b) => a.idx - b.idx)
  const step = taskSteps[stepNum - 1]
  const stepName = step ? getStepName(step) : `Step ${stepNum}`
  // Extract axes from manifest for map exercises
  const axes = step?.answerKey?.axes as { x: { neg: string; pos: string }; y: { neg: string; pos: string } } | undefined

  useEffect(() => {
    setLoading(true)
    setError(null)
    setData(null)
    setView('class')
    setSelectedStudent(null)

    fetch(`/api/classroom/${sessionCode}/steps/${stepNum}/observe/${type}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [type, stepNum, sessionCode])

  const handleStudentSelect = (studentId: string) => {
    setSelectedStudent(studentId)
    setView('student')
  }

  const handleBackToClass = () => {
    setView('class')
    setSelectedStudent(null)
  }

  return (
    <div className="observe-overlay" onClick={(e) => {
      if ((e.target as HTMLElement).classList.contains('observe-overlay')) onClose()
    }}>
      <div className="observe-drawer">
        {/* Band */}
        <div className="observe-band">
          <span className="observe-band-title">{TYPE_LABELS[type] || type}</span>
          <span className="observe-band-sub">{stepName} · Step {stepNum}</span>
          <button className="observe-band-close" onClick={onClose}>关闭 ✕</button>
        </div>

        {/* Tabs */}
        <div className="observe-tabs">
          <button
            className={`observe-tab${view === 'class' ? ' active' : ''}`}
            onClick={handleBackToClass}
          >班级总览</button>
          <button
            className={`observe-tab${view === 'student' ? ' active' : ''}`}
            onClick={() => { if (selectedStudent) setView('student') }}
            style={!selectedStudent ? { opacity: 0.4, cursor: 'default' } : undefined}
          >个人详情</button>
        </div>

        {/* Body */}
        {loading && (
          <div className="observe-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--t3)' }}>加载中...</div>
          </div>
        )}
        {error && (
          <div className="observe-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--red)' }}>加载失败: {error}</div>
          </div>
        )}
        {data && !loading && (
          <Suspense fallback={<div className="observe-body" style={{ alignItems: 'center', justifyContent: 'center' }}><div style={{ fontSize: 13, color: 'var(--t3)' }}>加载组件...</div></div>}>
            {view === 'class' && type === 'mc' && <McClassView data={data} onStudentSelect={handleStudentSelect} />}
            {view === 'student' && type === 'mc' && selectedStudent && <McStudentView data={data} studentId={selectedStudent} onBack={handleBackToClass} />}
            {view === 'class' && type === 'evidence' && <EvidenceClassView data={data} onStudentSelect={handleStudentSelect} />}
            {view === 'student' && type === 'evidence' && selectedStudent && <EvidenceStudentView data={data} studentId={selectedStudent} onBack={handleBackToClass} />}
            {view === 'class' && type === 'map' && <MapClassView data={axes && !data.axes ? { ...data, axes } : data} onStudentSelect={handleStudentSelect} />}
            {view === 'student' && type === 'map' && selectedStudent && <MapStudentView data={axes && !data.axes ? { ...data, axes } : data} studentId={selectedStudent} onBack={handleBackToClass} />}
            {view === 'class' && type === 'discuss' && <DiscussClassView data={data} onStudentSelect={handleStudentSelect} />}
            {view === 'student' && type === 'discuss' && selectedStudent && <DiscussStudentView data={data} studentId={selectedStudent} onBack={handleBackToClass} />}
          </Suspense>
        )}
      </div>
    </div>
  )
}
