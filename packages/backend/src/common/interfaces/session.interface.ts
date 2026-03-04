/**
 * Session Interfaces
 *
 * Types for managing CLI sessions.
 */

import type { ChildProcess } from 'node:child_process';
import type { Writable } from 'node:stream';
import type { Socket } from 'socket.io';
import type { SessionEvent } from './session-event.interface';

/**
 * Status of a managed session
 */
export type SessionStatus = 'idle' | 'processing' | 'error' | 'closed' | 'cancelling';

/**
 * A managed CLI session with persistent process
 */
export interface ManagedSession {
  sessionId: string;
  clientId: string;
  cliProcess: ChildProcess | null;
  stdin: Writable | null;
  socket: Socket | null;
  lastActivity: Date;
  status: SessionStatus;
  createdAt: Date;
  messageCount: number;
  buffer: string;
  workspaceDir: string;

  // Message persistence context (set when processing a chat message)
  currentUserMessageId?: string;
  currentAssistantMessageId?: string;
  tenantId?: string;

  // Turn tracking (for per-turn analytics)
  currentTurnId?: string;

  // User tracking (Week 1)
  userId?: string;

  // Session restart tracking (for new skill visibility)
  needsRestart?: boolean;
  skillSyncedAt?: Date;

  // Skill tracking (Week 3) - track which skills are synced to this session
  syncedSkillIds?: Set<string>;

  // MCP servers configuration passed from solution backends
  mcpServers?: Record<string, {
    command: string;
    args: string[];
    description?: string;
    env?: Record<string, string>;
  }>;

  // Skill-specific system prompt injected via --append-system-prompt
  appendSystemPrompt?: string;

  // Session template name (e.g., 'farmer-advisor', 'bank-assessor')
  templateName?: string;

  // Per-session TTL cached from tenant on first message (ms)
  sessionTtlMs?: number;

  // When CLI entered processing state — used for stuck-processing detection
  processingStartedAt?: Date;

  // When CLI exited processing state — preserves start time for duration diagnostics
  processingEndedAt?: Date;

  // Current event handler — updated on each turn so reused CLI processes
  // route events to the correct orchestration's completionPromise
  currentOnEvent?: (event: SessionEvent) => void;
}

/**
 * Session statistics
 */
export interface SessionStats {
  totalSessions: number;
  idleSessions: number;
  processingSessions: number;
  maxSessions: number;
}

/**
 * Token accumulator for session metrics
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
