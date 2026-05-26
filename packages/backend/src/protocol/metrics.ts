/**
 * Observability Protocol
 *
 * Metrics events for monitoring, analytics, and token usage tracking.
 */

// ============================================================================
// Metrics Events
// ============================================================================

/**
 * Metrics event - emitted for each generation request
 */
export interface MetricsEvent {
  type: 'metrics';
  sessionId: string;
  payload: {
    requestId: string;
    skillId?: string;

    // Timing
    startTime: number;
    endTime?: number;
    durationMs?: number;

    // Token usage
    tokens?: {
      input: number;
      output: number;
      total: number;
      cached?: number;
      reasoning?: number;
    };

    // Quality indicators
    status: 'success' | 'partial' | 'failed';
    fieldsGenerated: number;
    fieldsTotal: number;
    validationErrors: number;

    // Performance breakdown
    phases?: {
      contextPrep: number;
      cliSpawn: number;
      generation: number;
      transformation: number;
    };
  };
  timestamp: string;
}

// ============================================================================
// Latency Tracking
// ============================================================================

/**
 * Latency hint event - show progress during long operations
 */
export interface LatencyHintEvent {
  type: 'latency_hint';
  sessionId: string;
  payload: {
    phase: 'starting' | 'processing' | 'finalizing';
    estimatedRemainingMs?: number;
    progressPercent?: number;
    currentOperation?: string;
  };
  timestamp: string;
}

/**
 * Latency statistics
 */
export interface LatencyStats {
  p50: number;
  p90: number;
  p99: number;
  avg: number;
  count: number;
  window: 'minute' | 'hour' | 'day';
}

// ============================================================================
// Health & Status
// ============================================================================

/**
 * Health status event - periodic health updates
 */
export interface HealthStatusEvent {
  type: 'health_status';
  payload: {
    serverStatus: 'healthy' | 'degraded' | 'unhealthy';
    activeSessions: number;
    queueDepth: number;
    avgLatencyMs: number;
    errorRate: number;
    rateLimitRemaining?: number;
    rateLimitResetAt?: number;
  };
  timestamp: string;
}

/**
 * Health subscription request
 */
export interface HealthSubscription {
  subscribe: boolean;
  intervalMs?: number;
}

// ============================================================================
// Usage Tracking
// ============================================================================

/**
 * Usage record for billing/analytics
 */
export interface UsageRecord {
  solutionId: string;
  skillId?: string;
  sessionId: string;
  timestamp: number;

  // Consumption
  tokensUsed: number;
  requestCount: number;
  durationMs: number;

  // Context
  entityType?: string;
  operationType: 'generate' | 'regenerate' | 'edit' | 'continue';
  success: boolean;
}

/**
 * Usage summary event - emitted at session end
 */
export interface UsageSummaryEvent {
  type: 'usage_summary';
  sessionId: string;
  payload: {
    totalTokens: number;
    totalRequests: number;
    totalDurationMs: number;
    successRate: number;
    fieldsCovered: string[];
    estimatedCostUsd?: number;
  };
  timestamp: string;
}

// ============================================================================
// Token Accumulator
// ============================================================================

/**
 * Session token accumulator
 */
export interface TokenAccumulator {
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  requestCount: number;
  startTime: number;
}

/**
 * Create a new token accumulator
 */
export function createTokenAccumulator(sessionId: string): TokenAccumulator {
  return {
    sessionId,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    reasoningTokens: 0,
    requestCount: 0,
    startTime: Date.now(),
  };
}

/**
 * Add tokens to accumulator
 */
export function accumulateTokens(
  accumulator: TokenAccumulator,
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    cachedTokens?: number;
    reasoningTokens?: number;
  },
): void {
  accumulator.inputTokens += usage.inputTokens ?? 0;
  accumulator.outputTokens += usage.outputTokens ?? 0;
  accumulator.cachedTokens += usage.cachedTokens ?? 0;
  accumulator.reasoningTokens += usage.reasoningTokens ?? 0;
  accumulator.requestCount++;
}

/**
 * Create a usage summary event from accumulator
 */
export function createUsageSummaryEvent(
  accumulator: TokenAccumulator,
  fieldsCovered: string[],
  successRate: number,
): UsageSummaryEvent {
  const totalDurationMs = Date.now() - accumulator.startTime;
  const totalTokens =
    accumulator.inputTokens +
    accumulator.outputTokens +
    accumulator.reasoningTokens;

  return {
    type: 'usage_summary',
    sessionId: accumulator.sessionId,
    payload: {
      totalTokens,
      totalRequests: accumulator.requestCount,
      totalDurationMs,
      successRate,
      fieldsCovered,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Calculate latency percentiles from samples
 */
export function calculateLatencyStats(
  samples: number[],
  window: 'minute' | 'hour' | 'day',
): LatencyStats {
  if (samples.length === 0) {
    return { p50: 0, p90: 0, p99: 0, avg: 0, count: 0, window };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const count = sorted.length;
  const avg = sorted.reduce((a, b) => a + b, 0) / count;

  const percentile = (p: number) =>
    sorted[Math.floor(count * p)] ?? sorted[count - 1];

  return {
    p50: percentile(0.5),
    p90: percentile(0.9),
    p99: percentile(0.99),
    avg: Math.round(avg),
    count,
    window,
  };
}
