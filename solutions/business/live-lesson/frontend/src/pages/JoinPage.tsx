import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useSessionLookup, useStudentSession } from '../hooks/useClassroom'
import { fetchManifest } from '../hooks/useManifest'
import type { ReadingManifest } from '../types/reading'
import '../styles/student.css'

interface SavedSessionInfo {
  sessionId: string
  code: string
  title: string
  studentName: string
}

export default function JoinPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sessionFromUrl = searchParams.get('session')
  const embed = searchParams.get('embed') === '1'

  const [codeInput, setCodeInput] = useState(sessionFromUrl || '')
  const [nameInput, setNameInput] = useState('')
  const [joinStep, setJoinStep] = useState<'code' | 'name'>('code')
  const [manifest, setManifest] = useState<ReadingManifest | null>(null)
  const [autoLookupDone, setAutoLookupDone] = useState(false)
  const [savedSessions, setSavedSessions] = useState<SavedSessionInfo[]>([])

  const lookup = useSessionLookup()
  const sessionCode = lookup.session?.code ?? ''
  const session = useStudentSession(sessionCode)
  const checkedRef = useRef(false)

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
  }, [sessionFromUrl, autoLookupDone, lookup])

  // Check localStorage for saved sessions → batch-verify with backend → show restore options
  useEffect(() => {
    if (sessionFromUrl || checkedRef.current) return
    checkedRef.current = true

    const keys = Object.keys(localStorage).filter(k => k.startsWith('classroom:session:'))
    if (keys.length === 0) return

    // Collect sessionIds and local names from localStorage
    const localMap = new Map<string, { key: string; name: string }>()
    for (const key of keys) {
      try {
        const saved = JSON.parse(localStorage.getItem(key) || '')
        if (!saved?.studentId) continue
        const id = saved.sessionId
        if (id) localMap.set(id, { key, name: saved.name || '' })
      } catch { /* noop */ }
    }
    if (localMap.size === 0) return

    const checkAll = async () => {
      try {
        const resp = await fetch('/api/classroom/sessions/batch-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionIds: [...localMap.keys()] }),
        })
        if (!resp.ok) return
        const activeSessions: Array<{ sessionId: string; code: string; title: string }> = await resp.json()

        // Clean up ended/missing sessions from localStorage
        const activeIds = new Set(activeSessions.map(s => s.sessionId))
        for (const [id, { key }] of localMap) {
          if (!activeIds.has(id)) localStorage.removeItem(key)
        }

        setSavedSessions(activeSessions.map(s => ({
          sessionId: s.sessionId,
          code: s.code,
          title: s.title,
          studentName: localMap.get(s.sessionId)?.name || '',
        })))
      } catch { /* noop */ }
    }

    checkAll()
  }, [sessionFromUrl])

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
  }, [codeInput, lookup])

  const handleJoin = useCallback(async () => {
    if (session.joining) return
    const trimmed = nameInput.trim()
    if (!trimmed) return
    await session.join(trimmed)
    const sid = lookup.session?.sessionId
    if (!sid) return
    // Patch localStorage with sessionId for restore
    const key = `classroom:session:${lookup.session!.code}`
    try {
      const existing = JSON.parse(localStorage.getItem(key) || '{}')
      localStorage.setItem(key, JSON.stringify({ ...existing, sessionId: sid }))
    } catch { /* noop */ }
    const qs = embed ? `?embed=1` : ''
    navigate(`/session/${sid}${qs}`, { replace: true })
  }, [nameInput, session, navigate, lookup.session, embed])

  return (
    <div className="stu-join-overlay">
      <div className="stu-join-card" style={{ width: 360 }}>
        {joinStep === 'code' && (
          <>
            {savedSessions.length > 0 && (
              <div className="stu-restore-list">
                {savedSessions.map(s => (
                  <div key={s.sessionId} className="stu-restore-card">
                    <div className="stu-restore-info">
                      <span className="stu-restore-title">「{s.title}」</span>
                      {s.studentName && <span className="stu-restore-name">{s.studentName}</span>}
                    </div>
                    <button
                      className="stu-btn-sm pri"
                      onClick={() => {
                        const qs = embed ? '?embed=1' : ''
                        navigate(`/session/${s.sessionId}${qs}`, { replace: true })
                      }}
                    >
                      继续上次
                    </button>
                  </div>
                ))}
              </div>
            )}
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
