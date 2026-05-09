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

  const [codeInput, setCodeInput] = useState(
    sessionFromUrl && sessionFromUrl.length <= 6 ? sessionFromUrl.toUpperCase() : '',
  )
  const [nameInput, setNameInput] = useState('')
  const [manifest, setManifest] = useState<ReadingManifest | null>(null)
  const [savedSessions, setSavedSessions] = useState<SavedSessionInfo[]>([])

  const lookup = useSessionLookup()
  const doLookup = lookup.lookup
  const sessionCode = lookup.session?.code ?? ''
  const session = useStudentSession(sessionCode)
  const checkedRef = useRef(false)
  const lastLookedUpCode = useRef('')
  const lookupGenRef = useRef(0)
  const nameRef = useRef<HTMLInputElement>(null)

  const codeNormalized = codeInput.trim().toUpperCase()
  const codeValid = !!(lookup.session && lookup.session.code === codeNormalized)

  // Auto-validate code when 6 chars entered
  useEffect(() => {
    const code = codeInput.trim().toUpperCase()
    let cancelled = false
    if (code.length === 6 && code !== lastLookedUpCode.current) {
      lastLookedUpCode.current = code
      setManifest(null)
      const gen = ++lookupGenRef.current
      doLookup(code).then(s => {
        if (cancelled || gen !== lookupGenRef.current) return
        if (s) {
          fetchManifest(s.lessonId).then(m => {
            if (!cancelled && gen === lookupGenRef.current && m) setManifest(m)
          })
        }
      })
    }
    if (code.length < 6) {
      lastLookedUpCode.current = ''
    }
    return () => { cancelled = true }
  }, [codeInput, doLookup])

  // Handle full sessionId from URL (> 6 chars)
  useEffect(() => {
    if (!sessionFromUrl || sessionFromUrl.length <= 6) return
    let cancelled = false
    doLookup(sessionFromUrl).then(s => {
      if (cancelled || !s) return
      // Set code input and ref before state update triggers auto-validate
      lastLookedUpCode.current = s.code
      setCodeInput(s.code)
      fetchManifest(s.lessonId).then(m => { if (!cancelled && m) setManifest(m) })
    })
    return () => { cancelled = true }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Check localStorage for saved sessions → batch-verify with backend → show restore options
  useEffect(() => {
    if (sessionFromUrl || checkedRef.current) return
    checkedRef.current = true

    const keys = Object.keys(localStorage).filter(k => k.startsWith('classroom:session:'))
    if (keys.length === 0) return

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

  const handleJoin = useCallback(async () => {
    const ls = lookup.session
    if (session.joining || !codeValid || !ls) return
    const trimmed = nameInput.trim()
    if (!trimmed) return
    const ok = await session.join(trimmed)
    if (!ok) return
    const key = `classroom:session:${ls.code}`
    try {
      const existing = JSON.parse(localStorage.getItem(key) || '{}')
      localStorage.setItem(key, JSON.stringify({ ...existing, sessionId: ls.sessionId }))
    } catch { /* noop */ }
    const qs = embed ? '?embed=1' : ''
    navigate(`/session/${ls.sessionId}${qs}`, { replace: true })
  }, [nameInput, session, navigate, lookup.session, embed, codeValid])

  return (
    <div className="stu-join-overlay">
      <div className="stu-join-card" style={{ width: 360 }}>
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
        <div className="stu-join-sub">输入课堂码和姓名加入</div>
        <input
          className="stu-join-input stu-join-code"
          placeholder="课堂码..."
          value={codeInput}
          onChange={e => setCodeInput(e.target.value.toUpperCase().slice(0, 6))}
          onKeyDown={e => {
            if (e.key === 'Enter' && codeNormalized.length === 6) {
              nameRef.current?.focus()
            }
          }}
          autoFocus
          maxLength={6}
        />
        {codeNormalized.length === 6 && (
          <>
            {lookup.loading && (
              <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>验证中...</div>
            )}
            {codeValid && (
              <div style={{ fontSize: 12, color: 'var(--green, #22c55e)', marginBottom: 10 }}>
                ✓{manifest ? ` 「${manifest.title}」` : ''}
              </div>
            )}
            {!lookup.loading && lookup.error && (
              <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>
                ✗ {lookup.error}
              </div>
            )}
          </>
        )}
        <input
          ref={nameRef}
          className="stu-join-input"
          placeholder="你的姓名..."
          value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
        />
        {session.joinError && (
          <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{session.joinError}</div>
        )}
        <button
          className="stu-btn pri"
          onClick={handleJoin}
          disabled={session.joining || !codeValid || !nameInput.trim()}
        >
          {session.joining ? '加入中...' : '加入课堂'}
        </button>
      </div>
    </div>
  )
}
