-- Migration: Add sessions table for persistent session storage
-- Date: 2026-02-14
-- Description: Creates sessions table to enable backend pagination and persistent session tracking

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  sessionId TEXT UNIQUE NOT NULL,
  tenantId TEXT,
  clientId TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('idle', 'processing', 'error', 'closed')),
  messageCount INTEGER DEFAULT 0,
  totalTokens INTEGER DEFAULT 0,
  estimatedCost REAL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastActivity DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closedAt DATETIME,
  workspaceDir TEXT
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS IDX_sessions_session_id ON sessions(sessionId);
CREATE INDEX IF NOT EXISTS IDX_sessions_tenant_created_at ON sessions(tenantId, createdAt DESC);
CREATE INDEX IF NOT EXISTS IDX_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS IDX_sessions_last_activity ON sessions(lastActivity DESC);
CREATE INDEX IF NOT EXISTS IDX_sessions_tenant_status ON sessions(tenantId, status);

-- Note: This table will be populated via dual-write pattern from in-memory sessions
-- Existing in-memory sessions will continue to work during migration period
