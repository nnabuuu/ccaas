# Phase 3: Decompose SessionService - IN PROGRESS

## Summary

Successfully created three new services to extract CLI process management, workspace operations, and background task monitoring from SessionService. Services are complete and compile successfully.

**Status**: Services created ✅ | SessionService refactoring ⏳ | Testing ⏳

## Completed Work

### 1. Created WorkspaceService ✅

**File**: `packages/backend/src/sessions/services/workspace.service.ts` (350 lines)

**Responsibilities**:
- Session workspace file operations (read, tree traversal)
- Directory tree building with security validations
- Path sanitization & security (directory traversal prevention)
- MIME type detection (17 types supported)
- MCP server symlink creation and path resolution

**Methods**:
- `createMcpSymlinks(session)` - Create symlinks to tenant MCP servers
- `resolveSessionMcpPaths(mcpServers)` - Resolve tenant paths to session paths
- `getWorkspaceFile(session, sessionId, relativePath)` - Get file with security validation
- `getWorkspaceTree(session, sessionId)` - Get directory tree structure
- `sanitizeFilePath(filePath)` - Security: prevent directory traversal
- `buildDirectoryTree(basePath, relativePath)` - Recursive tree building (private)
- `detectMimeType(filename)` - MIME type detection (private)

**Extracted from SessionService** (~250 lines):
- `createMcpSymlinks()` + `createMcpSymlinksInternal()`
- `resolveSessionMcpPaths()`
- `getWorkspaceFile()`
- `getWorkspaceTree()`
- `sanitizeFilePath()`
- `buildDirectoryTree()`
- `detectMimeType()`

### 2. Created CliProcessService ✅

**File**: `packages/backend/src/sessions/services/cli-process.service.ts` (490 lines)

**Responsibilities**:
- Spawn AgentEngine processes with proper configuration
- Manage CLI stdin/stdout communication
- Handle process termination (SIGTERM/SIGKILL)
- Parse stream-json output via EventMapperService
- Support attachments and system prompts

**Methods**:
- `ensureCLIProcess(session, message, onEvent, attachments?, systemPrompt?)` - Spawn/reuse CLI
- `sendFollowUp(session, message, onEvent, attachments?)` - Send follow-up with --resume
- `cancelSession(session, onEvent?)` - Cancel with SIGTERM/SIGKILL
- `hasActiveProcess(session)` - Check if process is running
- `handleCLIOutput(session, chunk, onEvent)` - Parse stdout (private)
- `handleCLIClose(session, code, onEvent)` - Handle process close (private)
- `sendMessageToProcess(session, message, attachments?)` - Send to stdin (private)

**Extracted from SessionService** (~350 lines):
- `ensureCLIProcess()`
- `sendFollowUp()`
- `handleCLIOutput()`
- `handleCLIClose()`
- `sendMessageToProcess()`
- `cancelSession()` (partially - session lookup remains in SessionService)
- `hasActiveProcess()` (logic extracted, wrapper may remain)

### 3. Created BackgroundTaskMonitorService ✅

**File**: `packages/backend/src/sessions/services/background-task-monitor.service.ts` (210 lines)

**Responsibilities**:
- Monitor background task output files (3-second polling)
- Detect task completion/failure from output file content
- Enforce 30-minute timeout on background tasks
- Integrate with EventMapperService for task state management
- Emit completion events to WebSocket

**Methods**:
- `startBackgroundTaskMonitor(sessionId, tracker, getSession)` - Start 3s polling
- `stopMonitorByKey(monitorKey)` - Stop specific monitor
- `stopAllMonitorsForSession(sessionId)` - Stop all for session (cleanup)
- `stopAllMonitors()` - Stop all (shutdown)
- `checkBackgroundTaskStatus(...)` - Check output file (private)
- `stopBackgroundTaskMonitor(...)` - Stop and emit event (private)

**Extracted from SessionService** (~100 lines):
- `startBackgroundTaskMonitor()`
- `stopBackgroundTaskMonitor()`
- `checkBackgroundTaskStatus()`
- Background task timeout logic

### 4. Updated SessionsModule ✅

Registered new services in providers array:
- `CliProcessService`
- `WorkspaceService`
- `BackgroundTaskMonitorService`

## Remaining Work

