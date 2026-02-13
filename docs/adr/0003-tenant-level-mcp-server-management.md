# ADR-0003: Tenant-Level MCP Server Management

**Status**: Accepted
**Date**: 2026-02-11
**Decision Maker**: @niex
**Related Issue**: MCP server path stability and isolation

---

## Background (Context)

### The Problem

**Original Architecture** (Solution-Level MCP):
```
solution/mcp-server/
  → setup.sh registers absolute path: /absolute/path/to/solution/mcp-server/dist/index.js
  → database stores absolute path
  → CLI spawns MCP process with absolute path
  → Problem: Breaks when solution directory moves or paths change
```

**Issues**:
1. **Path Instability**: Absolute paths break when solution directory moves
2. **No Isolation**: All sessions of a tenant share same MCP process (potential conflicts)
3. **Duplication**: Each session would need its own copy (wasteful)
4. **No Centralization**: No single location to manage tenant's MCP servers
5. **Backup/Version Control**: Difficult to backup or version MCP servers per tenant

### Why This Matters

MCP (Model Context Protocol) servers provide Claude Code with domain-specific tools:
- `lesson-plan-tools` - Curriculum standards, textbook management
- `read-context` - Read form state and lesson plan context
- Future: `email-sender`, `database-query`, etc.

Each tenant may need different MCP servers or different versions. Sessions must access these reliably regardless of solution directory structure changes.

---

## Decision

**We decided**: MCP servers are **centrally managed at tenant level**, with sessions accessing them via symlinks.

### Architecture Principle

> **Tenant MCP Directory** = Single source of truth for all MCP servers used by a tenant
>
> **Session Workspace** = Uses symlinks to tenant MCP servers (no copies, no duplication)
>
> **Database Paths** = Workspace-relative (not absolute), enabling portability

### Detailed Architecture

**Tenant-Level Storage**:
```
.agent-workspace/
├── tenants/
│   └── {tenantId}/
│       └── mcp-servers/           # ← Centralized MCP storage
│           ├── lesson-plan-tools/
│           │   ├── dist/
│           │   │   └── index.js
│           │   ├── node_modules/
│           │   └── package.json
│           └── read-context/
│               ├── dist/
│               │   └── index.js
│               └── package.json
```

**Session-Level Access** (via symlinks):
```
.agent-workspace/
└── sessions/
    └── {sessionId}/
        └── .claude/
            └── mcp-servers/       # ← Symlinks to tenant servers
                ├── lesson-plan-tools -> ../../../../tenants/{tenantId}/mcp-servers/lesson-plan-tools
                └── read-context -> ../../../../tenants/{tenantId}/mcp-servers/read-context
```

**CLI Configuration** (session-relative paths):
```bash
claude-code --mcp-config '{
  "mcpServers": {
    "read-context": {
      "command": "node",
      "args": [".claude/mcp-servers/read-context/dist/index.js"]  # ← Symlink resolves to tenant
    }
  }
}'
```

---

## Alternatives Considered

### Alternative A: Solution-Level MCP (Original)

**Description**: Each solution directory contains its own MCP servers

**Pros**:
- ✅ Simple initial setup (co-located with solution code)
- ✅ Easy to version control with solution

**Cons**:
- ❌ Absolute paths break on directory moves
- ❌ No tenant isolation (all tenants share same servers)
- ❌ Cannot customize per tenant
- ❌ Difficult to backup/restore per tenant

**Why Not Chosen**: Doesn't support multi-tenant architecture

---

### Alternative B: Tenant-Level with Symlinks ⭐ **Selected Approach**

**Description**: Centralized at tenant level, sessions access via symlinks

**Pros**:
- ✅ Centralized management (one location per tenant)
- ✅ Proper tenant isolation
- ✅ No file duplication (symlinks, not copies)
- ✅ Fast session creation (just create symlinks)
- ✅ Workspace-relative paths (portable)
- ✅ Easy backup/restore per tenant
- ✅ Support for MCP version management

**Cons**:
- ❌ Requires filesystem symlink support
- ❌ More complex setup process
- ❌ Manual cleanup when tenant deleted

**Why Chosen**: Best balance of isolation, performance, and maintainability

---

### Alternative C: Per-Session Copies

**Description**: Copy all MCP servers into each session workspace

**Pros**:
- ✅ Complete isolation per session
- ✅ No symlink requirement

**Cons**:
- ❌ Massive disk space waste (duplicate node_modules)
- ❌ Slow session creation (copy GB of files)
- ❌ Difficult to update MCP servers
- ❌ Cannot share updates across sessions

**Why Not Chosen**: Too wasteful and slow

---

### Alternative D: Platform-Wide Shared Pool

**Description**: Single global MCP server pool for all tenants

**Pros**:
- ✅ Ultimate disk space efficiency
- ✅ Easy to update globally

