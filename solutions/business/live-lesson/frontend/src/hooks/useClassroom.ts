import { useState, useEffect, useCallback, useRef } from 'react'

const API_BASE = 'http://localhost:3007/api/classroom'

// ── Session create hook (teacher) ──

interface SessionInfo {
  sessionId: string
  code: string
  lessonId: string
  status: string
}

export function useSessionCreate(lessonId: string) {
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const created = useRef(false)

  useEffect(() => {
    if (created.current) return
    created.current = true

    fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId }),
    })
      .then(res => {
        if (!res.ok) throw new Error(`Failed to create session (${res.status})`)
        return res.json()
      })
      .then(data => setSession(data))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to create session'))
      .finally(() => setLoading(false))
  }, [lessonId])

  return { session, loading, error }
}

// ── Session lookup hook (student) ──

export function useSessionLookup() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<SessionInfo | null>(null)

  const lookup = useCallback(async (code: string): Promise<SessionInfo | null> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/sessions/${code.toUpperCase()}`)
      if (!res.ok) {
        setError(res.status === 404 ? '课堂码不存在' : `查询失败 (${res.status})`)
        return null
      }
      const data = await res.json()
      if (data.status === 'ended') {
        setError('该课堂已结束')
        return null
      }
      setSession(data)
      return data
    } catch {
      setError('网络错误，请重试')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { session, loading, error, lookup }
}

// ── Student session hook ──

interface StudentSession {
  studentId: string | null
  name: string | null
  joining: boolean
  joinError: string | null
  join: (name: string) => Promise<void>
  submit: (step: number, data: Record<string, any>) => Promise<boolean>
  submittedSteps: Set<number>
  lessonId: string | null
}

export function useStudentSession(sessionCode: string): StudentSession {
  const storageKey = `classroom:session:${sessionCode}`

  const [saved] = useState<{ studentId: string; name: string; lessonId: string } | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })

  const [studentId, setStudentId] = useState<string | null>(saved?.studentId ?? null)
  const [name, setName] = useState<string | null>(saved?.name ?? null)
  const [lessonId, setLessonId] = useState<string | null>(saved?.lessonId ?? null)

  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [submittedSteps, setSubmittedSteps] = useState<Set<number>>(new Set())

  const join = useCallback(async (studentName: string) => {
    setJoining(true)
    setJoinError(null)
    try {
      const res = await fetch(`${API_BASE}/${sessionCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: studentName }),
      })
      if (!res.ok) throw new Error(`加入失败 (${res.status})`)
      const data = await res.json()
      setStudentId(data.studentId)
      setName(data.name)
      setLessonId(data.lessonId)
      localStorage.setItem(storageKey, JSON.stringify({
        studentId: data.studentId,
        name: data.name,
        lessonId: data.lessonId,
      }))
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : '网络错误，请重试')
    } finally {
      setJoining(false)
    }
  }, [sessionCode, storageKey])

  const submit = useCallback(async (step: number, data: Record<string, any>) => {
    if (!studentId) return false
    try {
      const res = await fetch(`${API_BASE}/${sessionCode}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, step, data }),
      })
      if (!res.ok) throw new Error(`Submit failed: ${res.status}`)
      setSubmittedSteps(prev => new Set(prev).add(step))
      return true
    } catch {
      return false
    }
  }, [sessionCode, studentId])

  return { studentId, name, joining, joinError, join, submit, submittedSteps, lessonId }
}

// ── Teacher stream hook ──

export interface ClassroomState {
  currentStep: number
  students: Array<{
    id: string
    name: string
    submissions: Record<number, { step: number; data: any; submittedAt: string }>
  }>
  metrics: {
    total: number
    submitted: number
    inProgress: number
  }
}

// ── Student SSE stream hook (named events) ──

export function useStudentStream(sessionCode: string) {
  const [currentStep, setCurrentStep] = useState<number | null>(null)
  const [notification, setNotification] = useState<{ message: string; notifyType: string } | null>(null)

  useEffect(() => {
    if (!sessionCode) return
    const es = new EventSource(`${API_BASE}/${sessionCode}/stream`)
    es.addEventListener('step_sync', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        setCurrentStep(data.currentStep)
      } catch { /* noop */ }
    })
    es.addEventListener('notification', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        setNotification(data)
      } catch { /* noop */ }
    })
    return () => es.close()
  }, [sessionCode])

  return { currentStep, notification }
}

// ── Teacher stream hook ──

export function useTeacherStream(sessionCode: string): ClassroomState | null {
  const [state, setState] = useState<ClassroomState | null>(null)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!sessionCode) return
    const es = new EventSource(`${API_BASE}/${sessionCode}/stream`)
    esRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setState(data)
      } catch { /* noop */ }
    }

    es.onerror = () => {
      // EventSource auto-reconnects
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [sessionCode])

  return state
}