### Update SessionService to Use New Services

**Current**: 1,485 lines
**Target**: ~400 lines
**Estimated reduction**: ~1,085 lines (73%)

#### Required Changes:

**1. Update Constructor** ⏳
```typescript
constructor(
  private readonly configService: ConfigService,
  private readonly eventMapperService: EventMapperService,
  private readonly cliProcessService: CliProcessService,  // NEW
  private readonly workspaceService: WorkspaceService,    // NEW
  private readonly backgroundTaskMonitorService: BackgroundTaskMonitorService,  // NEW
) {
  // ...

  // Update callback registration
  this.eventMapperService.registerBackgroundTaskCallback((sessionId, tracker) => {
    this.backgroundTaskMonitorService.startBackgroundTaskMonitor(
      sessionId,
      tracker,
      (sid) => this.getSession(sid),
    );
  });
}
```

**2. Update Method Delegations** ⏳

Methods to update (delegate to services):

```typescript
// Delegate to CliProcessService
async ensureCLIProcess(...) {
  return this.cliProcessService.ensureCLIProcess(session, message, onEvent, attachments, appendSystemPrompt);
}

async sendFollowUp(...) {
  return this.cliProcessService.sendFollowUp(session, message, onEvent, attachments);
}

cancelSession(sessionId, onEvent?) {
  const session = this.sessions.get(sessionId);
  if (!session) return false;
  return this.cliProcessService.cancelSession(session, onEvent);
}

hasActiveProcess(sessionId) {
  const session = this.sessions.get(sessionId);
  if (!session) return false;
  return this.cliProcessService.hasActiveProcess(session);
}

// Delegate to WorkspaceService
async createMcpSymlinks(session) {
  return this.workspaceService.createMcpSymlinks(session);
}

async getWorkspaceFile(sessionId, relativePath) {
  const session = this.getSession(sessionId);
  return this.workspaceService.getWorkspaceFile(session, sessionId, relativePath);
}

async getWorkspaceTree(sessionId) {
  const session = this.getSession(sessionId);
  return this.workspaceService.getWorkspaceTree(session, sessionId);
}

// Background task monitoring - already using service via callback
// No changes needed beyond constructor update
```

**3. Remove Old Private Methods** ⏳

Delete these private methods (now in services):
- `handleCLIOutput()` ❌
- `handleCLIClose()` ❌
- `sendMessageToProcess()` ❌
- `resolveSessionMcpPaths()` ❌
- `createMcpSymlinksInternal()` ❌
- `sanitizeFilePath()` ❌
- `buildDirectoryTree()` ❌
- `detectMimeType()` ❌
- `startBackgroundTaskMonitor()` ❌
- `stopBackgroundTaskMonitor()` ❌
- `checkBackgroundTaskStatus()` ❌

**4. Remove Old State** ⏳

Delete:
- `backgroundTaskMonitors` map (now in BackgroundTaskMonitorService)
- `claudeCliPath` field (now in CliProcessService)

**5. Update shutdown()** ⏳

```typescript
shutdown(): void {
  this.logger.log('Shutting down...');

  if (this.cleanupInterval) {
    clearInterval(this.cleanupInterval);
    this.cleanupInterval = null;
  }

  // Stop all background task monitors
  this.backgroundTaskMonitorService.stopAllMonitors();

  // Terminate all sessions
  for (const [sessionId, session] of this.sessions.entries()) {
    if (session.cliProcess && !session.cliProcess.killed) {
      this.cliProcessService.cancelSession(session);
    }
  }

  this.sessions.clear();
  this.clientSessions.clear();
}
```

## Projected Final State

### SessionService (after refactoring)

**Remaining responsibilities** (~400 lines):
- Session state storage (in-memory map)
- Session lifecycle (get/create/close/reconnect)
- Session queries (getStats, getAllSessions, getByTenant)
- Restart logic (markSessionsForRestart, restartSession)
- Skill tracking (trackSyncedSkills, getAffectedSessions)
- Cleanup timer management

