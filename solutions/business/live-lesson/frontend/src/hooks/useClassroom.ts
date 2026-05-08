import { useState, useEffect, useCallback, useRef } from 'react'

const API_BASE = '/api/classroom'

// ── Submission cache (localStorage tier) ──

const CACHE_PREFIX = 'sub:'

export interface CachedSubmission {
  data: Record<string, unknown>
  score: Record<string, unknown> | null
}

export function cacheSubmission(sessionCode: string, step: number, data: Record<string, unknown>, score: Record<string, unknown> | null) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${sessionCode}:${step}`, JSON.stringify({ data, score }))
  } catch { /* quota exceeded — best effort */ }
}

export function getCachedSubmission(sessionCode: string, step: number): CachedSubmission | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${sessionCode}:${step}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export async function getSubmission(
  sessionCode: string, studentId: string, step: number,
): Promise<CachedSubmission | null> {
  const cached = getCachedSubmission(sessionCode, step)
  if (cached) return cached
  try {
    const res = await fetch(`${API_BASE}/${sessionCode}/students/${studentId}/submissions/${step}`)
    if (!res.ok) return null
    const sub = await res.json()
    if (sub) cacheSubmission(sessionCode, step, sub.data, sub.score)
    return sub
  } catch { return null }
}

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
    if (created.current || !lessonId) return
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
      const normalized = code.length <= 6 ? code.toUpperCase() : code
      const res = await fetch(`${API_BASE}/sessions/${normalized}`)
      if (!res.ok) {
        const msg = code.length > 6 ? '课堂不存在' : '课堂码不存在'
        setError(res.status === 404 || res.status === 400 ? msg : `查询失败 (${res.status})`)
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

  const [saved] = useState<{ studentId: string; name: string; lessonId: string; sessionId?: string } | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })

  const [studentId, setStudentId] = useState<string | null>(saved?.studentId ?? null)
  const [name, setName] = useState<string | null>(saved?.name ?? null)
  const [lessonId, setLessonId] = useState<string | null>(saved?.lessonId ?? null)

  // Re-read localStorage when sessionCode changes (e.g. from '' to real code)
  useEffect(() => {
    if (!sessionCode) return
    try {
      const raw = localStorage.getItem(`classroom:session:${sessionCode}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        setStudentId(parsed.studentId ?? null)
        setName(parsed.name ?? null)
        setLessonId(parsed.lessonId ?? null)
      }
    } catch { /* noop */ }
  }, [sessionCode])

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
      const body = await res.json().catch(() => null) as { score?: Record<string, unknown> } | null
      cacheSubmission(sessionCode, step, data, body?.score ?? null)
      setSubmittedSteps(prev => new Set(prev).add(step))
      return true
    } catch {
      return false
    }
  }, [sessionCode, studentId])

  return { studentId, name, joining, joinError, join, submit, submittedSteps, lessonId }
}

// ── Phase reporting (fire-and-forget) ──

