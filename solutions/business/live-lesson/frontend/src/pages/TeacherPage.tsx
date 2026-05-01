import { useState, useCallback, useRef, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useSessionLookup, useTeacherStream } from '../hooks/useClassroom'
import { fetchManifest } from '../hooks/useManifest'
import type { ReadingManifest } from '../types/reading'
import TeacherShell from '../components/teacher/TeacherShell'
import '../styles/teacher.css'

const API_BASE = '/api/classroom'

export default function TeacherPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [searchParams] = useSearchParams()
  const embed = searchParams.get('embed') === '1'

  const lookup = useSessionLookup()
  const [manifest, setManifest] = useState<ReadingManifest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current || !sessionId) return
    initialized.current = true

    lookup.lookup(sessionId).then(async s => {
      if (!s) {
        setError('课堂不存在')
        setLoading(false)
        return
      }
      const m = await fetchManifest(s.lessonId)
      if (m) {
        setManifest(m)
      } else {
        setError('加载课程失败')
      }
      setLoading(false)
    })
  }, [sessionId, lookup])

  if (loading) return <div style={{ padding: 40, color: 'var(--t3)' }}>Loading teacher...</div>
  if (error || !manifest || !lookup.session) return <div style={{ padding: 40, color: 'var(--red)' }}>Error: {error}</div>

  return (
    <TeacherPageWithSession
      manifest={manifest}
      lessonId={lookup.session.lessonId}
      sessionCode={lookup.session.code}
      embed={embed}
    />
  )
}

function TeacherPageWithSession({ manifest, sessionCode, embed }: {
  manifest: ReadingManifest; lessonId?: string; sessionCode: string; embed: boolean
}) {
  const { state } = useTeacherStream(sessionCode)
  const [started, setStarted] = useState(false)
  const [starting, setStarting] = useState(false)

  const sessionStatus = state?.sessionStatus

  if (started || sessionStatus === 'active') {
    return <TeacherShell manifest={manifest} sessionCode={sessionCode} embed={embed} />
  }

  return (
    <WaitingView
      manifest={manifest}
      sessionCode={sessionCode}
      students={state?.students ?? []}
      starting={starting}
      onStart={async () => {
        setStarting(true)
        try {
          const res = await fetch(`${API_BASE}/sessions/${sessionCode}/start`, { method: 'POST' })
          if (!res.ok) throw new Error('启动失败')
          setStarted(true)
        } catch {
          setStarting(false)
        }
      }}
    />
  )
}

function WaitingView({ manifest, sessionCode, students, starting, onStart }: {
  manifest: ReadingManifest
  sessionCode: string
  students: Array<{ id: string; name: string }>
  starting: boolean
  onStart: () => void
}) {
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => { clearTimeout(copyTimer.current) }, [])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(sessionCode).then(() => {
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 1500)
    })
  }, [sessionCode])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        fontFamily: '"Plus Jakarta Sans", -apple-system, "PingFang SC", sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--t1)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 520, padding: '40px 24px', textAlign: 'center' }}>
        {/* Lesson info */}
        <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--t3)', fontWeight: 500 }}>
          {manifest.subject} · {manifest.gradeLevel}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 32, letterSpacing: '-.3px' }}>
          {manifest.title}
        </h1>

        {/* Session code */}
        <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          课堂码
        </div>
        <div
          onClick={handleCopy}
          style={{
            fontSize: 48,
            fontWeight: 800,
            letterSpacing: '8px',
            color: 'var(--t1)',
            cursor: 'pointer',
            userSelect: 'all',
            marginBottom: 8,
            fontFamily: '"SF Mono", "Cascadia Code", monospace',
            lineHeight: 1,
          }}
        >
          {sessionCode}
        </div>
        <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 40 }}>
          {copied ? '已复制! · ' : '点击复制 · '}学生访问 <a href="/join" target="_blank" rel="noopener" style={{ color: 'var(--teal)', textDecoration: 'underline' }}>/join</a> 输入此码加入
        </div>

        {/* Student list */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--t3)',
            textTransform: 'uppercase', letterSpacing: '.5px',
            marginBottom: 12,
          }}>
            已加入 · {students.length} 人
          </div>

          {students.length === 0 ? (
            <div style={{
              padding: '24px 0',
              fontSize: 13,
              color: 'var(--t3)',
            }}>
              等待学生加入...
            </div>
          ) : (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 6,
              justifyContent: 'center', padding: '0 20px',
            }}>
              {students.map(s => (
                <div
                  key={s.id}
                  style={{
                    padding: '6px 14px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--t1)',
                  }}
                >
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Start button */}
        <button
          onClick={onStart}
          disabled={starting}
          style={{
            width: '100%',
            maxWidth: 280,
            padding: '14px 0',
            fontSize: 15,
            fontWeight: 600,
            color: '#fbfaf7',
            background: students.length > 0 ? '#1c1c1a' : 'var(--idle)',
            border: 'none',
            borderRadius: 10,
            cursor: starting ? 'wait' : 'pointer',
            opacity: starting ? 0.6 : 1,
            transition: 'all .2s',
            fontFamily: 'inherit',
          }}
        >
          {starting ? '启动中...' : `开始上课${students.length > 0 ? '' : ''}`}
        </button>

        {students.length === 0 && (
          <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 10 }}>
            可以先开始，学生随时可以加入
          </p>
        )}
      </div>
    </div>
  )
}
