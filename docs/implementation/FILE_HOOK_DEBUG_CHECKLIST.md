# WriteFileTrackerHook Debug Checklist

**Purpose**: Step-by-step guide to debug and fix file tracking in lesson-plan-designer

**Expected Result**: Files written by Claude Code appear in Files tab with message association

---

## Pre-Flight Check

- [ ] CCAAS backend is running: `cd packages/backend && npm run start:dev`
- [ ] Database exists: `ls -la packages/backend/.agent-workspace/data.db`
- [ ] Logs directory exists: `ls -la packages/backend/logs/`

---

## Phase 1: Verify Hook Registration ✅

**Goal**: Confirm WriteFileTrackerHook is registered on backend startup

### Steps

1. **Start CCAAS backend**:
   ```bash
   cd packages/backend
   npm run start:dev
   ```

2. **Check startup logs**:
   ```bash
   grep -i "registered writefiletracker" packages/backend/logs/*.log
   ```

   **Expected Output**:
   ```
   [ChatGateway] Registered WriteFileTracker hook
   ```

3. **Verify hook file exists**:
   ```bash
   ls -la packages/backend/src/hooks/write-file-tracker.hook.ts
   ```

### ✅ Success Criteria

- Log shows "Registered WriteFileTracker hook"
- Hook file exists and is not corrupted

### ❌ Failure Actions

If hook NOT registered:
1. Check `packages/backend/src/chat/chat.gateway.ts:107-113`
2. Verify `createWriteFileTrackerHook` is imported and called
3. Restart backend

---

## Phase 2: Add Debug Logging

**Goal**: Add detailed logging to track hook execution flow

### Steps

1. **Edit hook file**:
   ```bash
   code packages/backend/src/hooks/write-file-tracker.hook.ts
   ```

2. **Add debug logs** (line 46, inside `afterToolResult`):

   ```typescript
   async afterToolResult(result: ToolResult, context: ToolHookContext): Promise<void> {
     // ADD THIS:
     logger.log(`🔍 [WriteFileTracker] Hook triggered`);
     logger.log(`   Session: ${context.sessionId}`);
     logger.log(`   Tool Use ID: ${context.toolUseId}`);
     logger.log(`   File Path: ${result.input?.file_path}`);
     logger.log(`   Is Error: ${result.isError}`);

     if (result.isError) {
       logger.debug(`❌ [WriteFileTracker] Skipping failed write`);
       return;
     }

     const filePath = result.input?.file_path as string;
     if (!filePath) {
       logger.warn(`❌ [WriteFileTracker] No file_path in input`);
       return;
     }

     const session = getSession(context.sessionId);
     if (!session) {
       logger.warn(`❌ [WriteFileTracker] Session NOT FOUND: ${context.sessionId}`);
       return;
     }

     // ADD THIS:
     logger.log(`✅ [WriteFileTracker] Session found`);
     logger.log(`   Current Message ID: ${session.currentAssistantMessageId || 'UNDEFINED'}`);
     logger.log(`   Workspace Dir: ${session.workspaceDir}`);
     logger.log(`   Tenant ID: ${session.tenantId}`);

     if (!session.currentAssistantMessageId) {
       logger.warn(`❌ [WriteFileTracker] NO MESSAGE CONTEXT - SKIPPING FILE TRACKING`);
       logger.warn(`   This is the root cause! Session has no currentAssistantMessageId.`);
       return;
     }

     try {
       logger.log(`📝 [WriteFileTracker] Creating file record...`);
       const agentFile = await filesService.createFromWriteTool({
         messageId: session.currentAssistantMessageId,
         sessionId: context.sessionId,
         tenantId: session.tenantId,
         originalPath: filePath,
         workspaceDir: session.workspaceDir,
       });

       logger.log(`✅ [WriteFileTracker] File tracked successfully`);
       logger.log(`   File ID: ${agentFile.id}`);
       logger.log(`   Filename: ${agentFile.filename}`);
       logger.log(`   Size: ${agentFile.size} bytes`);
       logger.log(`   Message ID: ${session.currentAssistantMessageId}`);

       // ... rest of code
     } catch (error) {
       logger.error(`❌ [WriteFileTracker] Failed to track file: ${error instanceof Error ? error.message : error}`);
     }
   }
   ```

3. **Restart backend**:
   ```bash
   # Ctrl+C to stop
   npm run start:dev
   ```

### ✅ Success Criteria

- Backend restarts without errors
- No TypeScript compilation errors

---

## Phase 3: Run Test Session

**Goal**: Create a session, write a file, and observe hook execution

### Steps

1. **Run verification script**:
   ```bash
   cd /Users/niex/Documents/GitHub/kedge-ccaas
   ./verify-file-hook.sh
   ```

   This script will:
   - Create a session
   - Send a message to write a file
   - Wait 30 seconds
   - Check database for file record

2. **Watch logs in real-time** (in another terminal):
   ```bash
   tail -f packages/backend/logs/*.log | grep -i 'writefiletracker'
   ```

### ✅ Expected Output (Hook Working)

