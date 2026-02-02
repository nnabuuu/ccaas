/**
 * Background Job Types
 *
 * Types for the background job infrastructure.
 * Jobs run long-running tasks (e.g., NotebookLM podcast, PDF generation)
 * in headless Claude sessions with progress tracking and resume support.
 */

// ============================================================================
// Job Status & File Types
// ============================================================================

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobFile {
  name: string;
  path: string;
  size: number;
  mimeType: string;
}

// ============================================================================
// Job Interface
// ============================================================================

export interface Job {
  id: string;
  tenantId: string;
  sessionId?: string;       // originating chat session
  messageId?: string;       // originating chat message (for inline display)
  bgSessionId?: string;     // headless session ID (for --resume)

  type: string;
  name: string;             // human-readable display name
  status: JobStatus;

  prompt: string;
  resultText?: string;
  resultFiles?: JobFile[];
  errorMessage?: string;

  attempts: number;
  maxAttempts: number;
  timeoutMs: number;

  progress?: { step: string; percent: number };

  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  tokenUsage?: { input: number; output: number; cached: number };
  metadata?: Record<string, unknown>;
}

// ============================================================================
// DTOs
// ============================================================================

export interface CreateJobDto {
  tenantId: string;
  type: string;
  name: string;
  prompt: string;
  sessionId?: string;
  messageId?: string;
  mcpServers?: Record<string, unknown>;
  enabledSkillSlugs?: string[];
  maxAttempts?: number;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Socket.io Event
// ============================================================================

export interface JobUpdateEvent {
  type: 'job_update';
  jobId: string;
  sessionId?: string;
  messageId?: string;
  status: JobStatus;
  progress?: { step: string; percent: number };
  resultText?: string;
  resultFiles?: JobFile[];
  errorMessage?: string;
}
