-- Migration: Remove calculate_difficulty related fields and add difficulty_analysis
-- Date: 2026-02-06
-- Description: Refactor quiz_analyses table to use JSON-based difficulty analysis
--              Removes: difficulty_rationale, time_estimate
--              Adds: difficulty_analysis (JSON)

-- Start transaction
BEGIN TRANSACTION;

-- Step 1: Create new column for JSON-based difficulty analysis
ALTER TABLE quiz_analyses ADD COLUMN difficulty_analysis TEXT;

-- Step 2: Migrate existing data if any (convert old fields to new JSON format)
-- This preserves any existing difficulty_rationale and time_estimate data
UPDATE quiz_analyses
SET difficulty_analysis = json_object(
    'rationale', COALESCE(difficulty_rationale, ''),
    'timeEstimate', COALESCE(time_estimate, ''),
    'migratedFrom', 'calculate_difficulty',
    'migratedAt', datetime('now')
)
WHERE difficulty_rationale IS NOT NULL OR time_estimate IS NOT NULL;

-- Step 3: Create temporary table with new schema (without old fields)
CREATE TABLE quiz_analyses_new (
    id TEXT PRIMARY KEY,
    quiz_id TEXT NOT NULL UNIQUE,
    thinking_process TEXT,
    solution_steps TEXT,
    common_mistakes TEXT,
    knowledge_gap_analysis TEXT,
    difficulty_analysis TEXT,
    analyzed_at TEXT DEFAULT (datetime('now')),
    analyzer_version TEXT DEFAULT '1.0',
    analysis_duration_ms INTEGER,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

-- Step 4: Copy data from old table to new table
INSERT INTO quiz_analyses_new (
    id,
    quiz_id,
    thinking_process,
    solution_steps,
    common_mistakes,
    knowledge_gap_analysis,
    difficulty_analysis,
    analyzed_at,
    analyzer_version,
    analysis_duration_ms
)
SELECT
    id,
    quiz_id,
    thinking_process,
    solution_steps,
    common_mistakes,
    knowledge_gap_analysis,
    difficulty_analysis,
    analyzed_at,
    analyzer_version,
    analysis_duration_ms
FROM quiz_analyses;

-- Step 5: Drop old table
DROP TABLE quiz_analyses;

-- Step 6: Rename new table to original name
ALTER TABLE quiz_analyses_new RENAME TO quiz_analyses;

-- Step 7: Recreate indexes
CREATE INDEX idx_qa_quiz ON quiz_analyses(quiz_id);
CREATE INDEX idx_qa_analyzed_at ON quiz_analyses(analyzed_at);

-- Commit transaction
COMMIT;

-- Verification query (run this separately to check migration success)
-- SELECT COUNT(*) as total_analyses,
--        COUNT(difficulty_analysis) as with_difficulty_analysis,
--        COUNT(CASE WHEN json_extract(difficulty_analysis, '$.migratedFrom') = 'calculate_difficulty' THEN 1 END) as migrated_records
-- FROM quiz_analyses;
