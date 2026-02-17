-- Migration 004: Add unique constraints to prevent race conditions
-- Date: 2026-02-15
-- Purpose: Ensure message_index and turn_number are unique per session

BEGIN TRANSACTION;

-- Add unique constraint on (session_id, message_index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_unique_session_index
ON messages(session_id, message_index);

-- Add unique constraint on (session_id, turn_number)
CREATE UNIQUE INDEX IF NOT EXISTS idx_turns_unique_session_number
ON turns(session_id, turn_number);

COMMIT;
