import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useSessionLookup, useStudentSession, useStudentStream, fetchStudentProgress, type StudentProgress } from '../hooks/useClassroom'
import { fetchManifest } from '../hooks/useManifest'
import type { ReadingManifest } from '../types/reading'
import StudentShell from '../components/student/StudentShell'
import '../styles/student.css'

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const embed = searchParams.get('embed') === '1'

  const lookup = useSessionLookup()
  const sessionCode = lookup.session?.code ?? ''
  const session = useStudentSession(sessionCode)

  const [manifest, setManifest] = useState<ReadingManifest | null>(null)
  const [initialProgress, setInitialProgress] = useState<StudentProgress | null>(null)
  const [_checking, setChecking] = useState(true)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    if (!sessionId) {
      navigate('/join', { replace: true })
      return
    }

    lookup.lookup(sessionId).then(async s => {
      if (!s) {
        navigate('/join', { replace: true })
        return
      }

      // Check localStorage directly — hook state hasn't propagated yet
      const storageKey = `classroom:session:${s.code}`
      let saved: { studentId?: string } | null = null
      try { saved = JSON.parse(localStorage.getItem(storageKey) || 'null') }
      catch { /* noop */ }

      if (!saved?.studentId) {
        const qs = new URLSearchParams({ session: s.code })
        if (embed) qs.set('embed', '1')
        navigate(`/join?${qs}`, { replace: true })
        return
      }

      const [m, progress] = await Promise.all([
        fetchManifest(s.lessonId),
        fetchStudentProgress(s.code, saved.studentId),
      ])
      if (m) {
        setManifest(m)
        setInitialProgress(progress)
      } else {
        navigate('/join', { replace: true })
      }
    }).finally(() => setChecking(false))
  }, [sessionId, navigate, embed, lookup, fetchManifest])

  const lookupStatus = lookup.session?.status as 'waiting' | 'active' | 'ended' | undefined
  const stream = useStudentStream(sessionCode, lookupStatus)

  if (manifest && sessionCode && session.studentId) {
    if (stream.sessionStatus === 'waiting') {
      return (
        <div className="stu-join-overlay">
          <div className="stu-join-card" style={{ width: 380, textAlign: 'center' }}>
            <div className="stu-join-title">{manifest.title}</div>
            <div style={{ fontSize: 14, color: 'var(--t2)', margin: '8px 0 4px' }}>{session.name}</div>
            <div style={{ fontSize: 13, color: 'var(--t3)', margin: '20px 0 16px' }}>等待老师开始上课</div>
            <div className="stu-lobby-pulse" />
            <div className="session-code-sm" style={{ marginTop: 20 }}>{sessionCode}</div>
          </div>
        </div>
      )
    }

    if (stream.sessionStatus === 'ended') {
      return (
        <div className="stu-join-overlay">
          <div className="stu-join-card" style={{ width: 380, textAlign: 'center' }}>
            <div className="stu-join-title">课堂已结束</div>
          </div>
        </div>
      )
    }

    if (stream.sessionStatus === 'active') {
      return (
        <StudentShell
          manifest={manifest}
          sessionCode={sessionCode}
          studentId={session.studentId ?? undefined}
          embed={embed}
          submit={session.submit}
          initialProgress={initialProgress}
        />
      )
    }

    // SSE not connected yet
    return (
      <div className="stu-join-overlay">
        <div className="stu-join-card" style={{ width: 360, textAlign: 'center' }}>
          <div className="stu-join-title">连接中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="stu-join-overlay">
      <div className="stu-join-card" style={{ width: 360, textAlign: 'center' }}>
        <div className="stu-join-title">加载中...</div>
      </div>
    </div>
  )
}
