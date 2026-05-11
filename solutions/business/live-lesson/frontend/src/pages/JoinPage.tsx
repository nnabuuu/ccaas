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
  const sessionFromUrl = searchParams.get('session') || searchParams.get('code')
  const embed = searchParams.get('embed') === '1'

  const [codeInput, setCodeInput] = useState(
    sessionFromUrl && sessionFromUrl.length <= 6 ? sessionFromUrl.toUpperCase().slice(0, 6) : '',
  )
  const [nameInput, setNameInput] = useState('')
  const [manifest, setManifest] = useState<ReadingManifest | null>(null)
  const [savedSessions, setSavedSessions] = useState<SavedSessionInfo[]>([])
  const [showGuide, setShowGuide] = useState(false)

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
  const guideCode = codeNormalized.length >= 1 ? codeNormalized.padEnd(6, '_') : 'MPD6SU'
  const guideTitle = (manifest?.title || 'Ideal Beauty').slice(0, 20) + ((manifest?.title?.length ?? 0) > 20 ? '…' : '')

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

  // Handle full sessionId from URL (> 6 chars) — run once on mount
  const urlLookupDone = useRef(false)
  useEffect(() => {
    if (urlLookupDone.current) return
    if (!sessionFromUrl || sessionFromUrl.length <= 6) return
    urlLookupDone.current = true
    let cancelled = false
    doLookup(sessionFromUrl).then(s => {
      if (cancelled || !s) return
      lastLookedUpCode.current = s.code
      setCodeInput(s.code)
      fetchManifest(s.lessonId).then(m => { if (!cancelled && m) setManifest(m) })
    })
    return () => { cancelled = true }
  }, [sessionFromUrl, doLookup])

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

        <button className="stu-join-guide-toggle" onClick={() => setShowGuide(true)}>
          ？不知道怎么操作？
        </button>

        {showGuide && (
          <div className="stu-join-guide-backdrop" onClick={() => setShowGuide(false)} onKeyDown={e => e.key === 'Escape' && setShowGuide(false)}>
            <div className="stu-join-guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={e => e.stopPropagation()}>
              <div className="stu-join-guide-modal-hd">
                <div id="guide-title" className="stu-join-guide-modal-title">四步加入课堂</div>
              </div>
              <div className="stu-join-guide-grid">
                {/* Step 1: Enter code */}
                <div className="stu-join-guide-step">
                  <div className="stu-join-guide-hd">
                    <div className="stu-join-guide-num">1</div>
                    <div className="stu-join-guide-title">输入课堂码</div>
                  </div>
                  <div className="stu-join-guide-illust jg-s1">
                    <svg viewBox="0 0 220 124" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <filter id="jg1s" x="-5%" y="-2%" width="110%" height="112%">
                          <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="#1c1c1a" floodOpacity=".06" />
                        </filter>
                      </defs>
                      <rect x="8" y="4" width="204" height="116" rx="8" fill="#fbfaf7" filter="url(#jg1s)" stroke="#e4e2d8" strokeWidth=".5" />
                      <text x="110" y="22" fontFamily="Plus Jakarta Sans" fontSize="12" fontWeight="700" fill="#1c1c1a" textAnchor="middle">加入课堂</text>
                      <text x="110" y="32" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#9c9a92" textAnchor="middle">输入课堂码和姓名加入</text>
                      <rect x="20" y="38" width="180" height="26" rx="5" fill="#fff" stroke="#e4e2d8" />
                      <text className="jg-code" x="110" y="56" fontFamily="SF Mono,Menlo,monospace" fontSize="14" fontWeight="600" fill="#1c1c1a" textAnchor="middle" letterSpacing=".3em">{guideCode}</text>
                      <rect className="jg-cursor" x="152" y="44" width="1.5" height="14" rx=".75" fill="#0d5245" />
                      <g className="jg-check">
                        <text x="62" y="77" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#0d5245" fontWeight="600">✓ {guideTitle}</text>
                      </g>
                      <rect x="20" y="82" width="180" height="18" rx="5" fill="#fff" stroke="#e4e2d8" />
                      <text x="110" y="94" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#9c9a92" textAnchor="middle">你的姓名...</text>
                      <rect x="20" y="104" width="180" height="14" rx="5" fill="#d5d4cf" />
                      <text x="110" y="114" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#fff" textAnchor="middle" opacity=".6">加入课堂</text>
                    </svg>
                  </div>
                  <div className="stu-join-guide-desc">输入老师提供的 <b>6 位课堂码</b></div>
                </div>

                {/* Step 2: Enter name */}
                <div className="stu-join-guide-step">
                  <div className="stu-join-guide-hd">
                    <div className="stu-join-guide-num">2</div>
                    <div className="stu-join-guide-title">输入姓名</div>
                  </div>
                  <div className="stu-join-guide-illust jg-s2">
                    <svg viewBox="0 0 220 124" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <filter id="jg2s" x="-5%" y="-2%" width="110%" height="112%">
                          <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="#1c1c1a" floodOpacity=".06" />
                        </filter>
                      </defs>
                      <rect x="8" y="4" width="204" height="116" rx="8" fill="#fbfaf7" filter="url(#jg2s)" stroke="#e4e2d8" strokeWidth=".5" />
                      <text x="110" y="22" fontFamily="Plus Jakarta Sans" fontSize="12" fontWeight="700" fill="#1c1c1a" textAnchor="middle">加入课堂</text>
                      <text x="110" y="32" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#9c9a92" textAnchor="middle">输入课堂码和姓名加入</text>
                      <rect x="20" y="38" width="180" height="26" rx="5" fill="#fff" stroke="#e4e2d8" />
                      <text x="110" y="56" fontFamily="SF Mono,Menlo,monospace" fontSize="14" fontWeight="600" fill="#1c1c1a" textAnchor="middle" letterSpacing=".3em">{guideCode}</text>
                      <text x="62" y="77" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#0d5245" fontWeight="600">✓ {guideTitle}</text>
                      <rect x="20" y="82" width="180" height="18" rx="5" fill="#fff" stroke="#0d5245" />
                      <text className="jg-name" x="110" y="94" fontFamily="Plus Jakarta Sans" fontSize="8" fill="#1c1c1a" textAnchor="middle">张三</text>
                      <rect className="jg-btn" x="20" y="104" width="180" height="14" rx="5" fill="#9c9a92" />
                      <text className="jg-btn-text" x="110" y="114" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#9c9a92" textAnchor="middle">加入课堂</text>
                    </svg>
                  </div>
                  <div className="stu-join-guide-desc">输入名字，点击<b>「加入课堂」</b></div>
                </div>

                {/* Step 3: Waiting lobby */}
                <div className="stu-join-guide-step">
                  <div className="stu-join-guide-hd">
                    <div className="stu-join-guide-num">3</div>
                    <div className="stu-join-guide-title">等待大厅</div>
                  </div>
                  <div className="stu-join-guide-illust jg-s3">
                    <svg viewBox="0 0 220 124" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <filter id="jg3s" x="-5%" y="-2%" width="110%" height="112%">
                          <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="#1c1c1a" floodOpacity=".06" />
                        </filter>
                      </defs>
                      <rect x="8" y="4" width="204" height="116" rx="8" fill="#fbfaf7" filter="url(#jg3s)" stroke="#e4e2d8" strokeWidth=".5" />
                      <text x="110" y="30" fontFamily="Plus Jakarta Sans" fontSize="12" fontWeight="700" fill="#1c1c1a" textAnchor="middle">{guideTitle}</text>
                      <text x="110" y="44" fontFamily="Plus Jakarta Sans" fontSize="8" fill="#5c5b56" textAnchor="middle">张三</text>
                      <circle className="jg-pulse-dot" cx="62" cy="64" r="3.5" fill="#0d5245" />
                      <text x="72" y="68" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#9c9a92">等待老师开始上课</text>
                      <rect x="70" y="80" width="80" height="14" rx="4" fill="#edece7" />
                      <text x="110" y="90" fontFamily="SF Mono,Menlo,monospace" fontSize="7" fontWeight="600" fill="#9c9a92" textAnchor="middle" letterSpacing=".1em">{guideCode}</text>
                    </svg>
                  </div>
                  <div className="stu-join-guide-desc">加入后等待老师开始课堂</div>
                </div>

                {/* Step 4: Enter classroom */}
                <div className="stu-join-guide-step">
                  <div className="stu-join-guide-hd">
                    <div className="stu-join-guide-num">4</div>
                    <div className="stu-join-guide-title">进入课堂</div>
                  </div>
                  <div className="stu-join-guide-illust jg-s4">
                    <svg viewBox="0 0 220 124" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <g className="jg-expand" transform="translate(8,4)">
                        <rect x="0" y="0" width="204" height="116" rx="8" fill="#fbfaf7" stroke="#e4e2d8" strokeWidth=".5" />
                        <rect x="4" y="4" width="196" height="14" rx="3" fill="#edece7" />
                        <text x="12" y="14" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="600" fill="#1c1c1a">{guideTitle}</text>
                        <g transform="translate(130,9)">
                          <circle className="jg-dot1" cx="0" cy="2" r="2.5" fill="#e4e2d8" />
                          <circle className="jg-dot2" cx="10" cy="2" r="2.5" fill="#e4e2d8" />
                          <circle className="jg-dot3" cx="20" cy="2" r="2.5" fill="#e4e2d8" />
                        </g>
                        <rect x="4" y="22" width="96" height="90" rx="4" fill="#dfece8" opacity=".6" />
                        <text x="52" y="72" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#0d5245" textAnchor="middle">任务区</text>
                        <rect x="104" y="22" width="96" height="90" rx="4" fill="#edece7" opacity=".6" />
                        <text x="152" y="72" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#9c9a92" textAnchor="middle">课文</text>
                      </g>
                    </svg>
                  </div>
                  <div className="stu-join-guide-desc">自动进入<b>左任务区 + 右课文</b>布局</div>
                </div>
              </div>
              <button className="stu-btn pri stu-join-guide-dismiss" onClick={() => setShowGuide(false)}>我知道了</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
