import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSessionLookup, useStudentSession } from '../hooks/useClassroom'
import type { ReadingManifest } from '../types/reading'
import StudentShell from '../components/student/StudentShell'
import '../styles/student.css'

export default function JoinPage() {
  const [searchParams] = useSearchParams()
  const sessionFromUrl = searchParams.get('session')
  const embed = searchParams.get('embed') === '1'

  const [codeInput, setCodeInput] = useState(sessionFromUrl || '')
  const [nameInput, setNameInput] = useState('')
  const [joinStep, setJoinStep] = useState<'code' | 'name' | 'joined'>(sessionFromUrl ? 'code' : 'code')
  const [manifest, setManifest] = useState<ReadingManifest | null>(null)
  const [autoLookupDone, setAutoLookupDone] = useState(false)

  const lookup = useSessionLookup()
  const sessionCode = lookup.session?.code ?? ''
  const lessonId = lookup.session?.lessonId ?? ''
  const session = useStudentSession(sessionCode)

  const fetchManifest = useCallback(async (lid: string): Promise<ReadingManifest | null> => {
    try {
      const res = await fetch(`/lessons/${lid}/manifest.json`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [])

  // Auto-lookup if session code is in URL
  useEffect(() => {
    if (sessionFromUrl && !autoLookupDone) {
      setAutoLookupDone(true)
      lookup.lookup(sessionFromUrl).then(s => {
        if (s) {
          fetchManifest(s.lessonId).then(m => {
            if (m) {
              setManifest(m)
              setJoinStep('name')
            }
          })
        }
      })
    }
  }, [sessionFromUrl, autoLookupDone, lookup, fetchManifest])

  // Restore from localStorage on mount (only if no URL param)
  useEffect(() => {
    if (sessionFromUrl) return
    const keys = Object.keys(localStorage).filter(k => k.startsWith('classroom:session:'))
    for (const key of keys) {
      try {
        const saved = JSON.parse(localStorage.getItem(key) || '')
        if (saved?.studentId && saved?.lessonId) {
          const code = key.replace('classroom:session:', '')
          setCodeInput(code)
          lookup.lookup(code).then(s => {
            if (s) {
              fetchManifest(saved.lessonId).then(m => {
                if (m) {
                  setManifest(m)
                  setJoinStep('joined')
                }
              })
            }
          })
          break
        }
      } catch { /* noop */ }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCodeSubmit = useCallback(async () => {
    const code = codeInput.trim().toUpperCase()
    if (code.length !== 6) return
    const s = await lookup.lookup(code)
    if (s) {
      const m = await fetchManifest(s.lessonId)
      if (m) {
        setManifest(m)
        setJoinStep('name')
      }
    }
  }, [codeInput, lookup, fetchManifest])

  const handleJoin = useCallback(async () => {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    await session.join(trimmed)
    setJoinStep('joined')
  }, [nameInput, session])

  // Already joined — render student shell
  if (joinStep === 'joined' && manifest && sessionCode && session.studentId) {
    return <StudentShell manifest={manifest} lessonId={lessonId} sessionCode={sessionCode} embed={embed} />
  }

  return (
    <div className="stu-join-overlay">
      <div className="stu-join-card" style={{ width: 360 }}>
        {joinStep === 'code' && (
          <>
            <div className="stu-join-title">加入课堂</div>
            <div className="stu-join-sub">输入老师提供的 6 位课堂码</div>
            <input
              className="stu-join-input stu-join-code"
              placeholder="课堂码..."
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase().slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && handleCodeSubmit()}
              autoFocus
              maxLength={6}
            />
            {lookup.error && (
              <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{lookup.error}</div>
            )}
            <button
              className="stu-btn pri"
              onClick={handleCodeSubmit}
              disabled={lookup.loading || codeInput.trim().length !== 6}
            >
              {lookup.loading ? '验证中...' : '下一步'}
            </button>
          </>
        )}

        {joinStep === 'name' && manifest && (
          <>
            <div className="stu-join-title">{manifest.title}</div>
            <div className="stu-join-sub">
              课堂码 <span className="session-code-sm">{sessionCode}</span> · 输入姓名加入
            </div>
            <input
              className="stu-join-input"
              placeholder="你的姓名..."
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              autoFocus
            />
            {session.joinError && (
              <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{session.joinError}</div>
            )}
            <button
              className="stu-btn pri"
              onClick={handleJoin}
              disabled={session.joining || !nameInput.trim()}
            >
              {session.joining ? '加入中...' : '加入课堂'}
            </button>
            <button
              className="stu-btn ghost"
              onClick={() => { setJoinStep('code'); setCodeInput('') }}
              style={{ marginTop: 8 }}
            >
              ← 重新输入课堂码
            </button>
          </>
        )}
      </div>
    </div>
  )
}
