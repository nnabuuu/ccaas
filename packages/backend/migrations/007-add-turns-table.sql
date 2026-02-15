-- Migration: Add turns table for per-turn dialogue analytics
-- Date: 2026-02-15
-- Description: Creates turns table to track individual dialogue turns (user + assistant exchange)

CREATE TABLE IF NOT EXISTS turns (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  sessionId TEXT NOT NULL,
  turnNumber INTEGER NOT NULL,
  userMessageId TEXT NOT NULL,
  assistantMessageId TEXT,
  totalTokens INTEGER DEFAULT 0,
  durationMs INTEGER DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completedAt DATETIME
);

-- Composite index for querying turns by session in order
CREATE INDEX IF NOT EXISTS IDX_turns_session_turn ON turns(sessionId, turnNumber);

-- Index for session lookup
CREATE INDEX IF NOT EXISTS IDX_turns_session_id ON turns(sessionId);
