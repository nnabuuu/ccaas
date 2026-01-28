/**
 * Session Interfaces
 *
 * Types for managing CLI sessions.
 */

import type { ChildProcess } from 'node:child_process';
import type { Writable } from 'node:stream';
import type { Socket } from 'socket.io';

/**
 * Status of a managed session
 */
export type SessionStatus = 'idle' | 'processing' | 'error' | 'closed';

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

  // Session restart tracking (for new skill visibility)
  needsRestart?: boolean;
  skillSyncedAt?: Date;

  // MCP servers configuration passed from solution backends
  mcpServers?: Record<string, {
    command: string;
    args: string[];
    description?: string;
    env?: Record<string, string>;
  }>;
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
