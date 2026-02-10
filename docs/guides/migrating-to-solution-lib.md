# Migrating to solution-lib.sh

**Version**: 1.0.0
**Last Updated**: 2026-02-10

This guide provides step-by-step instructions for migrating existing solutions to use the Solution Development Toolkit (solution-lib.sh).

## Overview

### What is Migration?

Migration involves:
1. Standardizing your `solution.json` configuration
2. Rewriting `setup.sh` to use shared library functions
3. Removing duplicate scripts (inject-skills.sh, create-bootstrap-key.sh)
4. Moving solution-specific logic to `custom_init()`
5. Testing and validating the migration

### Why Migrate?

**Benefits**:
- **59% average code reduction** across migrated solutions
- **Consistent professional output** with color-coded logging
- **Comprehensive error handling** built-in
- **Easy maintenance** - bug fixes benefit all solutions
- **Tested and reliable** - 21 unit tests with 100% pass rate

**Results from migrated solutions**:
- lesson-plan-designer: 82% total code reduction
- quiz-analyzer: 31% code reduction
- problem-explainer: 72% total code reduction

## Prerequisites

Before starting migration:

1. ✅ **Backup your solution**:
   ```bash
   cd solutions/my-solution
   mkdir -p .migration-backup
   cp setup.sh .migration-backup/setup.sh.old
   cp solution.json .migration-backup/solution.json.old
   cp inject-skills.sh .migration-backup/inject-skills.sh.backup 2>/dev/null || true
   cp create-bootstrap-key.sh .migration-backup/create-bootstrap-key.sh.backup 2>/dev/null || true
   ```

2. ✅ **Ensure CCAAS backend is running**:
   ```bash
   curl http://localhost:3001/api/v1/health
   ```

3. ✅ **Test current setup works**:
   ```bash
   ./setup.sh
   # Verify services start correctly
   # Press Ctrl+C to stop
   ```

4. ✅ **Have toolkit installed**:
   ```bash
   ls -la ../../tools/solution-lib.sh  # Should exist
   ```

## Migration Steps

### Step 1: Analyze Current Setup

#### 1.1 Identify Custom Logic

Review your current `setup.sh` and identify solution-specific operations:

**Keep as custom logic**:
- ✅ Database migrations
- ✅ Data import workflows (Excel, CSV, etc.)
- ✅ Solution-specific builds
- ✅ Custom validation
- ✅ Third-party service configuration

**Replace with shared library**:
- ❌ Port management
- ❌ Dependency checking
- ❌ Tenant creation
- ❌ API key generation
- ❌ Skill injection
- ❌ MCP server registration
- ❌ Service startup/shutdown

#### 1.2 Document Custom Workflows

Create a checklist of custom operations:

```bash
# Example custom operations for quiz-analyzer:
# - Check Excel files exist
# - Install script dependencies
# - Analyze Excel structure
# - Import Excel to SQLite
# - Verify database statistics
# - Build MCP server
```

### Step 2: Standardize solution.json

#### 2.1 Add Schema Reference

Add at the top:
```json
{
  "$schema": "https://ccaas.dev/schemas/solution.v1.json",
  ...
}
```

#### 2.2 Convert skill to skills Array

**Before** (singular):
```json
{
  "skill": {
    "name": "My Skill",
    "description": "...",
    "triggers": [...],
    "allowedTools": [...],
    "skillFile": "skills/my-skill/SKILL.md"
  }
}
```

**After** (array):
```json
{
  "skills": [
    {
      "name": "My Skill",
      "slug": "my-skill",
      "description": "...",
      "skillFile": "skills/my-skill/SKILL.md",
      "scope": "tenant",
      "triggers": [...],
      "allowedTools": [...]
    }
  ]
}
```

#### 2.3 Add Database Configuration

```json
{
  "backend": {
    "port": 3002,
    "ccaasUrl": "http://localhost:3001",
    "database": {
      "type": "sqlite",
      "path": "data/my-solution.db"
    }
  }
}
```

#### 2.4 Standardize MCP Server Configuration

**Before**:
```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "MCP server"
    }
  }
}
```

**After** (add type and env):
```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "MCP server",
      "type": "stdio",
      "env": {}
    }
  }
}
```

#### 2.5 Add Setup Configuration

```json
{
  "setup": {
    "skipSteps": [],
    "customScripts": {
      "preInstall": ".solution-hooks/pre-install.sh",
      "customInit": ".solution-hooks/custom-init.sh",
      "postInstall": ".solution-hooks/post-install.sh"
    }
  }
}
```

### Step 3: Rewrite setup.sh

#### 3.1 Create New setup.sh Template

Create `setup.sh.new`:

