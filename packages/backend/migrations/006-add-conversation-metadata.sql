-- Migration: Add conversation metadata columns to sessions table
-- Date: 2026-02-15
-- Description: Adds title and isPinned columns for conversation management

ALTER TABLE sessions ADD COLUMN title TEXT;
ALTER TABLE sessions ADD COLUMN isPinned INTEGER DEFAULT 0;