**Core methods to keep**:
- `getOrCreateSession()` - Create session workspace + state
- `getSession()` - Lookup session
- `getClientSessions()` - Get sessions for client
- `getSessionByClientId()` - Get most recent session
- `closeSession()` - Close and cleanup
- `reconnectSession()` - Reconnect client to session
- `getStats()` - Session statistics
- `getAllSessions()` - List all sessions
- `terminateSession()` - Force terminate
- `getSessionStatus()` - Get session details
- `getSessionDetails()` - REST API details
- `canRestartSession()` - Check restart eligibility
- `getSessionsByTenant()` - Query by tenant
- `markSessionsForRestart()` - Mark for restart (skill changes)
- `trackSyncedSkills()` - Track skill usage
- `getAffectedSessions()` - Find sessions using skill
- `restartSession()` - Restart session process
- `startCleanupTimer()` - Start TTL cleanup
- `cleanupIdleSessions()` - Cleanup old sessions
- `cleanupOldestIdleSession()` - Evict oldest
- `shutdown()` - Graceful shutdown

## Verification Steps

### TypeScript Compilation ✅
```bash
npm run typecheck
# PASS - 0 errors
```

### Build ⏳
```bash
npm run build
# Pending SessionService refactoring completion
```

### Tests ⏳
```bash
npm test
# Pending SessionService refactoring completion
```

## Benefits Achieved (Services Created)

### Code Organization
- ✅ **Clear separation of concerns** - CLI, workspace, monitoring isolated
- ✅ **Single Responsibility** - Each service has one focused purpose
- ✅ **Testability** - Services independently testable

### Reusability
- ✅ **CliProcessService** - Reusable for scheduled tasks, background jobs
- ✅ **WorkspaceService** - Reusable for file operations across modules
- ✅ **BackgroundTaskMonitorService** - Reusable task monitoring pattern

### Maintainability
- ✅ **Smaller files** - 350/490/210 lines vs 1,485-line monolith
- ✅ **Focused testing** - Test one concern at a time
- ✅ **Easier onboarding** - Developers can understand one service at a time

## Combined Progress (Phases 1 + 2 + 3)

| Component | Original | After Phase 3 | Total Reduction |
|-----------|----------|---------------|-----------------|
| SessionsController | 729 | 437 | -292 (-40%) |
| SessionsGateway | 649 | 495 | -154 (-24%) |
| SessionService | 1,485 | ~400 (projected) | ~-1,085 (~-73%) |
| **Total** | **2,863** | **~1,332** | **~-1,531 (~-53%)** |

**New services created** (Phases 1-3):
- CompletionOrchestrationService: 326 lines
- SkillManagementService: 183 lines
- AttachmentService: 136 lines
- CliProcessService: 490 lines
- WorkspaceService: 350 lines
- BackgroundTaskMonitorService: 210 lines
- **Total**: 1,695 lines (shared, reusable, testable)

## Next Steps

### Complete Phase 3

1. **Update SessionService constructor** - Inject new services
2. **Update method delegations** - Delegate to services
3. **Remove old private methods** - Delete extracted code
4. **Remove old state** - Clean up fields
5. **Update shutdown()** - Use services
6. **Verify build** - `npm run build`
7. **Run tests** - `npm test`
8. **Manual testing** - Verify WebSocket and REST paths

### Then Continue to Phase 4

**Phase 4: Decompose EventMapperService** (1,519 → ~600 lines)
- Create `ToolCallTrackerService`
- Create `SubAgentTrackerService`
- Create `ToolAnalysisService`
- Refactor `mapToFrontendEvents()` into type-specific handlers

## Files Modified

### Created:
- `packages/backend/src/sessions/services/cli-process.service.ts` (490 lines)
- `packages/backend/src/sessions/services/workspace.service.ts` (350 lines)
- `packages/backend/src/sessions/services/background-task-monitor.service.ts` (210 lines)

### Updated:
- `packages/backend/src/sessions/sessions.module.ts` (registered new services)

### Pending:
- `packages/backend/src/sessions/session.service.ts` (needs refactoring to use services)

## Conclusion

Phase 3 has successfully created three well-organized services that extract ~700 lines of complex logic from SessionService. The services compile successfully and are ready for integration. The remaining work is straightforward delegation and cleanup in SessionService.

**Status**: 75% complete
**Estimated time to complete**: 1-2 hours (SessionService refactoring + testing)
**Blockers**: None
**Risk**: Low (mechanical delegation, no behavioral changes expected)
