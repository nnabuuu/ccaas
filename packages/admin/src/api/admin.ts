import axios from 'axios'
import type { AxiosInstance } from 'axios'
import { useAuthStore } from '@/stores/auth'
import type {
  DashboardSummary,
  RecentSession,
  PaginatedSessions,
  SessionListItem,
  SessionDetail,
  SessionTimeline,
  TokenUsageAnalytics,
  CostAnalytics,
  ApiKeyUsageStats,
  PaginatedAuditLogs,
  Skill,
  SkillVersion,
  VersionDiff,
  Tenant
} from '@/types/admin'

const api: AxiosInstance = axios.create({
  baseURL: '/api/v1/admin',
  timeout: 30000
})

// Add auth interceptor
api.interceptors.request.use((config) => {
  const authStore = useAuthStore()
  const headers = authStore.getAuthHeaders()
  Object.assign(config.headers, headers)
  return config
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore()
      authStore.clearApiKey()
      window.location.href = '/admin/login'
    }
    return Promise.reject(error)
  }
)

// Dashboard API
export const dashboardApi = {
  getSummary: (tenantId?: string) =>
    api.get<DashboardSummary>('/dashboard/summary', { params: { tenantId } }).then(r => r.data),

  getRecentSessions: (limit = 10, tenantId?: string) =>
    api.get<RecentSession[]>('/dashboard/recent-sessions', { params: { limit, tenantId } }).then(r => r.data)
}

// Sessions API
export interface SessionQueryParams {
  tenantId?: string
  status?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

export const sessionsApi = {
  list: (params?: SessionQueryParams) =>
    api.get<PaginatedSessions>('/sessions', { params }).then(r => r.data),

  getActive: () =>
    api.get<SessionListItem[]>('/sessions/active').then(r => r.data),

  getDetail: (sessionId: string) =>
    api.get<SessionDetail>(`/sessions/${sessionId}`).then(r => r.data),

  getTimeline: (sessionId: string, limit = 100, offset = 0) =>
    api.get<SessionTimeline>(`/sessions/${sessionId}/timeline`, {
      params: { limit, offset }
    }).then(r => r.data),

  kill: (sessionId: string) =>
    api.post<{ success: boolean; message: string }>(`/sessions/${sessionId}/kill`).then(r => r.data),

  restart: (sessionId: string) =>
    api.post<{ success: boolean; message: string }>(`/sessions/${sessionId}/restart`).then(r => r.data)
}

// Analytics API
export interface AnalyticsQueryParams {
  tenantId?: string
  granularity?: 'hourly' | 'daily' | 'weekly' | 'monthly'
  startDate?: string
  endDate?: string
  days?: number
}

export const analyticsApi = {
  getTokenUsage: (params?: AnalyticsQueryParams) =>
    api.get<TokenUsageAnalytics>('/analytics/tokens', { params }).then(r => r.data),

  getCostBreakdown: (params?: AnalyticsQueryParams) =>
    api.get<CostAnalytics>('/analytics/costs', { params }).then(r => r.data),

  getApiKeyUsage: (tenantId?: string) =>
    api.get<ApiKeyUsageStats[]>('/analytics/api-keys', { params: { tenantId } }).then(r => r.data)
}

// Audit API
export interface AuditQueryParams {
  adminId?: string
  action?: string
  targetType?: string
  targetId?: string
  tenantId?: string
  success?: boolean
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

export const auditApi = {
  query: (params?: AuditQueryParams) =>
    api.get<PaginatedAuditLogs>('/audit/log', { params }).then(r => r.data),

  getRecent: (limit = 20) =>
    api.get<PaginatedAuditLogs>('/audit/recent', { params: { limit } }).then(r => r.data),

  getBySession: (sessionId: string, limit = 50) =>
    api.get(`/audit/sessions/${sessionId}`, { params: { limit } }).then(r => r.data),

  getBySkill: (skillId: string, limit = 50) =>
    api.get(`/audit/skills/${skillId}`, { params: { limit } }).then(r => r.data)
}

// Skills API (admin extensions)
export const skillsApi = {
  getVersions: (idOrSlug: string) =>
    api.get<SkillVersion[]>(`/skills/${idOrSlug}/versions`).then(r => r.data),

  getVersion: (idOrSlug: string, version: string) =>
    api.get<SkillVersion>(`/skills/${idOrSlug}/versions/${version}`).then(r => r.data),

  rollback: (idOrSlug: string, version: string) =>
    api.post<Skill>(`/skills/${idOrSlug}/rollback/${version}`).then(r => r.data),

  getDiff: (idOrSlug: string, v1: string, v2: string) =>
    api.get<VersionDiff>(`/skills/${idOrSlug}/diff`, { params: { v1, v2 } }).then(r => r.data),

  publish: (idOrSlug: string) =>
    api.post<Skill>(`/skills/${idOrSlug}/publish`).then(r => r.data),

  archive: (idOrSlug: string) =>
    api.post<{ success: boolean }>(`/skills/${idOrSlug}/archive`).then(r => r.data)
}

// Tenants API
export const tenantsApi = {
  list: () =>
    api.get<Tenant[]>('/tenants').then(r => r.data),

  getById: (id: string) =>
    api.get<Tenant>(`/tenants/${id}`).then(r => r.data)
}

export default api
