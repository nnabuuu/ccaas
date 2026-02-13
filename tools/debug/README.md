# Debug Scripts

Diagnostic scripts for troubleshooting issues.

## Scripts

### file-hook.sh
Debug WriteFileTrackerHook execution and file tracking behavior.

**Purpose**: Diagnoses issues with file tracking, hook execution, and file registration in the database.

**Type**: Diagnostic/debugging script

**Referenced in**: `docs/implementation/FILE_HOOK_DEBUG_CHECKLIST.md`

**Usage**:
```bash
./tools/debug/file-hook.sh
```

**What it tests**:
- WriteFileTrackerHook is properly registered
- Hook executes when files are created/modified
- Files are correctly registered in the database
- File metadata is accurate

## When to Use

Use these scripts when:
- File tracking is not working as expected
- Files created by agent are not appearing in the Files tab
- Debugging hook execution flow
- Investigating file registration issues

## See Also

- `docs/implementation/FILE_HOOK_DEBUG_CHECKLIST.md` - Comprehensive debugging checklist
- `packages/backend/src/hooks/write-file-tracker.hook.ts` - Hook implementation
