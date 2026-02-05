# CCAAS File Service Integration - Implementation Summary

## Overview

Successfully integrated the lesson-plan-designer solution with the CCAAS centralized file service. Files are now managed by CCAAS instead of being duplicated by each solution.

## Changes Made

### 1. CCAAS Backend (`packages/backend/`)

#### `src/main.ts`
- Updated CORS configuration to use `origin: true` (allow all origins in dev)
- Added `credentials: true` for proper auth handling
- Added `X-API-Key` to allowed headers

#### `src/files/files.service.ts`
- Added `createFromSessionFile()` method to register files from MCP servers
- Accepts absolute path from session workspace
- Copies file to persistent storage: `.agent-workspace/files/{tenantId}/{messageId}/`
- Creates `AgentFile` database record
- Returns file ID and download URL

#### `src/files/files.controller.ts`
- Added `POST /api/v1/files/register` endpoint
- Accepts: `{ originalPath, sessionId?, messageId?, tenantId? }`
- Returns: `{ fileId, filename, downloadUrl }`
- Used by MCP servers to register files with CCAAS

### 2. MCP Server (`solutions/lesson-plan-designer/mcp-server/`)

#### `package.json`
- Added dependency: `"mime-types": "^2.1.35"`

#### `src/index.ts`
- Imported `mime-types` for MIME type detection
- Updated `attach_file` tool to call CCAAS `/register` endpoint
- Sends absolute file path to CCAAS
- Receives real `fileId` and `downloadUrl` from CCAAS
- Returns attachment metadata with CCAAS URLs
- Proper error handling with TypeScript type guards

### 3. Solution Backend (`solutions/lesson-plan-designer/backend/`)

#### `src/lesson-plans/lesson-plans.types.ts`
- Updated `AddAttachmentDto`:
  - Made `fileName` required (not optional)
  - Made `downloadUrl` required
  - Removed `_originalPath` field (no longer needed)

#### `src/lesson-plans/lesson-plans.service.ts`
- Removed `UPLOAD_DIR` constant (no longer copying files)
- Removed upload directory creation logic
- Simplified `addAttachmentFromMcp()`:
  - No file copying
  - Just stores reference metadata
  - Uses `downloadUrl` from CCAAS
- Removed `getFileMetadata()` method (no longer needed)
- Removed `addAttachment()` legacy method

#### `src/lesson-plans/lesson-plans.controller.ts`
- Simplified `POST :id/attachments` endpoint
- All attachments now go through `addAttachmentFromMcp()`
- Removed conditional logic for `_originalPath`

#### `src/lesson-plans/files.controller.ts`
- **DELETED** - No longer needed (CCAAS handles downloads)

#### `src/lesson-plans/lesson-plans.module.ts`
- Removed `FilesController` import and registration

### 4. Frontend (No changes needed)

The frontend already uses `attachment.downloadUrl`, so it will automatically download from CCAAS when the URL points to `http://localhost:3001/api/v1/files/{fileId}/download`.

## Architecture

### Before (Wrong)
```
Solution Backend
  ↓ Copies file to .agent-workspace/uploads/attachments/
  ↓ Serves file via /api/v1/files/:id/download
Frontend
  ↓ Downloads from solution backend
```

### After (Correct)
```
Session Workspace (.agent-workspace/sessions/{sessionId}/)
  ↓ Claude creates file
  ↓ MCP attach_file tool called
  ↓
CCAAS FilesService (http://localhost:3001)
  ↓ Tracks file in database (AgentFile entity)
  ↓ Copies to persistent storage (.agent-workspace/files/{tenantId}/{messageId}/)
  ↓ Returns fileId
  ↓
Solution Backend (http://localhost:5280)
  ↓ Stores REFERENCE only (fileId + metadata)
  ↓ lesson_plans.attachments: [{ fileId: "uuid", downloadUrl: "http://localhost:3001/...", ... }]
  ↓
Frontend (http://localhost:5173)
  ↓ Downloads from CCAAS: http://localhost:3001/api/v1/files/{fileId}/download
  ↓ CORS enabled for all origins (dev only)
```

## Benefits

