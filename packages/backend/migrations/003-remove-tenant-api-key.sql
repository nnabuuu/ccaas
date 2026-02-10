-- Migration: Remove legacy tenant API key system
-- Date: 2026-02-11
-- Description: Remove apiKey column from tenants table
--              Modern API key system (api_keys table) is now the only supported method

-- SQLite doesn't support DROP COLUMN directly
-- We need to recreate the table without the apiKey column

-- Step 1: Create new table without apiKey
CREATE TABLE tenants_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  config TEXT DEFAULT '{}',
  maxSessions INTEGER DEFAULT 100,
  maxSkills INTEGER DEFAULT 50,
  maxMcpServers INTEGER DEFAULT 10,
  plan TEXT DEFAULT 'free',
  billingEmail TEXT,
  status TEXT DEFAULT 'active',
  createdAt TEXT,
  updatedAt TEXT
);

-- Step 2: Copy data from old table to new table (excluding apiKey)
INSERT INTO tenants_new (
  id, name, slug, description, config,
  maxSessions, maxSkills, maxMcpServers,
  plan, billingEmail, status, createdAt, updatedAt
)
SELECT
  id, name, slug, description, config,
  maxSessions, maxSkills, maxMcpServers,
  plan, billingEmail, status, createdAt, updatedAt
FROM tenants;

-- Step 3: Drop old table
DROP TABLE tenants;

-- Step 4: Rename new table to original name
ALTER TABLE tenants_new RENAME TO tenants;

-- Step 5: Recreate indexes (if any)
-- Note: Check existing indexes with: SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='tenants';
-- Add index creation statements here if needed
