# Deprecated Scripts Archive

Historical scripts that have been replaced or are no longer used.

These scripts are kept for historical reference only and should **not** be used in development.

## Scripts

### create-bootstrap-key.sh
**Status**: Deprecated (2026-02-10)

**Reason**: Replaced by `tools/solution-lib.sh::create_bootstrap_key()` function.

**Original Purpose**: Create initial bootstrap API key for solution setup.

**Replacement**:
```bash
source tools/solution-lib.sh
create_bootstrap_key
```

**Backup Location**: Also exists in `solutions/lesson-plan-designer/.migration-backup/`

---

### test-subagent-polling.sh
**Status**: Obsolete (2026-02-03)

**Reason**: Tests HTTP polling approach that was replaced by WebSocket events.

**Original Purpose**: Test REST API endpoints for polling subagent status.

**Architecture Change**:
- Original: HTTP polling for subagent status updates
- Current: WebSocket-based real-time subagent event tracking via `useAgentStatus` hook

**Note**: The endpoint still exists for backward compatibility but is not the recommended usage pattern.

---

## Why Keep These?

1. **Historical Context**: Understanding why certain approaches were abandoned
2. **Architecture Evolution**: Documenting system evolution (polling → WebSocket)
3. **Migration Reference**: Helpful when similar migrations occur in the future
4. **Knowledge Preservation**: Avoiding repeating past mistakes

## When to Add Scripts Here

A script should be moved to deprecated/ when:
- Replaced by a better implementation
- Made obsolete by architectural changes
- No longer compatible with current codebase
- Kept only for historical reference

## Cleanup Policy

Scripts older than 1 year may be removed if:
- No longer referenced in any documentation
- Implementation details no longer relevant
- Team consensus that historical value is minimal
