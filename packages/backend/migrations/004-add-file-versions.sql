-- Migration: Add file version tracking
-- Date: 2026-02-12
-- Description: Adds file_versions table and updates agent_files table with version tracking fields

-- Create file_versions table
CREATE TABLE IF NOT EXISTS file_versions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  fileId TEXT NOT NULL,
  version TEXT NOT NULL,
  contentHash TEXT NOT NULL,
  storedPath TEXT NOT NULL,
  size INTEGER NOT NULL,
  mimeType TEXT,
  changelog TEXT,
  uploadedBy TEXT NOT NULL CHECK(uploadedBy IN ('agent', 'user')),
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fileId) REFERENCES agent_files(id) ON DELETE CASCADE,
  UNIQUE(fileId, version)
);

-- Create indexes for file_versions
CREATE INDEX IF NOT EXISTS IDX_file_versions_file_id ON file_versions(fileId);
CREATE INDEX IF NOT EXISTS IDX_file_versions_version ON file_versions(fileId, version);

-- Add version tracking fields to agent_files table
ALTER TABLE agent_files ADD COLUMN currentVersion TEXT DEFAULT '1.0.0';
ALTER TABLE agent_files ADD COLUMN lastVersionAt DATETIME;
ALTER TABLE agent_files ADD COLUMN updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Update existing files to have initial version
UPDATE agent_files SET currentVersion = '1.0.0' WHERE currentVersion IS NULL;
