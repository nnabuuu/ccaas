import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useSessionLookup, useStudentSession } from '../hooks/useClassroom'
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

      const m = await fetchManifest(s.lessonId)
      if (m) {
        setManifest(m)
      } else {
        navigate('/join', { replace: true })
      }
    }).finally(() => setChecking(false))
  }, [sessionId, navigate, embed, lookup, fetchManifest])

  if (manifest && sessionCode && session.studentId) {
    return (
      <StudentShell
        manifest={manifest}
        sessionCode={sessionCode}
        studentId={session.studentId ?? undefined}
        embed={embed}
        submit={session.submit}
      />
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
