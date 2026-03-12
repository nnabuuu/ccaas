-- Migration: Rename enabledSkillSlugs column to enabledSkills
-- Date: 2026-03-12
-- Description: Renames the enabledSkillSlugs column in jobs and scheduled_tasks tables
--              to enabledSkills as part of the full codebase terminology unification.
--
-- Note: SQLite does not support ALTER TABLE ... RENAME COLUMN until version 3.25.0.
-- better-sqlite3 bundles SQLite >= 3.40, so this syntax is safe.

ALTER TABLE jobs RENAME COLUMN enabledSkillSlugs TO enabledSkills;

ALTER TABLE scheduled_tasks RENAME COLUMN enabledSkillSlugs TO enabledSkills;
