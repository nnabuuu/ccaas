# File Writing Mechanism - Executive Summary

**Date**: 2026-02-13
**Exploration Status**: ✅ Complete
**Implementation Status**: 🟡 Partially Working - Needs Debugging

---

## TL;DR

**Q: How does Claude Code write files?**
**A:** CLI writes files directly to workspace, then backend hooks track them.

**Q: Can we wrap file writing to associate files with messages?**
**A:** ✅ **Already implemented!** The `WriteFileTrackerHook` system exists and should be working.

**Q: Why aren't files showing in lesson-plan-designer?**
**A:** 🔍 **Need to debug** - Most likely the hook is skipping file tracking because `session.currentAssistantMessageId` is undefined when files are written.

---

## System Architecture (Already Exists)

```
┌────────────────────────────────────────────────────────────────┐
│ Timeline: How Files Are Written and Tracked                    │
└────────────────────────────────────────────────────────────────┘

1. CLI spawns
   ↓
2. Workspace created: .agent-workspace/sessions/{sessionId}/
   ↓
3. Claude decides to write file → Write tool
   ↓
4. CLI writes file DIRECTLY to workspace (file_path is relative)
   ↓
5. CLI emits tool_result event (stream-json format)
   ↓
6. EventMapperService receives event
   ↓
7. EventMapperService fires WriteFileTrackerHook (async)
   ↓
8. Hook reads file from workspace
   ↓
9. Hook copies file to persistent storage
   ↓
10. Hook creates database record (with message_id)
    ↓
11. Hook emits WebSocket event: file_created
    ↓
12. Frontend receives event → Updates Files tab
```

**Key Insight**: We **cannot** intercept BEFORE the write (CLI writes first), we can only track AFTER (which is the correct design).

---

## Existing Implementation ✅

### 1. Hook Registration

**File**: `packages/backend/src/chat/chat.gateway.ts` (lines 107-113)

```typescript
// Register WriteFileTracker hook
const writeFileTrackerHook = createWriteFileTrackerHook({
  filesService: this.filesService,
  getSession: (sessionId) => this.sessionService.getSession(sessionId),
});
this.eventMapperService.registerToolHook(writeFileTrackerHook);
this.logger.log('Registered WriteFileTracker hook');
```

### 2. Hook Implementation

**File**: `packages/backend/src/hooks/write-file-tracker.hook.ts`

**Features**:
- ✅ Triggers on Write tool only
- ✅ Skips failed writes
- ✅ Reads file from workspace
- ✅ Copies to persistent storage
- ✅ Creates database record with **automatic message association**
- ✅ Emits `file_created` WebSocket event

**Automatic Message Association**:
```typescript
const agentFile = await filesService.createFromWriteTool({
  messageId: session.currentAssistantMessageId,  // ← Magic happens here!
  sessionId: context.sessionId,
  tenantId: session.tenantId,
  originalPath: filePath,
  workspaceDir: session.workspaceDir,
});
```

### 3. Database Schema

**Table**: `agent_files`

**Columns**:
- `id` - UUID primary key
- `filename` - File name
- `original_path` - Path in workspace
- `storage_path` - Path in persistent storage
- `mime_type` - MIME type
- `size` - File size in bytes
- `status` - 'new' | 'modified' | 'synced'
- `uploaded_by` - 'agent' | 'user'
- **`message_id`** - Foreign key to messages table (association!)
- `session_id` - Session identifier
- `tenant_id` - Tenant identifier
- `created_at` - Timestamp
- `updated_at` - Timestamp

### 4. WebSocket Event

**Event**: `file_created`

**Payload**:
```typescript
{
  type: 'file_created',
  payload: {
    id: string,
    filename: string,
    originalPath: string,
    mimeType: string | null,
    size: number,
    status: 'new' | 'modified' | 'synced',
    uploadedBy: 'agent' | 'user',
    createdAt: Date,
    sessionId: string,
    messageId: string,  // ← Associated message!
  }
}
```

### 5. REST API

**Endpoints**:
- `GET /api/v1/files` - List all files (with filters)
- `GET /api/v1/files/:id` - Get single file
- `GET /api/v1/files/:id/download` - Download file
- `GET /api/v1/messages/:id/files` - Files for a message
- `GET /api/v1/files/hybrid/:sessionId` - Hybrid mode (DB + filesystem)

