# Security Issues

## CRITICAL: Shell Command Injection in CLI Process Service

**File**: `packages/backend/src/sessions/services/cli-process.service.ts:84-86`
**Status**: 🔴 **UNRESOLVED**
**Severity**: CRITICAL
**Added**: 2026-02-14

### Vulnerability

The `appendSystemPrompt` parameter flows from user-controlled input into a shell command via string concatenation. The current escaping only handles single quotes but does NOT prevent injection via backticks, `$()`, or other shell metacharacters.

### Attack Vector

```json
{
  "appendSystemPrompt": "innocent text$(whoami > /tmp/pwned)"
}
```

This would execute arbitrary commands when the CLI process spawns.

### Current Code

```typescript
// cli-process.service.ts:84-86
const escapedPrompt = appendSystemPrompt.replace(/'/g, "'\\''");
shellCommand += ` --append-system-prompt '${escapedPrompt}'`;
```

### Recommended Fix

**Option A: Use spawn with argument array (PREFERRED)**
```typescript
const args = [
  '--output-format', 'stream-json',
  '--input-format', 'stream-json',
  '--verbose',
  '--permission-mode', 'bypassPermissions',
];
if (appendSystemPrompt?.trim()) {
  args.push('--append-system-prompt', appendSystemPrompt);
}
const cli = spawn(this.claudeCliPath, args, { cwd: session.workspaceDir });
```

**Option B: Pass via environment variable**
```typescript
const env = { ...process.env, CCAAS_SYSTEM_PROMPT: appendSystemPrompt };
shellCommand += ' --append-system-prompt "$CCAAS_SYSTEM_PROMPT"';
```

### Impact

- **Pre-Phase 1**: Limited risk (systemPrompt only from internal skill routing)
- **Post-Phase 1**: **ELEVATED RISK** - `appendSystemPrompt` becomes user-facing via templates

### Action Required

Fix BEFORE merging Phase 2 (Core Backend DTO extension). This issue MUST be resolved before `appendSystemPrompt` becomes fully functional.

### Workaround (Temporary)

Phase 1 implementation has been modified to NOT send `appendSystemPrompt` to backend (see CRITICAL-2 fix). This temporarily mitigates the risk until proper fix is implemented.
