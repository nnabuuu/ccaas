/**
 * Admin DTOs
 *
 * Data transfer objects for admin API endpoints.
 */

import { IsOptional, IsString, IsNumber, IsBoolean, IsEnum, IsArray, Min, Max, IsDateString } from 'class-validator';
import type { AdminAction, TargetType, AlertType, AlertThreshold } from '../entities';

// =============================================================================
// Dashboard DTOs
// =============================================================================

export interface DashboardSummary {
  activeSessions: number;
  totalSessions: number;
  maxSessions: number;
  totalMessages24h: number;
  totalTokens24h: {
    input: number;
    output: number;
    total: number;
  };
  errorRate24h: number;
  activeApiKeys: number;
  totalSkills: number;
  publishedSkills: number;
  callerScope: 'admin' | 'builder';
}

export interface RecentSession {
  sessionId: string;
  solutionId: string | null;
  status: string;
  messageCount: number;
  createdAt: Date;
  lastActivity: Date;
}

// =============================================================================
// Session DTOs
// =============================================================================

export class SessionQueryDto {
  @IsOptional()
  @IsString()
  solutionId?: string;

  @IsOptional()
  @IsString()
  status?: 'idle' | 'processing' | 'error' | 'closed';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  /**
   * Page number (1-based). Default: 1.
   * Takes precedence over offset when both are provided.
   */
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  /**
   * Number of items per page. Default: 50, Max: 250.
   * Takes precedence over limit when both are provided.
   */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(250)
  pageSize?: number;

  /**
   * @deprecated Use page instead. Kept for backward compatibility.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;

  /**
   * @deprecated Use pageSize instead. Kept for backward compatibility.
   */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(250)
  limit?: number;
}

export interface SessionListItem {
  sessionId: string;
  solutionId: string | null;
  clientId: string;
  status: string;
  messageCount: number;
  totalTokens: number;
  estimatedCost: number;
  createdAt: Date;
  lastActivity: Date;
  hasActiveProcess: boolean;
  title: string | null;
  isPinned: boolean;
}

export interface SessionDetail extends SessionListItem {
  workspaceDir: string;
}

export interface TokenBreakdown {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface SessionTimelineEvent {
  id: string;
  type: 'message' | 'tool_event' | 'thinking_block' | 'process_event' | 'api_error' | 'output_update';
  timestamp: Date;
  messageId: string | null;
  turnNumber: number | null;
  data: unknown;
}

export interface TurnSummary {
  turnId: string;
  turnNumber: number;
  userMessageId: string;
  assistantMessageId: string | null;
  totalTokens: number;
  durationMs: number;
  createdAt: Date;
  completedAt: Date | null;
  toolCount: number;
  hasThinking: boolean;
  hasErrors: boolean;
}

export interface SessionTimeline {
  sessionId: string;
  events: SessionTimelineEvent[];
  totalEvents: number;
}

// =============================================================================
// Analytics DTOs
// =============================================================================

export class AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  solutionId?: string;

  @IsOptional()
  @IsEnum(['hourly', 'daily', 'weekly', 'monthly'])
  granularity?: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'daily';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  days?: number = 7;
}

export interface TokenUsageDataPoint {
  timestamp: Date;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
}

export interface TokenUsageAnalytics {
  dataPoints: TokenUsageDataPoint[];
  summary: {
    totalInput: number;
    totalOutput: number;
    totalTokens: number;
    totalCached: number;
    totalReasoning: number;
    avgPerSession: number;
  };
}

export interface CostBreakdown {
  solutionId: string;
  tenantName: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  estimatedCost: number;
  percentage: number;
}

export interface CostAnalytics {
  byTenant: CostBreakdown[];
  byModel: Array<{
    model: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
  }>;
  bySkill: Array<{
    skillId: string;
    skillName: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
  }>;
  totalEstimatedCost: number;
}

export interface ApiKeyUsageStats {
  apiKeyId: string;
  keyPrefix: string;
  name: string;
  solutionId: string;
  requestCount: number;
  lastUsedAt: Date | null;
  rateLimitHits: number;
  errorCount: number;
}

export interface ErrorRateDataPoint {
  timestamp: Date;
  errorCount: number;
  totalMessages: number;
  errorRate: number; // 0-1 (e.g., 0.025 = 2.5%)
}

export interface ErrorRateTrend {
  dataPoints: ErrorRateDataPoint[];
  summary: {
    avgErrorRate: number;
    maxErrorRate: number;
    trend: 'improving' | 'stable' | 'worsening';
  };
}

// =============================================================================
// Audit DTOs
// =============================================================================

export class AuditLogQueryDto {
  @IsOptional()
  @IsString()
  adminId?: string;

  @IsOptional()
  @IsString()
  action?: AdminAction;

  @IsOptional()
  @IsString()
  targetType?: TargetType;

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @IsString()
  solutionId?: string;

  @IsOptional()
  @IsBoolean()
  success?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

// =============================================================================
// Alert DTOs
// =============================================================================

export class CreateAlertDto {
  @IsString()
  alertType!: AlertType;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  threshold!: AlertThreshold;

  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  emailAddresses?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;

  @IsOptional()
  @IsNumber()
  @Min(1)
  cooldownMinutes?: number = 5;
}

export class UpdateAlertDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  threshold?: AlertThreshold;

  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  emailAddresses?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  cooldownMinutes?: number;
}

// =============================================================================
// Skill Version DTOs
// =============================================================================

export interface VersionDiff {
  version1: string;
  version2: string;
  contentDiff: string;
  configDiff: string;
  toolsDiff: string[];
}