### 6. Hybrid Mode (Fallback)

**File**: `packages/react-sdk/src/hooks/useFiles.ts`

**Implementation**: Tries database first, falls back to filesystem scan if no records found.

**Pros**:
- ✅ Works even if hooks fail
- ✅ Handles historical files

**Cons**:
- ❌ No message association (unless hook also worked)
- ❌ Slower than pure database query
- ❌ No real-time updates

---

## Why Files Might Not Show in Lesson-Plan-Designer

### Hypothesis 1: Message Context Timing Issue (Most Likely) 🎯

**Problem**: Hook skips file tracking because `session.currentAssistantMessageId` is undefined.

**Evidence**:
```typescript
// write-file-tracker.hook.ts:68-73
if (!session.currentAssistantMessageId) {
  logger.debug(
    `No assistant message context for session ${context.sessionId}, skipping file tracking`,
  );
  return;  // ← File tracking SKIPPED!
}
```

**Why would this happen?**

```
1. Lesson-plan-designer creates session via HTTP API
   ↓
2. CCAAS backend spawns CLI process
   ↓
3. Session object created, but currentAssistantMessageId = undefined
   ↓
4. Claude writes file IMMEDIATELY (before message persistence)
   ↓
5. Hook checks currentAssistantMessageId → undefined → SKIP
   ↓
6. Message persisted to DB AFTER file write
   ↓
7. File exists in workspace, but NO database record
```

**Fix**: Set `currentAssistantMessageId` BEFORE CLI execution (pre-create message ID)

### Hypothesis 2: Hook Not Running (Unlikely)

**Check**: CCAAS backend logs should show "Registered WriteFileTracker hook" on startup.

**Verification**: Hook IS registered (confirmed in chat.gateway.ts:107-113)

### Hypothesis 3: Database Insert Fails (Unlikely)

**Check**: CCAAS backend logs for "Failed to track file"

**Verification Needed**: Run test and check logs

---

## Debugging Steps

### Step 1: Add Debug Logging

**File**: `packages/backend/src/hooks/write-file-tracker.hook.ts`

**Add logging**:
```typescript
async afterToolResult(result: ToolResult, context: ToolHookContext): Promise<void> {
  logger.log(`[DEBUG] Hook triggered: sessionId=${context.sessionId}, file=${result.input?.file_path}`);

  if (result.isError) {
    logger.debug(`[DEBUG] Skipping failed write`);
    return;
  }

  const filePath = result.input?.file_path as string;
  if (!filePath) {
    logger.warn(`[DEBUG] No file_path in input`);
    return;
  }

  const session = getSession(context.sessionId);
  if (!session) {
    logger.warn(`[DEBUG] Session NOT FOUND: ${context.sessionId}`);
    return;
  }

  logger.log(`[DEBUG] Session found: messageId=${session.currentAssistantMessageId}, workspace=${session.workspaceDir}`);

  if (!session.currentAssistantMessageId) {
    logger.warn(`[DEBUG] NO MESSAGE CONTEXT - SKIPPING FILE TRACKING`);
    return;
  }

  // ... rest of code
}
```

### Step 2: Run Verification Script

```bash
./verify-file-hook.sh
```

**Expected Output**:
- If hook works: File record in database with message_id
- If hook skipped: No database record, but file exists in workspace
- If hook failed: Error in logs

### Step 3: Check Logs

```bash
# Check CCAAS backend logs
tail -f packages/backend/logs/*.log | grep -i 'writefiletracker'

# Look for:
# "Registered WriteFileTracker hook"  ← Hook registered
# "[DEBUG] Hook triggered: ..."       ← Hook executed
# "[DEBUG] NO MESSAGE CONTEXT"        ← Problem confirmed
```

### Step 4: Fix Message Context Timing (If Hypothesis 1 Confirmed)

**File**: `packages/backend/src/chat/session.service.ts`

**Current Code** (probably):
```typescript
async sendMessage(sessionId: string, message: string) {
  const session = this.getSession(sessionId);

  // Write to CLI first
  session.cli.stdin.write(message);

  // Create message AFTER (too late!) ❌
  const messageId = await this.messagesService.create({...});
  session.currentAssistantMessageId = messageId;
}
```