```bash
#!/bin/bash
# My Solution - Setup Script
# Uses: tools/solution-lib.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$SCRIPT_DIR/../../tools"

# Source shared library
if [ ! -f "$TOOLS_DIR/solution-lib.sh" ]; then
    echo "❌ Error: solution-lib.sh not found at $TOOLS_DIR"
    echo "   Please run from solutions/ directory"
    exit 1
fi

source "$TOOLS_DIR/solution-lib.sh"

# Load solution configuration
load_solution_config "$SCRIPT_DIR"

# Custom initialization
custom_init() {
    # TODO: Move your custom logic here
    # Examples:
    # - Build MCP server
    # - Import data
    # - Run migrations

    return 0
}

# Main workflow
main() {
    log_header "$SOLUTION_NAME Setup"

    # Step 1: Check dependencies
    log_step "1" "Checking dependencies"
    check_dependencies
    log_info "Node.js version: $(node -v)"

    # Step 2: Check CCAAS backend
    log_step "2" "Verifying CCAAS backend"
    check_ccaas_backend

    # Step 3: Install npm dependencies
    log_step "3" "Installing dependencies"
    run_hook "preInstall"
    install_npm_dependencies "$SCRIPT_DIR/frontend"
    install_npm_dependencies "$SCRIPT_DIR/backend"

    # Step 3.5: Custom initialization
    custom_init

    # Step 4: Create or get tenant
    log_step "4" "Setting up tenant"
    TENANT_ID=$(create_or_get_tenant "$CCAAS_URL" "$SOLUTION_SLUG" "$SOLUTION_NAME" "$SOLUTION_DESCRIPTION")
    log_info "Tenant ID: $TENANT_ID"

    # Step 5: Create or get API key
    log_step "5" "Setting up API key"
    if [ -z "$CCAAS_API_KEY" ]; then
        CCAAS_API_KEY=$(create_bootstrap_key "$CCAAS_DB" "$SOLUTION_SLUG" --quiet)
        export CCAAS_API_KEY
        log_success "Bootstrap API Key created: ${CCAAS_API_KEY:0:16}..."
        echo ""
        log_warn "🔐 Please save this API Key (shown only once):"
        echo "   $CCAAS_API_KEY"
        echo ""
    else
        log_success "Using existing API Key: ${CCAAS_API_KEY:0:16}..."
    fi

    # Step 6: Inject skills and MCP servers
    log_step "6" "Injecting skills and MCP servers"
    inject_skills "$SCRIPT_DIR/skills" "$CCAAS_URL" "$TENANT_ID" "$CCAAS_API_KEY"
    inject_mcp_servers "$SCRIPT_DIR" "$CCAAS_URL" "$TENANT_ID" "$CCAAS_API_KEY"

    run_hook "postInstall"

    # Step 7: Clear ports
    log_step "7" "Preparing ports"
    kill_port "$BACKEND_PORT"
    kill_port "$FRONTEND_PORT"

    # Step 8: Start services
    log_step "8" "Starting services"
    BACKEND_PID=$(start_service "backend" "$SCRIPT_DIR/backend" "$BACKEND_PORT" "npm run dev")
    wait_for_port "$BACKEND_PORT" 30

    FRONTEND_PID=$(start_service "frontend" "$SCRIPT_DIR/frontend" "$FRONTEND_PORT" "npm run dev")
    wait_for_port "$FRONTEND_PORT" 30

    # Step 9: Display summary
    display_summary

    echo ""
    log_warn "⚠️  Ensure CCAAS backend is running on port 3001:"
    echo "   cd packages/backend && npm run start:dev"
    echo ""
    echo "Press Ctrl+C to stop all services"

    # Wait for Ctrl+C
    trap cleanup SIGINT SIGTERM
    wait
}

# Cleanup function
cleanup() {
    echo ""
    log_info "Stopping services..."
    stop_service "$BACKEND_PID"
    stop_service "$FRONTEND_PID"
    kill_port "$BACKEND_PORT"
    kill_port "$FRONTEND_PORT"
    log_success "Services stopped"
    exit 0
}

# Run main
main "$@"
```

#### 3.2 Implement custom_init()

Move your custom logic to `custom_init()`:

**Example 1: MCP Server Build**
```bash
custom_init() {
    log_step "3.5" "Building MCP server"

    local mcp_dir="$SCRIPT_DIR/mcp-server"
    if [ -d "$mcp_dir" ]; then
        cd "$mcp_dir"
        npm install > /dev/null 2>&1
        npm run build > /dev/null 2>&1
        log_success "MCP server built"
    fi

    return 0
}
```

**Example 2: Data Import** (quiz-analyzer)
```bash
custom_init() {
    log_step "3.5" "Data import workflow"

    # Check Excel files
    if [ ! -f "$SCRIPT_DIR/resources/data.xlsx" ]; then
        log_warn "Excel files not found"
        read -p "Press Enter to continue..."
    fi

    # Install script dependencies
    cd "$SCRIPT_DIR/scripts"
    npm install > /dev/null 2>&1

    # Import data
    log_info "Importing data..."
    node import-data.js
    log_success "Data imported"

    return 0
}
```

