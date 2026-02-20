-- ============================================================
-- ERROR-BASED QUIZ RECOMMENDATION SYSTEM - DATABASE MIGRATION
-- ============================================================
-- Purpose: Add error tracking tables for student answer analysis
--          and error-based similarity recommendations
-- Created: 2026-02-06
-- ============================================================

-- Student answers table
-- Stores complete student answer submissions with error analysis
CREATE TABLE IF NOT EXISTS student_answers (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  student_id TEXT,              -- NULL for anonymous analysis
  session_id TEXT NOT NULL,     -- CCAAS session ID
  answer_content TEXT NOT NULL,
  steps_attempted TEXT,         -- JSON array of strings
  submitted_at TEXT DEFAULT (datetime('now')),
  is_correct INTEGER DEFAULT 0,
  error_steps TEXT,             -- JSON array of ErrorStep
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sa_quiz ON student_answers(quiz_id);
CREATE INDEX IF NOT EXISTS idx_sa_session ON student_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_sa_student ON student_answers(student_id);
CREATE INDEX IF NOT EXISTS idx_sa_submitted ON student_answers(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_sa_correct ON student_answers(is_correct);

-- Error steps table (normalized for efficient querying)
-- Each error step from a student answer is stored individually for analysis
CREATE TABLE IF NOT EXISTS error_steps (
  id TEXT PRIMARY KEY,
  student_answer_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  error_type TEXT NOT NULL,     -- ErrorType enum value
  error_description TEXT NOT NULL,
  affected_knowledge_points TEXT, -- JSON array
  severity TEXT NOT NULL,       -- critical/major/minor
  correct_approach TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (student_answer_id) REFERENCES student_answers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_es_answer ON error_steps(student_answer_id);
CREATE INDEX IF NOT EXISTS idx_es_type ON error_steps(error_type);
CREATE INDEX IF NOT EXISTS idx_es_step ON error_steps(step_number);
CREATE INDEX IF NOT EXISTS idx_es_severity ON error_steps(severity);

-- Error patterns table (aggregated statistics)
-- Stores aggregated error patterns across multiple students for analytics
CREATE TABLE IF NOT EXISTS error_patterns (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  error_type TEXT NOT NULL,
  step_number INTEGER,          -- NULL means error not tied to specific step
  total_occurrences INTEGER DEFAULT 1,
  unique_students INTEGER DEFAULT 1,
  descriptions TEXT NOT NULL,   -- JSON array of example descriptions
  related_knowledge_points TEXT, -- JSON array
  first_seen_at TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  UNIQUE(quiz_id, error_type, step_number)
);

CREATE INDEX IF NOT EXISTS idx_ep_quiz ON error_patterns(quiz_id);
CREATE INDEX IF NOT EXISTS idx_ep_type ON error_patterns(error_type);
CREATE INDEX IF NOT EXISTS idx_ep_occurrences ON error_patterns(total_occurrences DESC);
CREATE INDEX IF NOT EXISTS idx_ep_step ON error_patterns(step_number);

-- ============================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================
-- SELECT COUNT(*) FROM student_answers;
-- SELECT COUNT(*) FROM error_steps;
-- SELECT COUNT(*) FROM error_patterns;
-- SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%error%';
-- ============================================================
