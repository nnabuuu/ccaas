# Bootstrap Key Migration Summary

This document summarizes the migration of all 6 internal solutions to use the default bootstrap key pattern with the modern API key workflow.

## Migration Date

2026-02-11

## Objective

Simplify the setup workflow for internal solutions by hardcoding a default bootstrap key, eliminating the need for manual environment variable setup while maintaining override flexibility.

## Solutions Migrated

### Phase 1: Add Default Bootstrap Key (4 solutions) ✅

These solutions already used `solution-lib.sh` and the modern API key workflow. Only needed to add the default bootstrap key:

1. **lesson-plan-designer**
2. **quiz-analyzer**
3. **problem-explainer**
4. **ccaas-demo**

### Phase 2: Full Migration (2 solutions) ✅

These solutions required complete migration to the modern API key workflow:

5. **edu-agent**
6. **lego-playground**

## Changes Made

### Phase 1 Solutions (Simple Addition)

**Files Modified:**
- `solutions/lesson-plan-designer/setup.sh`
- `solutions/quiz-analyzer/setup.sh`
- `solutions/problem-explainer/setup.sh`
- `solutions/ccaas-demo/setup.sh`

**Change:**
Added 3 lines after sourcing `solution-lib.sh`:

```bash
# Default bootstrap key for internal solutions
# Can be overridden by setting CCAAS_BOOTSTRAP_KEY environment variable
CCAAS_BOOTSTRAP_KEY="${CCAAS_BOOTSTRAP_KEY:-sk-default-testd84f5b7a1dbdbc4c424417be6c009f01}"
```

### Phase 2 Solutions (Full Migration)

#### edu-agent

**Files Created:**
- `solutions/edu-agent/solution.config`

**Files Modified:**
- `solutions/edu-agent/setup.sh` (complete rewrite)

**New Configuration:**
```bash
SOLUTION_NAME="EduAgent"
SOLUTION_SLUG="edu-agent"
SOLUTION_DESCRIPTION="AI教育助手 - 统一备课设计与讲题解析"
BACKEND_PORT=3010
FRONTEND_PORT=5282
```

**Changes:**
- Migrated to use `solution-lib.sh`
- Added default bootstrap key
- Implemented modern API key workflow
- Added skill and MCP server injection
- Maintained MCP server build functionality
- Added structured logging and error handling

#### lego-playground

**Files Created:**
- `solutions/lego-playground/solution.config`

**Files Modified:**
- `solutions/lego-playground/setup.sh` (complete rewrite)

**New Configuration:**
```bash
SOLUTION_NAME="LEGO Playground"
SOLUTION_SLUG="lego-playground"
SOLUTION_DESCRIPTION="AI 乐高马赛克设计师 - 将图片转换为 2D 乐高拼图，生成零件清单和 PDF 拼装指南"
BACKEND_PORT=3005
FRONTEND_PORT=5282
MCP_PORT=3006
```

**Changes:**
- Migrated to use `solution-lib.sh`
- Added default bootstrap key
- Implemented modern API key workflow
- Added skill and MCP server injection
- Preserved special CLI arguments (`--mcp-only`, `--inject-only`, `--skip-build`)
- Maintained MCP REST server on port 3006
- Added structured logging and error handling

## Default Bootstrap Key

All solutions now use the same default bootstrap key:

```
sk-default-testd84f5b7a1dbdbc4c424417be6c009f01
```

This key is automatically used if `CCAAS_BOOTSTRAP_KEY` environment variable is not set.

## Benefits

### For All Solutions

✅ **Simplified workflow** - `./setup.sh` works immediately without manual key setup
✅ **Override capability** - Can still use custom keys: `CCAAS_BOOTSTRAP_KEY=custom ./setup.sh`
✅ **Consistent behavior** - All solutions follow the same pattern
✅ **Safe for internal use** - These solutions are fully under our control

### For Migrated Solutions (edu-agent, lego-playground)

✅ **Modern authentication** - Uses tenant-scoped API keys instead of legacy pattern
✅ **Better error handling** - Clear error messages and logging
✅ **Skill management** - Automatic skill and MCP server injection
✅ **Port management** - Automatic port cleanup and service management
✅ **Service monitoring** - Wait for services to be ready before proceeding

