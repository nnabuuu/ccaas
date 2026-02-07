# Database Migration: Difficulty Refactor

**Date**: 2026-02-06
**Migration**: `002-difficulty-refactor.sql`
**Status**: ✅ Tested Successfully

## Overview

This migration removes the `calculate_difficulty` tool-specific fields from the `quiz_analyses` table and replaces them with a single JSON field `difficulty_analysis` for more flexible difficulty analysis.

## Changes

### Removed Fields
- `difficulty_rationale` TEXT - Rationale for difficulty assessment
- `time_estimate` TEXT - Estimated time to solve

### Added Fields
- `difficulty_analysis` TEXT - JSON field containing difficulty analysis data

## Migration Process

### 1. Pre-Migration Schema
```sql
CREATE TABLE quiz_analyses (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL UNIQUE,
  thinking_process TEXT,
  solution_steps TEXT,
  common_mistakes TEXT,
  knowledge_gap_analysis TEXT,
  difficulty_rationale TEXT,        -- ⚠️ Will be removed
  time_estimate TEXT,                -- ⚠️ Will be removed
  analyzed_at TEXT DEFAULT (datetime('now')),
  analyzer_version TEXT DEFAULT '1.0',
  analysis_duration_ms INTEGER,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);
```

### 2. Post-Migration Schema
```sql
CREATE TABLE quiz_analyses (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL UNIQUE,
  thinking_process TEXT,
  solution_steps TEXT,
  common_mistakes TEXT,
  knowledge_gap_analysis TEXT,
  difficulty_analysis TEXT,          -- ✅ New JSON field
  analyzed_at TEXT DEFAULT (datetime('now')),
  analyzer_version TEXT DEFAULT '1.0',
  analysis_duration_ms INTEGER,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);
```

### 3. Data Migration

The migration preserves existing data by converting old fields to JSON format:

```sql
UPDATE quiz_analyses
SET difficulty_analysis = json_object(
    'rationale', COALESCE(difficulty_rationale, ''),
    'timeEstimate', COALESCE(time_estimate, ''),
    'migratedFrom', 'calculate_difficulty',
    'migratedAt', datetime('now')
)
WHERE difficulty_rationale IS NOT NULL OR time_estimate IS NOT NULL;
```

**Example migrated data**:
```json
{
  "rationale": "This problem requires understanding of quadratic equations",
  "timeEstimate": "5-7 minutes",
  "migratedFrom": "calculate_difficulty",
  "migratedAt": "2026-02-06 10:30:00"
}
```

## Testing

### Test Migration (Safe)

The migration has been tested on a copy of the database:

```bash
cd /Users/niex/Documents/GitHub/kedge-ccaas/solutions/quiz-analyzer/backend
bash scripts/test-migration-002.sh
```

**Test Results**:
- ✅ Migration completed without errors
- ✅ All data preserved in new format
- ✅ Indexes recreated correctly
- ✅ Foreign key constraints maintained
- ✅ Backend build successful

### Verification Queries

After migration, verify data integrity:

```sql
-- Check total analyses and migration status
SELECT
    COUNT(*) as total_analyses,
    COUNT(difficulty_analysis) as with_difficulty_analysis,
    COUNT(CASE
        WHEN json_extract(difficulty_analysis, '$.migratedFrom') = 'calculate_difficulty'
        THEN 1
    END) as migrated_records
FROM quiz_analyses;

-- Sample migrated records
SELECT
    id,
    quiz_id,
    json_extract(difficulty_analysis, '$.rationale') as rationale,
    json_extract(difficulty_analysis, '$.timeEstimate') as time_estimate,
    json_extract(difficulty_analysis, '$.migratedAt') as migrated_at
FROM quiz_analyses
WHERE difficulty_analysis IS NOT NULL
LIMIT 5;
```

## Applying to Production

### 1. Backup Database

**CRITICAL**: Always backup before running migrations!

```bash
cd /Users/niex/Documents/GitHub/kedge-ccaas/solutions/quiz-analyzer/backend
cp data/quiz-analyzer.db data/quiz-analyzer.db.backup-$(date +%Y%m%d-%H%M%S)
```

