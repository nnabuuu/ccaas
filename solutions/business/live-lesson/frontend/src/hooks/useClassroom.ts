import { useState, useEffect, useCallback, useRef } from 'react'

const API_BASE = '/api/classroom'

// ── Submission cache (localStorage tier) ──

const CACHE_PREFIX = 'sub:'

export interface CachedSubmission {
  data: Record<string, unknown>
  score: Record<string, unknown> | null
  checkItems?: CheckItem[]
}

export function cacheSubmission(
  sessionCode: string, step: number,
  data: Record<string, unknown>, score: Record<string, unknown> | null,
  checkItems?: CheckItem[],
) {
  try {
    const entry: CachedSubmission = { data, score }
    if (checkItems) entry.checkItems = checkItems
    localStorage.setItem(`${CACHE_PREFIX}${sessionCode}:${step}`, JSON.stringify(entry))
  } catch { /* quota exceeded — best effort */ }
}

export function getCachedSubmission(sessionCode: string, step: number): CachedSubmission | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${sessionCode}:${step}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/** Fallback single-step fetch. Does NOT include checkItems (only fetchSessionSnapshot does). */
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
  join: (name: string) => Promise<boolean>
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

  // Restore submittedSteps from localStorage cache on mount
  useEffect(() => {
    if (!sessionCode) return
    const steps = new Set<number>()
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(`${CACHE_PREFIX}${sessionCode}:`)) {
        const step = Number(key.split(':').pop())
        if (!isNaN(step)) steps.add(step)
      }
    }
    if (steps.size > 0) setSubmittedSteps(steps)
  }, [sessionCode])

  const join = useCallback(async (studentName: string): Promise<boolean> => {
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
      return true
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : '网络错误，请重试')
      return false
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

// ── Session snapshot (unified restore) ──

export interface SessionSnapshot {
  progress: StudentProgress
  submissions: Record<number, CachedSubmission>
}

export async function fetchSessionSnapshot(
  sessionCode: string, studentId: string,
): Promise<SessionSnapshot | null> {
  try {
    const res = await fetch(`${API_BASE}/${sessionCode}/students/${studentId}/progress?include=submissions`)
    if (!res.ok) return null
    const data = await res.json()
    if (data?.currentTask == null) return null
    const { submissions, ...progress } = data
    if (submissions) {
      for (const [step, sub] of Object.entries(submissions)) {
        const s = sub as CachedSubmission
        cacheSubmission(sessionCode, Number(step), s.data, s.score, s.checkItems)
      }
    }
    return { progress, submissions: submissions ?? {} }
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
    bonusStatus?: 'none' | 'active' | 'completed'
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
        isHighlight?: boolean
        highlightGist?: string
      }>
    }>
    targetPointDefs: Array<{ id: string; label: string }>
    targetPointStats: Array<{
      targetPointId: string
      uniqueStudents: number
      students: Array<{ studentId: string; studentName: string }>
    }>
  }>
  coaching?: {
    highlights: Array<{
      studentId: string; studentName: string; taskNum: number
      message: string; gist: string; evidenceSpan: string; detectedAt: number
      clusterId?: string
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

// ── Student polling hook (replaces SSE) ──

export function useStudentPolling(sessionCode: string, initialStatus?: 'waiting' | 'active' | 'ended') {
  const [sessionStatus, setSessionStatus] = useState<'waiting' | 'active' | 'ended' | null>(initialStatus ?? null)

  useEffect(() => {
    if (initialStatus) setSessionStatus(initialStatus)
  }, [initialStatus])

  useEffect(() => {
    if (!sessionCode) return
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/sessions/${sessionCode}`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return
        if (data.status) {
          setSessionStatus(data.status)
          if (data.status === 'active' || data.status === 'ended') {
            if (timer) clearInterval(timer)
          }
        }
      } catch { /* noop */ }
    }

    poll()
    timer = setInterval(poll, 3000)
    return () => { cancelled = true; if (timer) clearInterval(timer) }
  }, [sessionCode])

  return { sessionStatus }
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

// ── Translate API (student) ──

export interface TranslateResponse {
  definition: string
  contextAnalysis: string
  suggestedQuestions: string[]
}

export async function translateText(
  sessionCode: string,
  studentId: string,
  text: string,
  step: number,
  sourceContext: string,
  phase?: string,
): Promise<TranslateResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/${sessionCode}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, text, step, sourceContext, phase }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function translateChat(
  sessionCode: string,
  studentId: string,
  step: number,
  originalText: string,
  question: string,
  sourceContext: string,
): Promise<{ reply: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/${sessionCode}/translate/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, step, originalText, question, sourceContext }),
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
  ): Promise<{ reply: string; goalReached: boolean; llmFailed?: boolean; highlight?: { score: number; gist: string }; nudge?: { hint: string } } | null> => {
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

// ── Discuss progress hook (discuss points tracker) ──

export interface ClusterProgress {
  id: string
  label: string
  hit: boolean
}

export function useDiscussProgress(sessionCode: string) {
  const fetchProgress = useCallback(async (
    studentId: string, taskNum: number,
  ): Promise<{ clusters: ClusterProgress[]; targetPoints: ClusterProgress[] } | null> => {
    if (!sessionCode) return null
    try {
      const res = await fetch(`${API_BASE}/${sessionCode}/discuss-progress?studentId=${encodeURIComponent(studentId)}&taskNum=${taskNum}`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [sessionCode])

  return { fetchProgress }
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

// ── Teacher polling hook (replaces SSE) ──

export function useTeacherPolling(sessionCode: string): {
  state: ClassroomState | null
  activeNotificationIds: Set<string>
  snapshots: StateSnapshot[]
} {
  const [state, setState] = useState<ClassroomState | null>(null)
  const [activeNotificationIds, setActiveNotificationIds] = useState<Set<string>>(new Set())
  const snapshotsRef = useRef<StateSnapshot[]>([])
  const [, bump] = useState(0)

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
        bump(c => c + 1)
      })
      .catch(() => { /* noop */ })
  }, [sessionCode])

  // Poll full state
  useEffect(() => {
    if (!sessionCode) return
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/${sessionCode}/state`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return
        setState(data)

        // Sync activeNotifications
        if (data.activeNotifications) {
          setActiveNotificationIds(new Set(data.activeNotifications.map((n: any) => n.id)))
        }

        // Accumulate snapshot (dedup + cap)
        const ts = Date.now()
        const last = snapshotsRef.current[snapshotsRef.current.length - 1]
        if (!last || ts - last.timestamp >= 2000) {
          snapshotsRef.current.push({ timestamp: ts, state: data })
          if (snapshotsRef.current.length > 600) {
            const half = Math.floor(snapshotsRef.current.length / 2)
            snapshotsRef.current = snapshotsRef.current.filter((_, i) => i >= half || i % 2 === 0)
          }
          bump(c => c + 1)
        }
      } catch { /* noop */ }
    }

    poll()
    const timer = setInterval(poll, 3000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [sessionCode])

  return { state, activeNotificationIds, snapshots: snapshotsRef.current }
}