**Example 3: Database Migration**
```bash
custom_init() {
    log_step "3.5" "Database setup"

    # Create database directory
    mkdir -p "$SCRIPT_DIR/data"

    # Run migrations
    if [ -f "$SCRIPT_DIR/backend/migrations/schema.sql" ]; then
        log_info "Running database migrations..."
        sqlite3 "$SCRIPT_DIR/data/my-solution.db" < "$SCRIPT_DIR/backend/migrations/schema.sql"
        log_success "Migrations complete"
    fi

    return 0
}
```

### Step 4: Validate Migration

#### 4.1 Create Validation Script

Create `validate-migration.sh`:

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$SCRIPT_DIR/../../tools"

echo "========================================"
echo "  Migration Validation"
echo "========================================"
echo ""

# Test 1: Syntax check
echo "Test 1: Syntax check..."
if bash -n "$SCRIPT_DIR/setup.sh"; then
    echo "✅ Syntax is valid"
else
    echo "❌ Syntax errors found"
    exit 1
fi
echo ""

# Test 2: Load library
echo "Test 2: Library loading..."
if [ -f "$TOOLS_DIR/solution-lib.sh" ]; then
    source "$TOOLS_DIR/solution-lib.sh"
    echo "✅ Library loaded"
else
    echo "❌ Library not found"
    exit 1
fi
echo ""

# Test 3: Load configuration
echo "Test 3: Configuration loading..."
load_solution_config "$SCRIPT_DIR"

if [ -n "$SOLUTION_NAME" ]; then
    echo "✅ Configuration loaded: $SOLUTION_NAME"
else
    echo "❌ Configuration failed"
    exit 1
fi
echo ""

# Test 4: Validate configuration
echo "Test 4: Configuration validation..."
if validate_solution_config; then
    echo "✅ Configuration is valid"
else
    echo "❌ Configuration validation failed"
    exit 1
fi
echo ""

# Test 5: Line count comparison
echo "Test 5: Code reduction..."
if [ -f "$SCRIPT_DIR/.migration-backup/setup.sh.old" ]; then
    OLD_LINES=$(wc -l < "$SCRIPT_DIR/.migration-backup/setup.sh.old" | tr -d ' ')
    NEW_LINES=$(wc -l < "$SCRIPT_DIR/setup.sh" | tr -d ' ')
    REDUCTION=$((OLD_LINES - NEW_LINES))
    PERCENT=$((REDUCTION * 100 / OLD_LINES))

    echo "  Old: $OLD_LINES lines"
    echo "  New: $NEW_LINES lines"
    echo "  Reduction: $REDUCTION lines ($PERCENT%)"

    if [ $PERCENT -ge 20 ]; then
        echo "✅ Code reduction achieved"
    else
        echo "⚠️  Low reduction: $PERCENT%"
    fi
fi
echo ""

echo "========================================"
echo "  Validation Complete"
echo "========================================"
echo ""
echo "✅ Migration is ready for testing"
echo ""
```

Make it executable:
```bash
chmod +x validate-migration.sh
```

#### 4.2 Run Validation

```bash
./validate-migration.sh
```

Expected output:
```
========================================
  Migration Validation
========================================

Test 1: Syntax check...
✅ Syntax is valid

Test 2: Library loading...
✅ Library loaded

Test 3: Configuration loading...
✅ Configuration loaded: My Solution

Test 4: Configuration validation...
✅ Configuration is valid

Test 5: Code reduction...
  Old: 250 lines
  New: 150 lines
  Reduction: 100 lines (40%)
✅ Code reduction achieved

========================================
  Validation Complete
========================================

✅ Migration is ready for testing
```

### Step 5: Test Migration

#### 5.1 Dry Run

Test with syntax checking:
```bash
# Fix line endings
sed -i '' 's/\r$//' setup.sh.new

# Check syntax
bash -n setup.sh.new

# Validate
./validate-migration.sh
```

#### 5.2 Apply Migration

```bash
# Apply new files
mv setup.sh.new setup.sh
chmod +x setup.sh

mv solution.json.new solution.json

# Remove obsolete scripts
rm inject-skills.sh 2>/dev/null || true
rm create-bootstrap-key.sh 2>/dev/null || true
```

#### 5.3 Full Test

```bash
# Clean environment
killall node 2>/dev/null || true

# Run new setup
./setup.sh
```

**Verify**:
- ✅ Dependencies checked
- ✅ CCAAS connectivity verified
- ✅ Tenant created/retrieved
- ✅ API key created
- ✅ Skills injected
- ✅ MCP servers registered
- ✅ Backend started on correct port
- ✅ Frontend started on correct port
- ✅ Cleanup works (Ctrl+C)

### Step 6: Document Migration

Create `MIGRATION_GUIDE.md` in your solution directory:

```markdown
# Migration to solution-lib.sh

