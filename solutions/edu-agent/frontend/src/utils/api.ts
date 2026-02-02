import type { LessonPlan } from '../types/lesson-plan'

const API_BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || `HTTP ${response.status}`)
  }
  return response.json()
}

export const api = {
  // Solution config
  getSolutionConfig: () => request<Record<string, unknown>>('/config'),

  // Lesson plans
  getLessonPlans: () => request<LessonPlan[]>('/lesson-plans'),
  getLessonPlan: (id: string) => request<LessonPlan>(`/lesson-plans/${id}`),
  createLessonPlan: (data: Partial<LessonPlan>) =>
    request<LessonPlan>('/lesson-plans', { method: 'POST', body: JSON.stringify(data) }),
  updateLessonPlan: (id: string, data: Partial<LessonPlan>) =>
    request<LessonPlan>(`/lesson-plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Problems
  getProblems: () => request<unknown[]>('/problems'),
  createProblem: (data: Record<string, unknown>) =>
    request<unknown>('/problems', { method: 'POST', body: JSON.stringify(data) }),

  // Health
  checkHealth: async (): Promise<boolean> => {
    try {
      await fetch('/api/v1/health')
      return true
    } catch {
      return false
    }
  },
}