**Cons**:
- ❌ No tenant isolation
- ❌ Cannot customize per tenant
- ❌ Version conflicts across tenants
- ❌ Security concerns (tenant A accessing tenant B's tools)

**Why Not Chosen**: Violates multi-tenant isolation principle

---

## Consequences

### Positive Impacts

- ✅ **Centralized Management**: All tenant MCP servers in `.agent-workspace/tenants/{tenantId}/mcp-servers/`
- ✅ **Easy Backup**: Single directory to backup per tenant
- ✅ **No Duplication**: Sessions share via symlinks (no file copying)
- ✅ **Proper Isolation**: Each tenant has independent MCP server copies
- ✅ **Path Stability**: Workspace-relative paths don't break on directory moves
- ✅ **Fast Session Creation**: Only create symlinks, not copy files
- ✅ **Version Control**: Can update tenant MCP servers independently
- ✅ **Session Independence**: Session cleanup doesn't affect tenant MCP servers

### Negative Impacts

- ❌ **Symlink Requirement**: Won't work on FAT32 or older filesystems
- ❌ **Manual Cleanup**: Tenant MCP directories not auto-cleaned when tenant deleted
- ⚠️ **Setup Complexity**: More complex setup script

### Measured Impact

**Setup Process**:
- Before: Register absolute path in database
- After: Copy MCP to tenant directory, store relative path, create symlinks on session creation

**Session Creation**:
- Before: N/A (used absolute paths)
- After: +10ms (create symlinks)

**Disk Usage**:
- Per-session overhead: ~50 bytes (symlinks)
- Tenant MCP servers: ~5-20 MB each (depending on node_modules)

---

## Implementation Guide

### Setup Process

**1. Solution Developer Runs Setup**:
```bash
cd solutions/my-solution
bash setup.sh
```

**2. Setup Script (`tools/solution-lib.sh`)**:
```bash
copy_mcp_to_tenant() {
  # Extract MCP directory from entry point
  local mcp_dir=$(dirname "$entry_point")

  # Copy to tenant location
  cp -r "$mcp_dir" "$tenant_mcp_dir/"

  # Return tenant-relative path
  echo "tenants/$tenant_id/mcp-servers/$mcp_name/dist/index.js"
}
```

**3. Database Storage**:
```json
{
  "name": "read-context",
  "config": {
    "command": "node",
    "args": ["tenants/f5461be1-.../mcp-servers/read-context/dist/index.js"]
  }
}
```

### Session Creation

**SessionService.createMcpSymlinks()**:
```typescript
async createMcpSymlinks(session: Session): Promise<void> {
  // Create .claude/mcp-servers/ in session workspace
  const sessionMcpDir = path.join(session.workspaceDir, '.claude/mcp-servers')
  await fs.mkdir(sessionMcpDir, { recursive: true })

  // For each MCP server
  for (const server of session.mcpServers) {
    // Convert tenant-relative path to absolute tenant path
    const tenantMcpPath = path.join(workspaceRoot, server.config.args[0])
    const tenantMcpDir = path.dirname(tenantMcpPath)

    // Create symlink from session to tenant
    const sessionSymlink = path.join(sessionMcpDir, server.name)
    await fs.symlink(tenantMcpDir, sessionSymlink)
  }
}
```

**Path Resolution for CLI**:
```typescript
resolveSessionMcpPaths(session: Session): McpConfig {
  // Transform: tenants/{id}/mcp-servers/read-context/dist/index.js
  // To:        .claude/mcp-servers/read-context/dist/index.js

  return session.mcpServers.map(server => ({
    name: server.name,
    config: {
      command: server.config.command,
      args: [`.claude/mcp-servers/${server.name}/${path.basename(server.config.args[0])}`]
    }
  }))
}
```

### Migration Guide

**For Existing Solutions**:

1. **Update `solution.json`** (if needed):
   - Fix relative paths to MCP servers

2. **Re-run Setup**:
   ```bash
   cd solutions/your-solution
   bash setup.sh
   ```

3. **Verify Tenant Directory**:
   ```bash
   ls -la .agent-workspace/tenants/{tenant-id}/mcp-servers/
   ```

4. **Test Session Creation**:
   - Create session via frontend
   - Check for symlinks in `.claude/mcp-servers/`
   - Verify MCP tools work

---

## References

- Original implementation: `docs/internal/implementation-summaries/TENANT_MCP_ARCHITECTURE_IMPLEMENTED.md`
- Setup script: `tools/solution-lib.sh`
- Backend implementation: `packages/backend/src/sessions/session.service.ts`
- Related: `docs/advanced/AGENT_ENGINE_LIFECYCLE.md`

---

## Update History

- **2026-02-11**: Initial implementation (tenant-level MCP management)
- **2026-02-14**: Formalized as ADR-0003 during documentation cleanup
