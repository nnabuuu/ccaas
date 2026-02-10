# Deprecated Scripts

**Date**: 2026-02-10
**Reason**: Migrated to Solution Development Toolkit (solution-lib.sh)

The following scripts have been deprecated and replaced by shared library functions:

## ❌ create-bootstrap-key.sh

**Status**: DEPRECATED (backed up to `.migration-backup/`)

**Replacement**: `create_bootstrap_key()` function in `tools/solution-lib.sh`

**Usage**:
```bash
# OLD
./create-bootstrap-key.sh

# NEW (in setup.sh)
CCAAS_API_KEY=$(create_bootstrap_key "$CCAAS_DB" "$SOLUTION_SLUG" --quiet)
```

**Reason**: Functionality moved to shared library for reuse across all solutions.

## ❌ inject-skills.sh

**Status**: DEPRECATED (backed up to `.migration-backup/`)

**Replacement**:
- `inject_skills()` function in `tools/solution-lib.sh`
- `inject_mcp_servers()` function in `tools/solution-lib.sh`

**Usage**:
```bash
# OLD
export CCAAS_API_KEY=sk-xxx
./inject-skills.sh

# NEW (in setup.sh)
inject_skills "$SCRIPT_DIR/skills" "$CCAAS_URL" "$TENANT_ID" "$CCAAS_API_KEY"
inject_mcp_servers "$SCRIPT_DIR" "$CCAAS_URL" "$TENANT_ID" "$CCAAS_API_KEY"
```

**Reason**: Functionality moved to shared library for reuse across all solutions.

## Migration Timeline

- **2026-01-29**: Original scripts created
- **2026-02-10**: Migrated to solution-lib.sh
- **Backup location**: `.migration-backup/`

## Rollback Instructions

If you need to rollback to the old scripts:

```bash
cd solutions/lesson-plan-designer

# Restore old scripts
cp .migration-backup/create-bootstrap-key.sh.backup create-bootstrap-key.sh
cp .migration-backup/inject-skills.sh.backup inject-skills.sh
chmod +x create-bootstrap-key.sh inject-skills.sh

# Restore old setup.sh
cp .migration-backup/setup.sh.old setup.sh
chmod +x setup.sh

echo "✅ Rollback complete"
```

## See Also

- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Complete migration documentation
- [tools/README.md](../../tools/README.md) - Solution Development Toolkit API reference
- [tools/solution-lib.sh](../../tools/solution-lib.sh) - Shared library implementation
