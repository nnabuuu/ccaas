#!/bin/bash

# Test script for migration 002-difficulty-refactor
# This script tests the migration on a copy of the database

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DB_PATH="$BACKEND_DIR/data/quiz-analyzer.db"
TEST_DB_PATH="$BACKEND_DIR/data/quiz-analyzer-test-migration.db"
MIGRATION_FILE="$SCRIPT_DIR/migrations/002-difficulty-refactor.sql"

echo "=== Testing Migration 002: Difficulty Refactor ==="
echo ""

# Step 1: Check if original database exists
if [ ! -f "$DB_PATH" ]; then
    echo "❌ Error: Database not found at $DB_PATH"
    exit 1
fi

echo "✓ Found database at $DB_PATH"

# Step 2: Create test copy
echo "Creating test copy of database..."
cp "$DB_PATH" "$TEST_DB_PATH"
echo "✓ Test database created at $TEST_DB_PATH"
echo ""

# Step 3: Show before state
echo "=== BEFORE MIGRATION ==="
sqlite3 "$TEST_DB_PATH" << 'EOF'
.mode column
.headers on
SELECT sql FROM sqlite_master WHERE type='table' AND name='quiz_analyses';
EOF
echo ""

echo "Sample data (first 3 rows):"
sqlite3 "$TEST_DB_PATH" << 'EOF'
.mode column
.headers on
SELECT id, quiz_id,
       SUBSTR(difficulty_rationale, 1, 30) as difficulty_rationale,
       SUBSTR(time_estimate, 1, 20) as time_estimate
FROM quiz_analyses LIMIT 3;
EOF
echo ""

# Step 4: Run migration
echo "=== RUNNING MIGRATION ==="
if sqlite3 "$TEST_DB_PATH" < "$MIGRATION_FILE"; then
    echo "✓ Migration completed successfully"
else
    echo "❌ Migration failed"
    rm "$TEST_DB_PATH"
    exit 1
fi
echo ""

# Step 5: Show after state
echo "=== AFTER MIGRATION ==="
sqlite3 "$TEST_DB_PATH" << 'EOF'
.mode column
.headers on
SELECT sql FROM sqlite_master WHERE type='table' AND name='quiz_analyses';
EOF
echo ""

echo "Sample data (first 3 rows):"
sqlite3 "$TEST_DB_PATH" << 'EOF'
.mode column
.headers on
SELECT id, quiz_id,
       SUBSTR(difficulty_analysis, 1, 50) as difficulty_analysis,
       analyzed_at
FROM quiz_analyses LIMIT 3;
EOF
echo ""

# Step 6: Verification queries
echo "=== VERIFICATION ==="
sqlite3 "$TEST_DB_PATH" << 'EOF'
.mode column
.headers on
SELECT
    COUNT(*) as total_analyses,
    COUNT(difficulty_analysis) as with_difficulty_analysis,
    COUNT(CASE WHEN json_extract(difficulty_analysis, '$.migratedFrom') = 'calculate_difficulty' THEN 1 END) as migrated_records
FROM quiz_analyses;
EOF
echo ""

# Step 7: Check indexes
echo "Indexes:"
sqlite3 "$TEST_DB_PATH" << 'EOF'
.mode column
.headers on
SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='quiz_analyses';
EOF
echo ""

# Step 8: Cleanup
echo "=== CLEANUP ==="
echo "Test database kept at: $TEST_DB_PATH"
echo "To apply migration to production database, run:"
echo "  sqlite3 $DB_PATH < $MIGRATION_FILE"
echo ""
echo "To remove test database, run:"
echo "  rm $TEST_DB_PATH"
echo ""
echo "✓ Migration test completed successfully!"
