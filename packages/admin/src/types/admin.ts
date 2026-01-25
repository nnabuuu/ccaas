/**
 * Admin Types
 *
 * TypeScript type definitions for admin API responses.
 */

// Dashboard
export interface DashboardSummary {
  activeSessions: number
  totalSessions: number
  maxSessions: number
  totalMessages24h: number
  totalTokens24h: {
    input: number
    output: number
    total: number
  }
  errorRate24h: number
  activeApiKeys: number
  totalSkills: number
  publishedSkills: number
}

export interface RecentSession {
  sessionId: string
  tenantId: string | null
  status: string
  messageCount: number
  createdAt: string
  lastActivity: string
}

// Sessions
export interface SessionListItem {
  sessionId: string
  tenantId: string | null
  clientId: string
  status: 'idle' | 'processing' | 'error' | 'closed'
  messageCount: number
  createdAt: string
  lastActivity: string
  hasActiveProcess: boolean
}

export interface SessionDetail extends SessionListItem {
  workspaceDir: string
}

export interface SessionTimelineEvent {
  id: string
  type: 'message' | 'tool_event' | 'thinking_block' | 'process_event' | 'api_error'
  timestamp: string
  data: Record<string, unknown>
}

export interface SessionTimeline {
  sessionId: string
  events: SessionTimelineEvent[]
  totalEvents: number
}

export interface PaginatedSessions {
  items: SessionListItem[]
  total: number
  limit: number
  offset: number
}

// Analytics
export interface TokenUsageDataPoint {
  timestamp: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cachedTokens: number
  reasoningTokens: number
}

export interface TokenUsageAnalytics {
  dataPoints: TokenUsageDataPoint[]
  summary: {
    totalInput: number
    totalOutput: number
    totalTokens: number
    totalCached: number
    totalReasoning: number
    avgPerSession: number
  }
}

export interface CostBreakdown {
  tenantId: string
  tenantName: string
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  estimatedCost: number
  percentage: number
}

export interface CostAnalytics {
  byTenant: CostBreakdown[]
  byModel: Array<{
    model: string
    inputTokens: number
    outputTokens: number
    estimatedCost: number
  }>
  bySkill: Array<{
    skillId: string
    skillName: string
    inputTokens: number
    outputTokens: number
    estimatedCost: number
  }>
  totalEstimatedCost: number
}

export interface ApiKeyUsageStats {
  apiKeyId: string
  keyPrefix: string
  name: string
  tenantId: string
  requestCount: number
  lastUsedAt: string | null
  rateLimitHits: number
  errorCount: number
}

// Audit
export type AdminAction =
  | 'skill.create'
  | 'skill.update'
  | 'skill.publish'
  | 'skill.archive'
  | 'skill.rollback'
  | 'session.kill'
  | 'session.restart'
  | 'apikey.create'
  | 'apikey.revoke'
  | 'apikey.update'
  | 'tenant.create'
  | 'tenant.update'

export interface AuditLogEntry {
  id: string
  adminId: string
  action: AdminAction
  targetType: string
  targetId: string
  tenantId: string | null
  metadata: Record<string, unknown> | null
  success: boolean
  errorMessage: string | null
  createdAt: string
}

export interface PaginatedAuditLogs {
  items: AuditLogEntry[]
  total: number
  limit: number
  offset: number
}

// Skills
export interface Skill {
  id: string
  tenantId: string
  name: string
  slug: string
  description: string
  content: string
  type: 'skill' | 'sub-agent' | 'workflow' | 'tool-config'
  status: 'draft' | 'review' | 'published' | 'deprecated' | 'archived'
  currentVersion: string
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SkillVersion {
  id: string
  skillId: string
  version: string
  content: string
  contentHash: string
  config: Record<string, unknown>
  allowedTools: string[]
  changelog: string | null
  deploymentStatus: string
  createdAt: string
}

export interface VersionDiff {
  version1: string
  version2: string
  contentDiff: string
  configDiff: string
  toolsDiff: string[]
}

// Tenants
export interface Tenant {
  id: string
  name: string
  slug: string
  status: 'active' | 'suspended' | 'pending' | 'deleted'
  plan: 'free' | 'starter' | 'professional' | 'enterprise'
  createdAt: string
  updatedAt: string
}

// API Keys
export interface ApiKey {
  id: string
  tenantId: string
  name: string
  keyPrefix: string
  scopes: string[]
  rateLimitRpm: number
  rateLimitRpd: number
  lastUsedAt: string | null
  usageCount: number
  status: 'active' | 'revoked' | 'expired'
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}