export function reportPhase(sessionCode: string, studentId: string, task: number, phase: string) {
  fetch(`${API_BASE}/${sessionCode}/phase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, task, phase }),
  }).catch(() => {})
}

// ── Student progress restore ──

export interface DiscussMeta {
  startedAt: string
  goalReached?: boolean
}

export interface StudentProgress {
  currentTask: number
  currentPhase: string
  discussMeta?: DiscussMeta | null
}

export async function fetchStudentProgress(
  sessionCode: string, studentId: string,
): Promise<StudentProgress | null> {
  try {
    const res = await fetch(`${API_BASE}/${sessionCode}/students/${studentId}/progress`)
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

// ── Session snapshot (unified restore) ──

export interface SessionSnapshot {
  progress: StudentProgress
  submissions: Record<number, CachedSubmission>
}

export async function fetchSessionSnapshot(
  sessionCode: string, studentId: string,
): Promise<SessionSnapshot | null> {
  try {
    const res = await fetch(`${API_BASE}/${sessionCode}/students/${studentId}/snapshot`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.progress) return null
    if (data.submissions) {
      for (const [step, sub] of Object.entries(data.submissions)) {
        const s = sub as CachedSubmission
        cacheSubmission(sessionCode, Number(step), s.data, s.score)
      }
    }
    return data
  } catch { return null }
}

// ── Teacher stream hook ──

export interface ClassroomState {
  sessionStatus?: 'waiting' | 'active' | 'ended'
  currentStep: number
  students: Array<{
    id: string
    name: string
    currentTask: number
    currentPhase: string
    stepStartedAt: string
    discussMeta?: DiscussMeta | null
    submissions: Record<number, { step: number; data: any; score: any; submittedAt: string; duration?: number; aiRoundsCount?: number }>
  }>
  metrics: {
    total: number
    submitted: number
    inProgress: number
  }
  stepMetrics: Record<number, { currentCount: number; completedCount: number; completionRate: number; avgScore: number; byDimension?: Record<string, { good: number; partial: number; wrong: number }>; avgTime?: number | null; medianTime?: number | null; aiRounds?: number; aiPeople?: number }>
  questions: Array<{ studentId: string; studentName: string; step: number; question: string; answer?: string; category?: string; timestamp: string }>
  clusterStats?: Record<number, {
    definitions: Array<{ id: string; label: string }>
    clusters: Array<{
      clusterId: string
      observationCount: number
      uniqueStudents: number
      activeCount: number
      resolvedCount: number
      observations: Array<{
        studentId: string
        studentName: string
        clusterId: string
        status: 'active' | 'resolved'
        evidenceSpans: string[]
      }>
    }>
  }>
  coaching?: {
    highlights: Array<{
      studentId: string; studentName: string; taskNum: number
      message: string; gist: string; evidenceSpan: string; detectedAt: number
    }>
    llmInsights: {
      insights: Array<{ title: string; detail: string; suggestedAction: string }>
      generatedAt: number
    } | null
  } | null
  observation?: {
    logs: Array<{
      studentId: string
      studentName: string
      events: Array<{
        id: string
        timestamp: number
        updatedAt: number
        anchors: string[]
        gist: string
        quote: string | null
        source: 'llm' | 'system'
        systemType?: string
        data?: Record<string, unknown>
      }>
      systemMetrics: {
        messageCount: number
        lastActiveAt: number
        exerciseCorrectRate: number
        currentStep: string
      }
    }>
    alerts: Array<{
      timestamp: number
      studentName: string
      studentId: string
      severity: 'info' | 'warn' | 'urgent'
      message: string
      indicatorId: string | null
    }>
    indicatorStats: Array<{
      indicatorId: string
      label: string
      type: 'knowledge' | 'misconception'
      studentCount: number
      latestGist: string
      updatedAt: number
    }>
    indicators: Array<{
      id: string
      type: 'knowledge' | 'misconception'
      label: string
      description: string
    }>
  }
}

// ── Student SSE stream hook (named events) ──

export function useStudentStream(sessionCode: string, initialStatus?: 'waiting' | 'active' | 'ended') {
  const [currentStep, setCurrentStep] = useState<number | null>(null)
  const [notification, setNotification] = useState<{ message: string; notifyType: string } | null>(null)
  const [sessionStatus, setSessionStatus] = useState<'waiting' | 'active' | 'ended' | null>(initialStatus ?? null)

  useEffect(() => {
    if (!sessionCode) return
    const es = new EventSource(`${API_BASE}/${sessionCode}/stream`)
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.sessionStatus) setSessionStatus(data.sessionStatus)
      } catch { /* noop */ }
    }
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

  return { currentStep, notification, sessionStatus }
}

// ── Exercise API hooks (student) ──

export interface ExerciseSpec {
  type: 'quiz' | 'match' | 'matrix' | 'stance' | 'order' | 'select-evidence' | 'map'
  label: string
  questions?: Array<{ idx: number; text: string; translate?: string; options: string[]; paraRef?: number[] }>
  pairs?: Array<{ idx: number; left: string; options: string[]; paraRef?: number[] }>
  rows?: Array<{ idx: number; place: string; isDemo: boolean; practice?: string; reason?: string; paraRef?: number[]; whatPrompt?: string; whyPrompt?: string }>
  practiceCount?: number
  stanceQ?: string; stanceQZh?: string; stanceOpts?: string[]; evidence?: string[]
  items?: string[]
  functionOptions?: string[]
  sections?: Array<{ id: string; label: string; range: number[]; correctFunction?: string; minHits?: number; hint?: string; hintZh?: string; aiCorrect?: string; aiPartial?: string }>
  paragraphTokens?: Record<string, Array<{ t: string; interactive?: boolean; kind?: string; why?: string }>>
  prompt?: string
  axes?: { x: { neg: string; pos: string; label: string }; y: { neg: string; pos: string; label: string } }
  mapItems?: Array<{ id: string; label: string; hint?: string; refs?: number[] }>
  minReasonLength?: number
  givenPlacements?: Record<string, { x: number; y: number }>
  practiceItemIds?: string[]
}

export interface CheckItem {
  idx: number | string
  correct: boolean
  hint?: string
  hintZh?: string
  walkthrough?: string
  walkthroughZh?: string
  aiMessage?: string
}

export interface CheckResult {
  type: string
  allCorrect: boolean
  items: CheckItem[]
}

export async function fetchExerciseSpec(sessionCode: string, step: number, studentId?: string): Promise<ExerciseSpec | null> {
  try {
    const url = studentId
      ? `${API_BASE}/${sessionCode}/steps/${step}/exercise?studentId=${studentId}`
      : `${API_BASE}/${sessionCode}/steps/${step}/exercise`
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function checkAnswer(
  sessionCode: string,
  step: number,
  studentId: string,
  data: Record<string, unknown>,
): Promise<CheckResult | null> {
  try {
    const res = await fetch(`${API_BASE}/${sessionCode}/steps/${step}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, data }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ── AI Ask hook (student) ──

export function useAiAsk(sessionCode: string) {
  const [loading, setLoading] = useState(false)

  const ask = useCallback(async (
    studentId: string,
    step: number,
    question: string,
    messages?: Array<{ role: string; text: string }>,
  ): Promise<{ answer: string; category: string } | null> => {
    if (!sessionCode) return null
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/${sessionCode}/ai/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, step, question, messages }),
      })
      if (!res.ok) return null
      const data = await res.json()
      return { answer: data.answer, category: data.category || '其他' }
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }, [sessionCode])

  return { ask, loading }
}

