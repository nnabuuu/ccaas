-- Migration: Add User Attribution to Skills
-- Date: 2026-02-07
-- Description: Add createdBy and scope fields to skills table for role-based permissions

-- Add createdBy column (nullable for backward compatibility)
ALTER TABLE skills ADD COLUMN createdBy TEXT REFERENCES users(id) ON DELETE SET NULL;

-- Add scope column (default to 'tenant' for existing skills)
ALTER TABLE skills ADD COLUMN scope TEXT DEFAULT 'tenant' CHECK(scope IN ('tenant', 'personal'));

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_skills_created_by ON skills(createdBy);
CREATE INDEX IF NOT EXISTS idx_skills_scope ON skills(scope);
CREATE INDEX IF NOT EXISTS idx_skills_scope_created_by ON skills(scope, createdBy);

-- Note: Existing skills will have:
-- - createdBy = NULL (indicating legacy/system skills)
-- - scope = 'tenant' (visible to all users in tenant)
