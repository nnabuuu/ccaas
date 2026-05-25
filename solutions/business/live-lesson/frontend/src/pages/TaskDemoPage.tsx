/**
 * /task-demo router. URL shapes:
 *
 *   /task-demo/:code                  — answer (need ?user= or shows NamePicker)
 *   /task-demo/:code/replay?user=X    — replay (P3, placeholder for now)
 *   /task-demo/:code/admin            — admin overview (P4, placeholder for now)
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { AnswerMode } from './task-demo/AnswerMode'
import { NamePicker } from './task-demo/NamePicker'
import { ReplayMode } from './task-demo/ReplayMode'
import { AdminMode } from './task-demo/AdminMode'
import { taskDemoApi, studentIdCacheKey } from './task-demo/useTaskDemoApi'

export default function TaskDemoPage() {
  const { code = '', mode = '' } = useParams<{ code: string; mode?: string }>()
  const [params, setParams] = useSearchParams()

  if (mode === 'admin') {
    return <AdminMode code={code} />
  }
  if (mode === 'replay') {
    return <ReplayMode code={code} userParam={params.get('user') ?? ''} />
  }

  // Default mode = answer.
  const user = params.get('user') ?? ''
  if (!user.trim()) {
    return (
      <NamePicker
        onPick={(name) => {
          const next = new URLSearchParams(params)
          next.set('user', name)
          setParams(next, { replace: true })
        }}
      />
    )
  }

  return <ClaimGate code={code} user={user} />
}

/**
 * Resolves the student id for (code, user). Reads localStorage first (fast
 * resume on reload), falls back to a server POST /claim (idempotent), then
 * hands off to AnswerMode.
 */
function ClaimGate({ code, user }: { code: string; user: string }) {
  const cacheKey = useMemo(() => studentIdCacheKey(code, user), [code, user])
  const [studentId, setStudentId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(cacheKey)
      if (raw) return (JSON.parse(raw) as { studentId: string }).studentId
    } catch {}
    return null
  })
  const [resolvedName, setResolvedName] = useState<string>(user)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (studentId) return // cached — server claim is idempotent so skipping is safe
    setError(null)
    taskDemoApi
      .claim(code, user)
      .then((r) => {
        if (cancelled) return
        setStudentId(r.studentId)
        setResolvedName(r.name)
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ studentId: r.studentId, name: r.name }))
        } catch {}
      })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)) })
    return () => { cancelled = true }
  }, [code, user, cacheKey, studentId])

  if (error) {
    return (
      <FullPageMessage
        title="无法加入此 task-demo"
        body={error}
        hint="检查 URL 中的 code 是否正确，以及 backend 是否在 :3007 运行。"
      />
    )
  }
  if (!studentId) {
    return <FullPageMessage title="加入中…" body="正在解析你的身份…" />
  }

  return <AnswerMode code={code} studentId={studentId} userName={resolvedName} />
}

function FullPageMessage({ title, body, hint }: { title: string; body: string; hint?: string }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f4f3ef',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      }}
    >
      <div style={{ maxWidth: 480, padding: 24, textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 22, color: '#1c1c1a', marginBottom: 12 }}>
          {title}
        </h2>
        <p style={{ fontSize: 13, color: '#5c5b56', margin: 0 }}>{body}</p>
        {hint && (
          <p style={{ fontSize: 12, color: '#9c9a92', marginTop: 12 }}>{hint}</p>
        )}
      </div>
    </div>
  )
}