1. **Single Source of Truth** - CCAAS owns all file management
2. **Proper Session Context** - Files linked to sessions and messages
3. **Database Tracking** - File status, metadata, history in `AgentFile` table
4. **No Duplication** - Solutions don't reimplement file storage
5. **Consistent API** - All solutions use same file endpoints
6. **Better Features** - Preview, tree view, sync status from CCAAS
7. **Simple CORS** - Enabled for all origins in dev (can tighten in prod)

## Testing

### 1. Test CCAAS Endpoint

```bash
# Start CCAAS backend
cd packages/backend
npm run start:dev

# Test file registration
echo "test content" > /tmp/test.txt

curl -X POST http://localhost:3001/api/v1/files/register \
  -H "Content-Type: application/json" \
  -d '{
    "originalPath": "/tmp/test.txt",
    "sessionId": "test-session",
    "tenantId": "default"
  }'

# Should return: { "fileId": "...", "filename": "test.txt", "downloadUrl": "..." }

# Test download
curl http://localhost:3001/api/v1/files/{fileId}/download
```

### 2. Test MCP Integration

```bash
# Start all services
cd packages/backend && npm run start:dev &
cd solutions/lesson-plan-designer/backend && npm run start:dev &
cd solutions/lesson-plan-designer/frontend && npm run dev &

# In frontend:
# 1. Create lesson plan
# 2. Use /notebooklm skill to generate content with attachments
# 3. Verify file appears in attachments
# 4. Click download
# 5. Verify file downloads from CCAAS (check Network tab - should be localhost:3001)
```

### 3. Verify CORS

```bash
# From browser console on localhost:5173
fetch('http://localhost:3001/api/v1/files/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ originalPath: '/tmp/test.txt', sessionId: 'test' })
}).then(r => r.json()).then(console.log);

# Should not see CORS error
```

## Production Considerations

For production, tighten CORS to specific origins:

```typescript
// packages/backend/src/main.ts
app.enableCors({
  origin: [
    'http://localhost:5173',           // Dev frontend
    'https://your-domain.com',         // Prod frontend
    'https://admin.your-domain.com',   // Admin frontend
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Tenant-Id'],
});
```

Or use environment variable:

```typescript
const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'];

app.enableCors({
  origin: allowedOrigins,
  credentials: true,
  // ...
});
```

## Files Modified

| File | Action | Description |
|------|--------|-------------|
| `packages/backend/src/main.ts` | Modified | Updated CORS config |
| `packages/backend/src/files/files.service.ts` | Modified | Added `createFromSessionFile()` |
| `packages/backend/src/files/files.controller.ts` | Modified | Added `/register` endpoint |
| `solutions/lesson-plan-designer/mcp-server/package.json` | Modified | Added mime-types dependency |
| `solutions/lesson-plan-designer/mcp-server/src/index.ts` | Modified | Updated attach_file to use CCAAS |
| `solutions/lesson-plan-designer/backend/src/lesson-plans/lesson-plans.types.ts` | Modified | Updated AddAttachmentDto |
| `solutions/lesson-plan-designer/backend/src/lesson-plans/lesson-plans.service.ts` | Modified | Simplified attachment handling |
| `solutions/lesson-plan-designer/backend/src/lesson-plans/lesson-plans.controller.ts` | Modified | Simplified endpoint |
| `solutions/lesson-plan-designer/backend/src/lesson-plans/files.controller.ts` | **DELETED** | No longer needed |
| `solutions/lesson-plan-designer/backend/src/lesson-plans/lesson-plans.module.ts` | Modified | Removed FilesController |

## Cleanup

After confirming everything works:

1. **Delete old upload directory**:
   ```bash
   rm -rf .agent-workspace/uploads/attachments/
   ```

2. **Remove unused code** (already done):
   - Removed `UPLOAD_DIR` constant
   - Removed `getFileMetadata()` method
   - Removed legacy `addAttachment()` method
   - Deleted `FilesController`

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| CCAAS must be running | Document dependency clearly |
| Breaking existing attachments | Acceptable in dev; clean break |
| CORS security in prod | Update CORS config for production (specific origins) |
| MCP fetch failure | Proper error handling and logging |

## Next Steps

1. Test the integration end-to-end with NotebookLM skill
2. Verify file downloads work from frontend
3. Check CORS in browser DevTools
4. Update production CORS configuration before deployment
5. Document the pattern for other solutions to follow