```
🔍 [WriteFileTracker] Hook triggered
   Session: lpd_xxx
   Tool Use ID: toolu_write_123
   File Path: test-1234567890.txt
   Is Error: false
✅ [WriteFileTracker] Session found
   Current Message ID: msg_abc123
   Workspace Dir: /path/to/.agent-workspace/sessions/lpd_xxx
   Tenant ID: test-tenant
📝 [WriteFileTracker] Creating file record...
✅ [WriteFileTracker] File tracked successfully
   File ID: file_xyz789
   Filename: test-1234567890.txt
   Size: 42 bytes
   Message ID: msg_abc123
```

**Database Check**:
```bash
sqlite3 packages/backend/.agent-workspace/data.db \
  "SELECT filename, message_id FROM agent_files WHERE session_id = 'lpd_xxx'"
```

**Expected**:
```
test-1234567890.txt|msg_abc123
```

### ❌ Expected Output (Hook Skipping - Message Context Issue)

```
🔍 [WriteFileTracker] Hook triggered
   Session: lpd_xxx
   Tool Use ID: toolu_write_123
   File Path: test-1234567890.txt
   Is Error: false
✅ [WriteFileTracker] Session found
   Current Message ID: UNDEFINED  ← PROBLEM!
   Workspace Dir: /path/to/.agent-workspace/sessions/lpd_xxx
   Tenant ID: test-tenant
❌ [WriteFileTracker] NO MESSAGE CONTEXT - SKIPPING FILE TRACKING
   This is the root cause! Session has no currentAssistantMessageId.
```

**Database Check**: Returns empty (no file record)

**Workspace Check**:
```bash
ls -la packages/backend/.agent-workspace/sessions/lpd_xxx/
```

**Expected**: File EXISTS in workspace but NOT in database

---

## Phase 4: Diagnose Issue

### If Logs Show "NO MESSAGE CONTEXT" → Message Timing Issue ✅

**Root Cause**: `session.currentAssistantMessageId` is undefined when Write tool executes.

**Why**: Message ID is set AFTER CLI writes file, not BEFORE.

**Fix**: Set message ID BEFORE CLI execution (see Phase 5)

### If Logs Show "Session NOT FOUND" → Session Management Issue

**Root Cause**: Session not created or already cleaned up.

**Fix**: Check `SessionService.createSession()` and session lifecycle.

### If No Logs Appear → Hook Not Triggered

**Root Cause**: EventMapperService not firing hooks.

**Fix**: Check `event-mapper.service.ts:171-189` (`executeToolHooks` method)

### If Logs Show Database Error → FilesService Issue

**Root Cause**: Database insert or file copy failed.

**Fix**: Check FilesService.createFromWriteTool() implementation and logs.

---

## Phase 5: Fix Message Context Timing

**Goal**: Set `currentAssistantMessageId` BEFORE CLI execution

### Steps

1. **Locate SessionService.sendMessage()**:
   ```bash
   grep -n "sendMessage" packages/backend/src/chat/session.service.ts
   ```

2. **Find current implementation**:

   **Current Code** (probably):
   ```typescript
   async sendMessage(sessionId: string, message: string) {
     const session = this.getSession(sessionId);

     // Write to CLI first ❌
     session.cli.stdin.write(message);

     // Create message AFTER (too late!)
     const messageId = await this.messagesService.create({...});
     session.currentAssistantMessageId = messageId;
   }
   ```

3. **Apply fix**:

   **Fixed Code**:
   ```typescript
   import { v4 as uuidv4 } from 'uuid';

   async sendMessage(sessionId: string, message: string) {
     const session = this.getSession(sessionId);

     // Pre-create message ID FIRST ✅
     const messageId = uuidv4();
     session.currentAssistantMessageId = messageId;

     // Log for debugging
     this.logger.log(`Pre-created message ID: ${messageId} for session ${sessionId}`);

     // Then write to CLI
     session.cli.stdin.write(message);

     // Persist to DB asynchronously (non-blocking)
     // Use try/catch to prevent errors from blocking
     this.messagesService.create({
       id: messageId,  // ← Use pre-created ID
       sessionId: context.sessionId,
       role: 'user',
       content: message,
       // ... other fields
     }).catch(err => {
       this.logger.error(`Failed to persist message ${messageId}: ${err}`);
     });
   }
   ```

4. **Restart backend**:
   ```bash
   npm run start:dev
   ```

5. **Re-run verification**:
   ```bash
   ./verify-file-hook.sh
   ```

### ✅ Expected Outcome

**Logs now show**:
```
✅ [WriteFileTracker] Session found
   Current Message ID: msg_abc123  ← NOT UNDEFINED!
```

**Database check**:
```sql
SELECT filename, message_id FROM agent_files WHERE session_id = 'lpd_xxx'

-- Result:
-- test-1234567890.txt|msg_abc123  ← Message association works!
```

---

## Phase 6: Verify in Lesson-Plan-Designer

**Goal**: Confirm Files tab displays written files

### Steps

