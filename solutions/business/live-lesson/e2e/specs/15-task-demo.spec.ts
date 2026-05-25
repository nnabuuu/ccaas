import { test, expect } from '@playwright/test'
import { BACKEND_URL, LESSON_ID, QUIZ_CORRECT_ANSWERS } from '../helpers/constants'

/**
 * /task-demo end-to-end: a sales-shareable single-task session backed by the
 * real classroom backend. Each visitor claims a name, every submit persists
 * as a new attempt, /respondents aggregates everyone, /replay/:studentId
 * returns the submit-by-submit history.
 *
 * Spec exercises the contract API-only (no browser) so it stays fast and
 * independent of frontend changes; the browser flow is smoke-tested
 * separately in the implementation phases.
 */

type CreateResp = { code: string; sessionId: string; lessonId: string; step: number }
type ClaimResp = { studentId: string; name: string }
type SubmitResp = { attempt: number; score: { total: number } | null; allCorrect: boolean; items: unknown[]; submittedAt: string }
type Respondent = { studentId: string; name: string; attemptCount: number; latestScore: { total: number } | null; latestSubmittedAt: string | null }
type ReplayEntry = { attempt: number; data: Record<string, unknown>; score: { total: number } | null; checkItems: unknown[]; submittedAt: string }

async function api<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: (await res.json()) as T }
}

test.describe('15 — /task-demo', () => {
  test('end-to-end: create → 2 users × 2 attempts → respondents → replay', async () => {
    // 1. Create
    const create = await api<CreateResp>('POST', '/api/task-demo/create', {
      lessonId: LESSON_ID,
      step: 1,
    })
    expect(create.status).toBe(201)
    expect(create.data.code).toMatch(/^[A-Z2-9]{6}$/)
    const { code } = create.data

    // 2. Two users claim — second claim with different casing must collapse
    const alice1 = await api<ClaimResp>('POST', `/api/task-demo/${code}/claim`, { user: 'alice' })
    const alice2 = await api<ClaimResp>('POST', `/api/task-demo/${code}/claim`, { user: '  ALICE  ' })
    const bob = await api<ClaimResp>('POST', `/api/task-demo/${code}/claim`, { user: 'bob' })
    expect(alice1.status).toBe(201)
    expect(alice2.data.studentId).toBe(alice1.data.studentId)  // normalize + idempotent
    expect(bob.data.studentId).not.toBe(alice1.data.studentId)

    // 3. Each submits 2 attempts (1 wrong + 1 right)
    const wrong = { answers: [0, 0, 0] }
    const right = { answers: QUIZ_CORRECT_ANSWERS }

    const a1 = await api<SubmitResp>('POST', `/api/task-demo/${code}/submit`, { studentId: alice1.data.studentId, data: wrong })
    const a2 = await api<SubmitResp>('POST', `/api/task-demo/${code}/submit`, { studentId: alice1.data.studentId, data: right })
    const b1 = await api<SubmitResp>('POST', `/api/task-demo/${code}/submit`, { studentId: bob.data.studentId, data: wrong })
    const b2 = await api<SubmitResp>('POST', `/api/task-demo/${code}/submit`, { studentId: bob.data.studentId, data: right })

    expect(a1.data.attempt).toBe(1)
    expect(a2.data.attempt).toBe(2)
    expect(b1.data.attempt).toBe(1)  // per-student counter, not global
    expect(b2.data.attempt).toBe(2)
    expect(a2.data.allCorrect).toBe(true)
    expect(b2.data.allCorrect).toBe(true)
    expect(a1.data.allCorrect).toBe(false)
    expect(a1.data.score?.total).toBe(0)
    expect(a2.data.score?.total).toBe(100)

    // 4. /respondents lists both with attemptCount=2
    const respondents = await api<Respondent[]>('GET', `/api/task-demo/${code}/respondents`)
    expect(respondents.status).toBe(200)
    expect(respondents.data).toHaveLength(2)
    const byName = Object.fromEntries(respondents.data.map((r) => [r.name, r]))
    expect(byName['alice']?.attemptCount).toBe(2)
    expect(byName['bob']?.attemptCount).toBe(2)
    expect(byName['alice']?.latestScore?.total).toBe(100)

    // 5. /replay returns attempts ordered ascending
    const aliceReplay = await api<ReplayEntry[]>('GET', `/api/task-demo/${code}/replay/${alice1.data.studentId}`)
    expect(aliceReplay.status).toBe(200)
    expect(aliceReplay.data.map((e) => e.attempt)).toEqual([1, 2])
    expect(aliceReplay.data[0].data).toEqual(wrong)
    expect(aliceReplay.data[1].data).toEqual(right)
    expect(aliceReplay.data[1].score?.total).toBe(100)
  })

  test('/exercise spec is sanitized: never leaks answer keys', async () => {
    const create = await api<CreateResp>('POST', '/api/task-demo/create', {
      lessonId: LESSON_ID,
      step: 1,
    })
    const spec = await api<Record<string, any>>('GET', `/api/task-demo/${create.data.code}/exercise`)
    expect(spec.status).toBe(200)
    expect(spec.data.type).toBe('quiz')
    expect(spec.data.step).toBe(1)
    // Quiz contract: questions are kept; correct/hint/walkthrough stripped.
    const qs = spec.data.questions ?? spec.data.quizQuestions ?? []
    expect(qs.length).toBeGreaterThan(0)
    for (const q of qs) {
      expect(q.correct).toBeUndefined()
      expect(q.hint).toBeUndefined()
      expect(q.walkthrough).toBeUndefined()
    }
  })

  test('invalid code shape returns 400; nonexistent code returns 404', async () => {
    // 5-char codes fail the `^[A-Z2-9]{6}$` regex in validateCode.
    const bad = await api('GET', '/api/task-demo/SHORT/exercise')
    expect(bad.status).toBe(400)
    // 6-char but no session in DB.
    const missing = await api('GET', '/api/task-demo/ZZZZZZ/exercise')
    expect(missing.status).toBe(404)
  })

  test('admin overview page renders + deep-links into replay', async ({ page }) => {
    // Seed a session with one respondent
    const { data } = await api<CreateResp>('POST', '/api/task-demo/create', {
      lessonId: LESSON_ID,
      step: 1,
    })
    const claim = await api<ClaimResp>('POST', `/api/task-demo/${data.code}/claim`, { user: 'charlie' })
    await api('POST', `/api/task-demo/${data.code}/submit`, {
      studentId: claim.data.studentId,
      data: { answers: QUIZ_CORRECT_ANSWERS },
    })

    await page.goto(`/task-demo/${data.code}/admin`)
    await expect(page.getByText('charlie')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('100%')).toBeVisible()

    // Row click → replay
    await page.getByText('charlie').click()
    await expect(page).toHaveURL(/\/task-demo\/[A-Z2-9]{6}\/replay\?user=charlie/)
  })
})
