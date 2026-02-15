-- Migration: Add conversation persistence tables (messages, conversation_contexts, turns)
-- Date: 2026-02-15
-- Description: Create tables for persisting conversation messages, context metadata,
--              and turn-level analytics to support conversation history and replay.

BEGIN TRANSACTION;

-- Step 1: Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,                          -- msg_{uuid}
    session_id TEXT NOT NULL,                      -- References session
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    message_index INTEGER NOT NULL,               -- 0-based sequential position
    parent_message_id TEXT,                        -- For conversation branching
    branch_id TEXT,                                -- Groups messages in same branch
    is_continuation INTEGER NOT NULL DEFAULT 0,    -- Reconnection continuation flag
    metadata TEXT,                                 -- JSON: { model, inputTokens, outputTokens, ... }
    tool_calls TEXT,                               -- JSON array of ToolCall
    thinking_blocks TEXT,                           -- JSON array of ThinkingBlock
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for efficient message retrieval by session, ordered by position
CREATE INDEX IF NOT EXISTS idx_messages_session_index ON messages(session_id, message_index);

-- Index for branch-based queries
CREATE INDEX IF NOT EXISTS idx_messages_branch ON messages(branch_id);

-- Step 2: Create conversation_contexts table
CREATE TABLE IF NOT EXISTS conversation_contexts (
    id TEXT PRIMARY KEY,                          -- ctx_{uuid}
    session_id TEXT NOT NULL UNIQUE,              -- 1:1 with session
    tenant_id TEXT,
    system_prompt_hash TEXT,                      -- SHA-256 hash of system prompt
    skill_config_hashes TEXT,                     -- JSON array of { slug, hash }
    mcp_tools_list TEXT,                          -- JSON array of tool names
    model TEXT,
    workspace_dir TEXT,
    client_id TEXT,
    metadata TEXT,                                -- JSON extensible metadata
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for tenant-based queries
CREATE INDEX IF NOT EXISTS idx_contexts_tenant ON conversation_contexts(tenant_id);

-- Step 3: Create turns table
CREATE TABLE IF NOT EXISTS turns (
    id TEXT PRIMARY KEY,                          -- turn_{uuid}
    session_id TEXT NOT NULL,
    turn_number INTEGER NOT NULL,                 -- 0-based
    user_message_id TEXT NOT NULL,                -- References messages.id
    assistant_message_id TEXT,                    -- NULL until assistant responds
    total_tokens INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT                             -- NULL until turn completes
);

-- Index for efficient turn retrieval by session, ordered by number
CREATE INDEX IF NOT EXISTS idx_turns_session_number ON turns(session_id, turn_number);

COMMIT;

-- Verification queries (run separately):
-- SELECT name FROM sqlite_master WHERE type='table' AND name IN ('messages', 'conversation_contexts', 'turns');
-- SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_messages_%' OR name LIKE 'idx_contexts_%' OR name LIKE 'idx_turns_%';