1. **Start lesson-plan-designer backend**:
   ```bash
   cd solutions/lesson-plan-designer/backend
   npm run start:dev
   ```

2. **Start frontend**:
   ```bash
   cd solutions/lesson-plan-designer/frontend
   npm run dev
   ```

3. **Open browser**:
   ```
   http://localhost:5281/
   ```

4. **Create new session** (click "新建备课")

5. **Send message**:
   ```
   请创建一个名为 lesson-summary.md 的文件，包含今天课程的总结
   ```

6. **Watch for file creation** (should happen automatically)

7. **Click "Files" tab**

### ✅ Expected Result

- File appears in Files tab within 5 seconds
- File shows correct filename, size, mime type
- File has "Uploaded by: Agent" status
- File can be downloaded

### ❌ If Still Not Working

**Check frontend console**:
```javascript
// Should see WebSocket event
file_created { payload: { filename: 'lesson-summary.md', ... } }
```

**Check network tab**:
```
GET /api/v1/files/hybrid/lpd_xxx
→ Response should contain file in tree array
```

**Check CCAAS logs**:
```bash
tail -f packages/backend/logs/*.log | grep -i 'file_created'
```

---

## Phase 7: Clean Up Debug Logging (Optional)

**Goal**: Remove verbose debug logs for production

### Steps

1. **Keep essential logs**:
   ```typescript
   logger.log(`Tracked file ${agentFile.filename} (${agentFile.size} bytes) for message ${session.currentAssistantMessageId}`);
   ```

2. **Remove verbose logs**:
   ```typescript
   // Remove these:
   logger.log(`🔍 [WriteFileTracker] Hook triggered`);
   logger.log(`   Session: ${context.sessionId}`);
   // ... etc
   ```

3. **Keep error logs**:
   ```typescript
   logger.warn(`No assistant message context for session ${context.sessionId}, skipping file tracking`);
   logger.error(`Failed to track file ${filePath}: ${error}`);
   ```

---

## Troubleshooting Guide

### Problem: Hook Never Triggers

**Symptom**: No logs showing "Hook triggered"

**Check**:
```bash
# Verify hook registered
grep -i "registered writefiletracker" packages/backend/logs/*.log

# Verify Write tool was called
grep -i "tool_activity.*Write" packages/backend/logs/*.log
```

**Fix**: Ensure hook is registered in `chat.gateway.ts:onModuleInit()`

### Problem: Session Not Found

**Symptom**: Logs show "Session NOT FOUND"

**Check**:
```bash
# List active sessions
curl http://localhost:3001/api/v1/chat/status
```

**Fix**: Ensure session exists before sending message

### Problem: Message ID Always Undefined

**Symptom**: Logs always show "Current Message ID: UNDEFINED"

**Check**: Verify Phase 5 fix was applied to `session.service.ts`

**Fix**: Set `session.currentAssistantMessageId = uuidv4()` BEFORE CLI execution

### Problem: Database Insert Fails

**Symptom**: Logs show "Failed to track file"

**Check**:
```bash
# Check database permissions
ls -la packages/backend/.agent-workspace/data.db

# Check storage directory exists
ls -la packages/backend/.agent-workspace/files/
```

**Fix**: Ensure database and storage directories have write permissions

---

## Success Checklist

- [ ] Hook registered on startup (logs confirm)
- [ ] Hook triggers when Write tool executes (logs show "Hook triggered")
- [ ] Session found (logs show "Session found")
- [ ] Message ID is set (logs show "Current Message ID: msg_xxx")
- [ ] File record created (logs show "File tracked successfully")
- [ ] Database contains file record (SQL query returns row)
- [ ] WebSocket event emitted (frontend console shows event)
- [ ] Files tab displays file (UI updated)

---

## Maintenance

### Regular Checks

**Weekly**:
- Monitor database size: `du -h packages/backend/.agent-workspace/data.db`
- Monitor file storage: `du -h packages/backend/.agent-workspace/files/`
- Check for orphaned files (files in workspace but not in DB)

**Monthly**:
- Review error logs for failed file tracking
- Archive old session workspaces
- Vacuum SQLite database

### Monitoring Queries

**Count tracked files**:
```sql
SELECT COUNT(*) FROM agent_files;
```

**Files without message association** (should be 0):
```sql
SELECT COUNT(*) FROM agent_files WHERE message_id IS NULL;
```

**Largest files**:
```sql
SELECT filename, size FROM agent_files ORDER BY size DESC LIMIT 10;
```

**Files by status**:
```sql
SELECT status, COUNT(*) FROM agent_files GROUP BY status;
```

---

## Additional Resources

- **Full Technical Report**: `FILE_WRITING_MECHANISM_EXPLORATION.md`
- **Executive Summary**: `FILE_WRITING_EXPLORATION_SUMMARY.md`
- **Verification Script**: `verify-file-hook.sh`
- **Hook Implementation**: `packages/backend/src/hooks/write-file-tracker.hook.ts`
- **Database Schema**: `packages/backend/src/files/entities/agent-file.entity.ts`
