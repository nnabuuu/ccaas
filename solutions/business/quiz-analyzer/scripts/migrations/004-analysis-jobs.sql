-- Migration 004: Analysis Job Queue
-- Creates tables for tracking analysis job progress

CREATE TABLE IF NOT EXISTS analysis_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  template TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_steps INTEGER NOT NULL DEFAULT 0,
  completed_steps INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_session ON analysis_jobs(session_id);

CREATE TABLE IF NOT EXISTS job_steps (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_steps_job ON job_steps(job_id);
