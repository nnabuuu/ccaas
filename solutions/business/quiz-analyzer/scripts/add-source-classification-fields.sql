-- Migration: Add source classification fields to quiz_knowledge_links
-- Date: 2026-02-06
-- Purpose: Support question vs solution knowledge point distinction

-- Step 1: Add 'source' column with default value
ALTER TABLE quiz_knowledge_links
ADD COLUMN source TEXT DEFAULT 'question';

-- Step 2: Add 'note' column for fallback strategy
ALTER TABLE quiz_knowledge_links
ADD COLUMN note TEXT;

-- Step 3: Create index for efficient filtering by source
CREATE INDEX IF NOT EXISTS idx_qkl_source ON quiz_knowledge_links(source);

-- Step 4: Update existing records to have explicit source values
-- (All existing records default to 'question' which is appropriate
--  since they were identified from quiz content before answer analysis)
UPDATE quiz_knowledge_links
SET source = 'question'
WHERE source IS NULL;

-- Verification queries:
-- SELECT COUNT(*), source FROM quiz_knowledge_links GROUP BY source;
-- SELECT * FROM quiz_knowledge_links WHERE note IS NOT NULL;