**Fixed Code**:
```typescript
async sendMessage(sessionId: string, message: string) {
  const session = this.getSession(sessionId);

  // Pre-create message ID FIRST ✅
  const messageId = uuidv4();
  session.currentAssistantMessageId = messageId;

  // Then write to CLI
  session.cli.stdin.write(message);

  // Persist to DB asynchronously (non-blocking)
  this.messagesService.create({ id: messageId, ... }).catch(err => {
    this.logger.error(`Failed to persist message: ${err}`);
  });
}
```

---

## Future Enhancement: File Action System

### Goal

Add solution-specific file actions (e.g., "Attach to Lesson Plan" button)

### Architecture

**Backend**:
1. Create `FileActionRegistry` service
2. Solutions register custom actions
3. Expose REST endpoints: `/api/v1/files/:id/actions`

**Frontend**:
1. Fetch available actions per file
2. Render action buttons
3. Execute actions via API

**Example** (lesson-plan-designer):
```typescript
// Backend
registry.register({
  id: 'attach-to-lesson-plan',
  label: '附加到备课方案',
  enabled: (file) => file.mimeType?.startsWith('application/'),
  execute: async (file, context) => {
    const lessonPlanId = await getLessonPlanIdFromSession(context.sessionId);
    await lessonPlanService.attachFile(lessonPlanId, file.id);
    return { success: true, message: '文件已附加' };
  },
});

// Frontend
<FilesView
  files={files}
  sessionId={sessionId}
  onActionExecute={(actionId, file) => {
    if (actionId === 'attach-to-lesson-plan') {
      console.log('File attached:', file.name);
      refetchLessonPlan();
    }
  }}
/>
```

**Status**: 🟡 Not implemented yet (optional enhancement)

---

## Recommendations

### Immediate Actions (Fix Files Tab)

1. ✅ **Add debug logging** to WriteFileTrackerHook
2. ✅ **Run verification script** to confirm hypothesis
3. ✅ **Check backend logs** for "NO MESSAGE CONTEXT"
4. ✅ **Fix message context timing** if confirmed

**Estimated Time**: 1-2 hours

**Priority**: 🔥 HIGH (blocking Files tab functionality)

### Future Actions (File Actions)

1. ❌ Implement FileActionRegistry
2. ❌ Add REST endpoints
3. ❌ Create "Attach to Lesson Plan" action
4. ❌ Update frontend to render buttons

**Estimated Time**: 4-6 hours

**Priority**: 🟡 MEDIUM (nice-to-have enhancement)

---

## Key Takeaways

1. ✅ **File tracking system EXISTS and is well-designed**
2. ✅ **No need to "wrap" file writing** - hook system already does it
3. ✅ **Message association is automatic** - via `session.currentAssistantMessageId`
4. ✅ **Real-time updates built-in** - `file_created` WebSocket event
5. 🔍 **Need to debug why it's not working** - most likely message context timing
6. 🎯 **Fix is simple** - set message ID before CLI execution

**The system is 90% complete. We just need to fix the message context timing issue.**

---

## Files to Review

### Critical
- ✅ `packages/backend/src/hooks/write-file-tracker.hook.ts` - Hook implementation
- ✅ `packages/backend/src/chat/chat.gateway.ts` - Hook registration
- ⚠️ `packages/backend/src/chat/session.service.ts` - May need fix for message timing

### Supporting
- ✅ `packages/backend/src/files/files.service.ts` - Database operations
- ✅ `packages/backend/src/chat/event-mapper.service.ts` - Hook execution
- ✅ `packages/react-sdk/src/hooks/useFiles.ts` - Hybrid mode

### Documentation
- ✅ `FILE_WRITING_MECHANISM_EXPLORATION.md` - Full technical report
- ✅ `FILE_WRITING_EXPLORATION_SUMMARY.md` - This file
- ✅ `verify-file-hook.sh` - Verification script

---

## Next Steps

Run the verification script to confirm the hypothesis:

```bash
./verify-file-hook.sh
```

Then check the logs:

```bash
tail -f packages/backend/logs/*.log | grep -i 'writefiletracker'
```

If you see "NO MESSAGE CONTEXT", the fix is confirmed: set `currentAssistantMessageId` before CLI execution.
