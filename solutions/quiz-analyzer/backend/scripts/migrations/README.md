# Database Migrations

This directory contains SQL migration scripts for the Quiz Analyzer database.

## Available Migrations

### 002-difficulty-refactor.sql
**Date**: 2026-02-06
**Status**: ✅ Tested

**Changes**:
- Removes `difficulty_rationale` and `time_estimate` fields
- Adds `difficulty_analysis` JSON field
- Migrates existing data to new format

**Documentation**: See `/solutions/quiz-analyzer/DIFFICULTY_REFACTOR_MIGRATION.md`

## Running Migrations

### Test Migration (Safe)
Test on a copy of the database first:

```bash
cd /Users/niex/Documents/GitHub/kedge-ccaas/solutions/quiz-analyzer/backend
bash scripts/test-migration-002.sh
```

### Apply to Production

1. **Backup**
   ```bash
   cd /Users/niex/Documents/GitHub/kedge-ccaas/solutions/quiz-analyzer/backend
   cp data/quiz-analyzer.db data/quiz-analyzer.db.backup-$(date +%Y%m%d-%H%M%S)
   ```

2. **Apply**
   ```bash
   sqlite3 data/quiz-analyzer.db < scripts/migrations/002-difficulty-refactor.sql
   ```

3. **Verify**
   ```bash
   sqlite3 data/quiz-analyzer.db ".schema quiz_analyses"
   ```

## Rollback

```bash
# Restore from backup
cp data/quiz-analyzer.db.backup-YYYYMMDD-HHMMSS data/quiz-analyzer.db
```

## Migration Checklist

Before applying any migration:

- [ ] Read migration documentation
- [ ] Backup database
- [ ] Test migration on copy
- [ ] Verify test results
- [ ] Stop running services
- [ ] Apply migration
- [ ] Verify schema changes
- [ ] Restart services
- [ ] Test functionality

## Best Practices

1. **Always test first** - Use test scripts on database copies
2. **Always backup** - Create timestamped backups before migrations
3. **Use transactions** - All migrations should be wrapped in transactions
4. **Verify results** - Check schema and data after migration
5. **Document changes** - Include clear documentation for each migration
6. **Plan rollback** - Have a rollback strategy ready

## Getting Help

- Migration documentation: `/solutions/quiz-analyzer/DIFFICULTY_REFACTOR_MIGRATION.md`
- Completion summary: `/solutions/quiz-analyzer/DATABASE_MIGRATION_COMPLETE.md`
- Project guide: `/solutions/quiz-analyzer/CLAUDE.md`