## Backwards Compatibility

### Environment Variable Override

All solutions support overriding the default bootstrap key:

```bash
# Use custom key for a specific run
CCAAS_BOOTSTRAP_KEY=sk-custom-key ./setup.sh

# Set permanently in shell session
export CCAAS_BOOTSTRAP_KEY=sk-custom-key
./setup.sh
```

### lego-playground CLI Arguments

The migrated `lego-playground/setup.sh` preserves all original CLI arguments:

```bash
./setup.sh                  # Full setup with all services
./setup.sh --mcp-only       # Start only MCP REST server
./setup.sh --inject-only    # Inject skills/MCP servers only
./setup.sh --skip-build     # Skip MCP server build step
```

## Testing Recommendations

### Basic Functionality Test

For any solution:

```bash
cd solutions/<solution-name>
unset CCAAS_BOOTSTRAP_KEY  # Ensure no env var set
./setup.sh
```

Expected: Setup completes successfully using the default bootstrap key.

### Override Test

```bash
cd solutions/<solution-name>
CCAAS_BOOTSTRAP_KEY=sk-test-override ./setup.sh
```

Expected: Setup uses the custom key instead of the default.

### API Key Verification

After setup, verify the API key was created:

```bash
curl -s http://localhost:3001/api/v1/api-keys \
  -H "Authorization: Bearer sk-default-testd84f5b7a1dbdbc4c424417be6c009f01" | jq
```

Expected: Returns list of API keys including the solution's key.

## Migration Workflow Used

### Phase 1 (Add Bootstrap Key)

1. Read existing setup.sh
2. Identify location after `load_solution_config`
3. Insert 3 lines with default bootstrap key
4. Verify no breaking changes

### Phase 2 (Full Migration)

1. Create `solution.config` from `solution.json` values
2. Rewrite `setup.sh` using standard template:
   - Source `solution-lib.sh`
   - Load solution config
   - Add default bootstrap key
   - Define `custom_init()` for solution-specific setup
   - Implement standard workflow (8 steps)
   - Add cleanup handler
3. Preserve solution-specific features (CLI args, MCP server)
4. Make executable: `chmod +x setup.sh`
5. Test basic functionality

## Known Issues

### Port Conflicts

⚠️ **Warning**: Both `edu-agent` and `lego-playground` use frontend port **5282**. They cannot run simultaneously without a port conflict.

**Solutions:**
- Run them on different machines
- Change one solution's port in `solution.config`
- Use port forwarding/proxying

### CCAAS Backend Requirement

All solutions require CCAAS backend running on port 3001 before setup.

**Verify backend is running:**
```bash
curl -s http://localhost:3001/health
```

If not running:
```bash
cd packages/backend
npm run start:dev
```

## Related Documentation

- `tools/solution-lib.sh` - Shared library functions
- `tools/API_KEY_MANAGEMENT_FIX.md` - Modern API key system documentation
- Each solution's `CLAUDE.md` - Solution-specific documentation

## Rollback Instructions

If issues arise, the old setup.sh files can be restored from git history:

```bash
# For Phase 1 solutions (simple changes)
cd solutions/<solution-name>
git checkout HEAD~1 setup.sh

# For Phase 2 solutions (full migration)
cd solutions/<solution-name>
git checkout HEAD~1 setup.sh
rm solution.config  # Remove the new config file
```

Note: After rollback, you'll need to manually export `CCAAS_BOOTSTRAP_KEY` before running `./setup.sh`.

## Success Criteria

✅ All 6 solutions can run `./setup.sh` without manual key setup
✅ All solutions create tenants and API keys automatically
✅ All solutions inject skills and MCP servers
✅ Bootstrap key can be overridden when needed
✅ No breaking changes to existing functionality
✅ Improved error handling and logging

## Conclusion

The migration successfully unified all 6 internal solutions to use the modern API key workflow with a default bootstrap key, simplifying the developer experience while maintaining flexibility and security.