**Date**: 2026-02-10
**Status**: ✅ Completed

## Changes Made

### solution.json
- Added $schema reference
- Converted "skill" → "skills" array
- Added database configuration
- Standardized MCP server config
- Added setup.customScripts section

### setup.sh
- Rewritten using solution-lib.sh
- Reduced from XXX → YYY lines (ZZ% reduction)
- Moved custom logic to custom_init()
- Added professional logging
- Improved error handling

### Removed Files
- inject-skills.sh (functionality in shared library)
- create-bootstrap-key.sh (functionality in shared library)

## Backup Location

All original files backed up to:
- `.migration-backup/setup.sh.old`
- `.migration-backup/solution.json.old`
- `.migration-backup/inject-skills.sh.backup`

## Rollback Instructions

If needed, restore from backup:
```bash
cp .migration-backup/setup.sh.old setup.sh
cp .migration-backup/solution.json.old solution.json
chmod +x setup.sh
```

## Testing Checklist

- [x] Syntax validation passed
- [x] Configuration loads correctly
- [x] Services start successfully
- [x] Skills injection works
- [x] MCP registration works
- [x] Cleanup works (Ctrl+C)

## Notes

[Add any solution-specific notes here]
```

## Common Migration Patterns

### Pattern 1: Simple Solution (Frontend Only)

**Before**: 150 lines
**After**: ~90 lines
**Reduction**: ~40%

No backend, minimal custom logic. Just frontend + skills.

### Pattern 2: Standard Solution (Frontend + Backend)

**Before**: 230 lines
**After**: ~120-150 lines
**Reduction**: 35-48%

Standard setup with both frontend and backend, MCP server build.

### Pattern 3: Complex Solution (Data Import)

**Before**: 270 lines
**After**: ~180-200 lines
**Reduction**: 25-35%

Includes data import workflows, database setup, complex initialization.

## Rollback Procedure

If migration fails:

```bash
cd solutions/my-solution

# Restore from backup
cp .migration-backup/setup.sh.old setup.sh
cp .migration-backup/solution.json.old solution.json
cp .migration-backup/inject-skills.sh.backup inject-skills.sh 2>/dev/null || true
cp .migration-backup/create-bootstrap-key.sh.backup create-bootstrap-key.sh 2>/dev/null || true

# Make executable
chmod +x setup.sh inject-skills.sh create-bootstrap-key.sh 2>/dev/null || true

echo "✅ Rollback complete"
```

## Migration Checklist

Use this checklist to track your migration:

### Pre-Migration
- [ ] Backup all files to `.migration-backup/`
- [ ] Test current setup works
- [ ] Document custom logic
- [ ] Verify toolkit is installed

### Configuration
- [ ] Add `$schema` to solution.json
- [ ] Convert `skill` → `skills` array
- [ ] Add database configuration
- [ ] Add `type` and `env` to MCP servers
- [ ] Add `setup.customScripts` section

### Code Migration
- [ ] Create setup.sh.new with template
- [ ] Implement `custom_init()` with custom logic
- [ ] Remove duplicate code
- [ ] Add proper cleanup handler
- [ ] Fix line endings

### Validation
- [ ] Run `bash -n setup.sh.new`
- [ ] Run `./validate-migration.sh`
- [ ] Apply migration
- [ ] Test complete setup flow
- [ ] Verify all services start
- [ ] Test Ctrl+C cleanup

### Documentation
- [ ] Create MIGRATION_GUIDE.md
- [ ] Create DEPRECATED_SCRIPTS.md (if applicable)
- [ ] Update README.md if needed
- [ ] Commit changes

### Post-Migration
- [ ] Remove obsolete scripts
- [ ] Clean up temporary files
- [ ] Share migration results
- [ ] Update team documentation

## Example Migrations

See these solutions for reference:

- **lesson-plan-designer**: Complete migration with MCP build
- **quiz-analyzer**: Data import workflow in custom_init()
- **problem-explainer**: MCP REST server integration

## Getting Help

If you encounter issues:

1. Check [Troubleshooting Guide](./solution-troubleshooting.md)
2. Review validation script output
3. Compare with migrated solutions
4. Check migration backup files
5. Ask in CCAAS repository

## Success Metrics

Track your migration success:

| Metric | Target | Your Result |
|--------|--------|-------------|
| Code reduction | 25-50% | ___% |
| Validation pass | 100% | ___% |
| Test completion | 100% | ___% |
| Services start | 100% | ___% |

---

**Version**: 1.0.0
**Last Updated**: 2026-02-10
**Maintained by**: CCAAS Team