### 2. Apply Migration

```bash
sqlite3 data/quiz-analyzer.db < scripts/migrations/002-difficulty-refactor.sql
```

### 3. Verify Migration

```bash
# Check schema
sqlite3 data/quiz-analyzer.db ".schema quiz_analyses"

# Run verification query
sqlite3 data/quiz-analyzer.db << 'EOF'
SELECT
    COUNT(*) as total_analyses,
    COUNT(difficulty_analysis) as with_difficulty_analysis
FROM quiz_analyses;
EOF
```

### 4. Restart Services

```bash
# If backend is running, restart it
npm run start:dev
```

## Rollback Plan

If issues occur, rollback using the backup:

```bash
cd /Users/niex/Documents/GitHub/kedge-ccaas/solutions/quiz-analyzer/backend

# Stop services
# (Stop running backend)

# Restore backup
cp data/quiz-analyzer.db.backup-YYYYMMDD-HHMMSS data/quiz-analyzer.db

# Restart services
npm run start:dev
```

## Backend Code Compatibility

### ✅ No Breaking Changes

The backend code does **not** reference the removed fields:

```bash
# Verified: No references found
grep -r "difficulty_rationale\|time_estimate" backend/src/
# (No results)
```

### New JSON Field Usage

To use the new `difficulty_analysis` field in backend code:

```typescript
// In DTOs or entities
interface QuizAnalysis {
  id: string;
  quiz_id: string;
  thinking_process?: string;
  solution_steps?: string;
  common_mistakes?: string;
  knowledge_gap_analysis?: string;
  difficulty_analysis?: DifficultyAnalysis; // New field
  analyzed_at: string;
  analyzer_version: string;
  analysis_duration_ms?: number;
}

interface DifficultyAnalysis {
  rationale?: string;
  timeEstimate?: string;
  difficulty?: number;
  factors?: string[];
  // ... other difficulty-related fields
}

// When reading from database
const analysis = await db.getQuizAnalysis(quizId);
if (analysis.difficulty_analysis) {
  const difficultyData = JSON.parse(analysis.difficulty_analysis);
  console.log(difficultyData.rationale);
}

// When writing to database
const difficultyData: DifficultyAnalysis = {
  rationale: "Complex problem requiring multiple concepts",
  timeEstimate: "10-15 minutes",
  difficulty: 4,
  factors: ["multi-step", "abstract reasoning"]
};
await db.updateQuizAnalysis(quizId, {
  difficulty_analysis: JSON.stringify(difficultyData)
});
```

## Impact Analysis

### Database
- ✅ No data loss (old fields migrated to JSON)
- ✅ No performance impact (same table size)
- ✅ More flexible schema (JSON allows new fields)

### Backend
- ✅ No breaking changes (fields not referenced)
- ✅ Build successful
- ✅ Ready for new difficulty analysis logic

### Frontend
- ⚠️ May need updates if UI displays difficulty_rationale or time_estimate
- 🔄 Will use new JSON field structure

### MCP Server
- ✅ `calculate_difficulty` tool removed (intended change)
- 🔄 New difficulty analysis logic to be implemented

## Next Steps

1. ✅ Test migration on database copy - **COMPLETE**
2. ✅ Verify backend builds - **COMPLETE**
3. ⏳ Update frontend to use new JSON field (if needed)
4. ⏳ Implement new difficulty analysis logic
5. ⏳ Apply migration to production database
6. ⏳ Update MCP server tools documentation

## Files Modified

```
solutions/quiz-analyzer/
├── backend/
│   └── scripts/
│       ├── migrations/
│       │   └── 002-difficulty-refactor.sql        ✨ New migration
│       └── test-migration-002.sh                  ✨ New test script
└── DIFFICULTY_REFACTOR_MIGRATION.md               ✨ This document
```

## References

- Original plan: Database Migration Plan
- Related: `CALCULATE_DIFFICULTY_REMOVAL.md`
- Test database: `backend/data/quiz-analyzer-test-migration.db`
