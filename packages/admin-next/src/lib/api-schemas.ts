import { z } from 'zod'

// Dashboard Analytics Token Data
export const TokenDataPointSchema = z.object({
  timestamp: z.string().datetime(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  cachedTokens: z.number().int().nonnegative().optional(),
  reasoningTokens: z.number().int().nonnegative().optional(),
})

export const TokenAnalyticsResponseSchema = z.object({
  dataPoints: z.array(TokenDataPointSchema),
})

export type TokenDataPoint = z.infer<typeof TokenDataPointSchema>
export type TokenAnalyticsResponse = z.infer<typeof TokenAnalyticsResponseSchema>

// API Keys Analytics
export const ApiKeyAnalyticsSchema = z.object({
  apiKeyId: z.string(),
  keyPrefix: z.string(),
  name: z.string(),
  tenantId: z.string(),
  requestCount: z.number().int().nonnegative(),
  lastUsedAt: z.string().datetime().nullable(),
  rateLimitHits: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
})

export const ApiKeysAnalyticsResponseSchema = z.array(ApiKeyAnalyticsSchema)

export type ApiKeyAnalytics = z.infer<typeof ApiKeyAnalyticsSchema>

// Recent Sessions
export const RecentSessionSchema = z.object({
  sessionId: z.string(),
  tenantId: z.string(),
  status: z.enum(['idle', 'processing', 'completed', 'error']),
  messageCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  lastActivity: z.string().datetime(),
})

export const RecentSessionsResponseSchema = z.array(RecentSessionSchema)

export type RecentSession = z.infer<typeof RecentSessionSchema>

// Dashboard Summary
export const TokenSummarySchema = z.object({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
})

export const DashboardSummarySchema = z.object({
  activeSessions: z.number().int().nonnegative(),
  totalSessions: z.number().int().nonnegative(),
  maxSessions: z.number().int().positive().optional(),
  totalMessages24h: z.number().int().nonnegative(),
  totalTokens24h: TokenSummarySchema,
  errorRate24h: z.number().min(0).max(1),
  activeApiKeys: z.number().int().nonnegative(),
  totalSkills: z.number().int().nonnegative(),
  publishedSkills: z.number().int().nonnegative(),
})

export type DashboardSummary = z.infer<typeof DashboardSummarySchema>