// ── AI Discuss hook (Socratic conversation) ──

export function useAiDiscuss(sessionCode: string) {
  const [loading, setLoading] = useState(false)

  const discuss = useCallback(async (
    studentId: string,
    taskNum: number,
    messages: Array<{ role: 'ai' | 'student'; text: string }>,
    round: number,
    timeUsedSeconds: number,
  ): Promise<{ reply: string; goalReached: boolean; llmFailed?: boolean } | null> => {
    if (!sessionCode) return null
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/${sessionCode}/ai/discuss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, taskNum, messages, round, timeUsedSeconds }),
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }, [sessionCode])

  return { discuss, loading }
}

// ── Discuss completion reporting hook ──

export function useDiscussComplete(sessionCode: string) {
  const complete = useCallback(async (data: {
    studentId: string; taskNum: number
    completionType: 'goal_reached' | 'fallback_rounds' | 'fallback_time'
    roundsUsed: number; timeUsedSeconds: number
    mcSelectedIndex?: number
  }): Promise<{ ok: boolean; mcCorrect?: boolean } | null> => {
    if (!sessionCode) return null
    try {
      const res = await fetch(`${API_BASE}/${sessionCode}/ai/discuss-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [sessionCode])
  return { complete }
}

// ── Chat history hook (student restore) ──

export function useChatHistory(sessionCode: string) {
  const fetchHistory = useCallback(async (studentId: string, threadId?: string): Promise<Record<string, Array<{ role: string; content: string; seq: number; createdAt: string }>> | null> => {
    if (!sessionCode || !studentId) return null
    const params = new URLSearchParams({ studentId })
    if (threadId) params.set('threadId', threadId)
    try {
      const res = await fetch(`${API_BASE}/${sessionCode}/chat-history?${params}`)
      return res.ok ? res.json() : null
    } catch {
      return null
    }
  }, [sessionCode])
  return { fetchHistory }
}

// ── Snapshot type ──

export interface StateSnapshot {
  timestamp: number  // ms since epoch
  state: ClassroomState
}

// ── Teacher stream hook ──

export function useTeacherStream(sessionCode: string): {
  state: ClassroomState | null
  activeNotificationIds: Set<string>
  snapshots: StateSnapshot[]
} {
  const [state, setState] = useState<ClassroomState | null>(null)
  const [activeNotificationIds, setActiveNotificationIds] = useState<Set<string>>(new Set())
  const esRef = useRef<EventSource | null>(null)
  const snapshotsRef = useRef<StateSnapshot[]>([])
  const [, setSnapshotsVersion] = useState(0)

  // Fetch historical snapshots on mount
  useEffect(() => {
    if (!sessionCode) return
    fetch(`${API_BASE}/${sessionCode}/snapshots`)
      .then(r => r.ok ? r.json() : [])
      .then((history: Array<{ capturedAt: string; state: ClassroomState }>) => {
        snapshotsRef.current = history.map(h => ({
          timestamp: new Date(h.capturedAt).getTime(),
          state: h.state,
        }))
        setSnapshotsVersion(v => v + 1)
      })
      .catch(() => { /* noop */ })
  }, [sessionCode])

  useEffect(() => {
    if (!sessionCode) return
    const es = new EventSource(`${API_BASE}/${sessionCode}/stream`)
    esRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setState(data)
        if (data.activeNotifications) {
          setActiveNotificationIds(new Set(data.activeNotifications.map((n: any) => n.id)))
        }
        // Accumulate snapshot in memory (dedup + cap)
        const ts = Date.now()
        const lastTs = snapshotsRef.current.length > 0
          ? snapshotsRef.current[snapshotsRef.current.length - 1].timestamp
          : 0
        if (ts > lastTs) {
          snapshotsRef.current.push({ timestamp: ts, state: data })
          if (snapshotsRef.current.length > 600) {
            // Thin first half: keep every 2nd entry
            const half = Math.floor(snapshotsRef.current.length / 2)
            snapshotsRef.current = snapshotsRef.current.filter((_, i) => i >= half || i % 2 === 0)
          }
          setSnapshotsVersion(v => v + 1)
        }
      } catch { /* noop */ }
    }

    es.addEventListener('notification', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        setActiveNotificationIds(prev => new Set(prev).add(data.id))
      } catch { /* noop */ }
    })

    es.addEventListener('notification_revoke', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        setActiveNotificationIds(prev => {
          const next = new Set(prev)
          next.delete(data.id)
          return next
        })
      } catch { /* noop */ }
    })

    es.onerror = () => {
      // EventSource auto-reconnects
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [sessionCode])

  return { state, activeNotificationIds, snapshots: snapshotsRef.current }
}
