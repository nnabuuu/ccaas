# File Management API Documentation

Complete API reference for file management and version control endpoints in CCAAS.

---

## Table of Contents

- [Authentication](#authentication)
- [File Management](#file-management)
- [Version Control](#version-control)
- [Badge State](#badge-state)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Authentication

All endpoints require API key authentication via the `X-API-Key` header.

```http
X-API-Key: sk-your-api-key-here
```

**Required Scopes**: `chat` (for file operations within sessions)

---

## File Management

### List Session Files

Get all files for a specific session.

```http
GET /api/v1/sessions/:sessionId/files
```

**Path Parameters**:
- `sessionId` (string, required) - Session UUID

**Query Parameters**:
- `status` (string, optional) - Filter by status: `new`, `modified`, `synced`
- `mimeType` (string, optional) - Filter by MIME type

**Response**: `200 OK`

```json
[
  {
    "id": "file-uuid-1",
    "sessionId": "session-uuid-1",
    "solutionId": "solution-1",
    "messageId": "msg-uuid-1",
    "filename": "report.md",
    "originalPath": "/reports/summary.md",
    "storedPath": "/storage/tenant-1/msg-uuid-1/summary.md",
    "mimeType": "text/markdown",
    "size": 2048,
    "status": "new",
    "currentVersion": "1.0.0",
    "lastVersionAt": "2024-01-15T10:30:00Z",
    "uploadedBy": "agent",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "downloadedAt": null
  }
]
```

**Status Values**:
- `new` - File just created, not yet viewed
- `modified` - File has been updated
- `synced` - File has been viewed/downloaded

---

### Get Session Files Tree

Get hierarchical file tree structure.

```http
GET /api/v1/sessions/:sessionId/files/tree
```

**Response**: `200 OK`

```json
[
  {
    "name": "reports",
    "type": "directory",
    "children": [
      {
        "name": "summary.md",
        "type": "file",
        "id": "file-uuid-1",
        "size": 2048,
        "mimeType": "text/markdown",
        "status": "new"
      }
    ]
  },
  {
    "name": "data.json",
    "type": "file",
    "id": "file-uuid-2",
    "size": 512,
    "mimeType": "application/json",
    "status": "synced"
  }
]
```

---

### Get File Metadata

Get metadata for a specific file.

```http
GET /api/v1/files/:fileId
```

**Response**: `200 OK` (same structure as list response item)

**Errors**:
- `404 Not Found` - File does not exist

---

### Get File Preview

Get file content preview (truncated for large files).

```http
GET /api/v1/files/:fileId/preview
```

**Query Parameters**:
- `maxBytes` (number, optional) - Max bytes to return (default: 100KB)

**Response**: `200 OK`

```json
{
  "content": "# Report Summary\n\nThis is the content...",
  "encoding": "utf8",
  "truncated": false,
  "mimeType": "text/markdown",
  "size": 2048
}
```

**Encoding Types**:
- `utf8` - Text files (text/*, application/json, application/xml)
- `base64` - Binary files (images, PDFs, etc.)

**Errors**:
- `404 Not Found` - File or content not available

---

### Upload File

Upload a file to a session.

```http
POST /api/v1/files/upload
```

**Headers**:
```http
Content-Type: multipart/form-data
```

**Form Data**:
- `file` (file, required) - File to upload
- `sessionId` (string, required) - Target session
- `targetPath` (string, optional) - Relative path (e.g., `docs/reports/`)
- `workspaceDir` (string, optional) - Workspace directory for Claude Code

**Response**: `201 Created`

```json
{
  "id": "file-uuid-new",
  "filename": "upload.pdf",
  "size": 5000,
  "mimeType": "application/pdf",
  "status": "new",
  "currentVersion": "1.0.0",
  "originalPath": "upload.pdf",
  "storedPath": "/storage/tenant-1/session-1/upload.pdf",
  "uploadedBy": "user",
  "createdAt": "2024-01-15T11:00:00Z"
}
```

**Size Limits**:
- Default: 10 MB
- Configurable via `FILE_UPLOAD_MAX_SIZE` environment variable

**Errors**:
- `400 Bad Request` - File too large or invalid MIME type
- `413 Payload Too Large` - File exceeds size limit

---

### Download File

Download file content.

```http
GET /api/v1/files/:fileId/download
```

**Response**: `200 OK`

```http
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="report.md"

[file content]
```

**Errors**:
- `404 Not Found` - File does not exist

---

### Mark File as Synced

Mark file as viewed/synced to clear badge indicator.

```http
POST /api/v1/files/:fileId/mark-synced
```

**Response**: `200 OK`

```json
{
  "id": "file-uuid-1",
  "status": "synced",
  "downloadedAt": "2024-01-15T11:30:00Z"
}
```

---

### Delete File

Delete a file (soft delete).

```http
DELETE /api/v1/files/:fileId
```

**Response**: `204 No Content`

**Errors**:
- `404 Not Found` - File does not exist

---

## Version Control

### Create Version

Create a new version of a file.

```http
POST /api/v1/files/:fileId/versions
```

**Request Body**:

```json
{
  "version": "1.0.1",
  "bumpType": "patch",
  "changelog": "Updated introduction section"
}
```

**Parameters**:
- `version` (string, optional) - Custom version number (e.g., `2.0.0`)
- `bumpType` (string, optional) - Auto-increment type: `major`, `minor`, `patch` (default: `patch`)
- `changelog` (string, optional) - Description of changes

**Response**: `201 Created`

```json
{
  "id": "version-uuid-1",
  "fileId": "file-uuid-1",
  "version": "1.0.1",
  "contentHash": "sha256:abc123...",
  "storedPath": "/storage/versions/tenant-1/file-uuid-1/1.0.1-report.md",
  "size": 2048,
  "mimeType": "text/markdown",
  "changelog": "Updated introduction section",
  "uploadedBy": "agent",
  "createdAt": "2024-01-15T12:00:00Z"
}
```

**Version Bumping**:
- `patch`: 1.0.0 → 1.0.1
- `minor`: 1.0.0 → 1.1.0
- `major`: 1.0.0 → 2.0.0

**Errors**:
- `404 Not Found` - File does not exist
- `400 Bad Request` - Version already exists

---

### List Versions

Get all versions of a file.

```http
GET /api/v1/files/:fileId/versions
```

**Response**: `200 OK`

```json
[
  {
    "id": "version-uuid-2",
    "fileId": "file-uuid-1",
    "version": "1.0.1",
    "size": 2048,
    "changelog": "Updated introduction",
    "createdAt": "2024-01-15T12:00:00Z",
    "uploadedBy": "agent"
  },
  {
    "id": "version-uuid-1",
    "fileId": "file-uuid-1",
    "version": "1.0.0",
    "size": 1024,
    "changelog": "Initial version",
    "createdAt": "2024-01-15T10:30:00Z",
    "uploadedBy": "agent"
  }
]
```

**Sorting**: Versions returned in descending order by `createdAt`

---

### Get Specific Version

Get metadata for a specific version.

```http
GET /api/v1/files/:fileId/versions/:version
```

**Response**: `200 OK` (same structure as list item)

**Errors**:
- `404 Not Found` - Version does not exist

---

### Download Version

Download content of a specific version.

```http
GET /api/v1/files/:fileId/versions/:version/download
```

**Response**: `200 OK`

```http
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="report-1.0.0.md"

[version content]
```

---

### Compare Versions

Compare two versions to see differences.

```http
GET /api/v1/files/:fileId/versions/compare
```

**Query Parameters**:
- `from` (string, required) - From version (e.g., `1.0.0`)
- `to` (string, required) - To version (e.g., `1.0.1`)

**Response**: `200 OK`

```json
{
  "from": {
    "version": "1.0.0",
    "size": 1024,
    "contentHash": "sha256:abc123..."
  },
  "to": {
    "version": "1.0.1",
    "size": 2048,
    "contentHash": "sha256:def456..."
  },
  "sizeDiff": 1024,
  "hashChanged": true
}
```

**Interpretation**:
- `sizeDiff > 0`: File grew
- `sizeDiff < 0`: File shrunk
- `sizeDiff = 0`: No size change
- `hashChanged = false`: Identical content (despite version difference)

---

### Rollback to Version

Rollback file to a previous version (creates new version).

```http
POST /api/v1/files/:fileId/rollback
```

**Request Body**:

```json
{
  "targetVersion": "1.0.0"
}
```

**Response**: `200 OK`

```json
{
  "id": "file-uuid-1",
  "filename": "report.md",
  "currentVersion": "1.0.2",
  "status": "modified",
  "size": 1024,
  "updatedAt": "2024-01-15T14:00:00Z"
}
```

**Behavior**:
1. Copies content from target version to current file
2. Updates file metadata (size, status)
3. Creates new version (e.g., 1.0.2) with changelog "Rollback to version 1.0.0"
4. Emits `file.modified` event via SSE push channel

**Errors**:
- `404 Not Found` - File or version does not exist

---

### Delete Version

Delete a specific version (cannot delete current version).

```http
DELETE /api/v1/files/:fileId/versions/:version
```

**Response**: `204 No Content`

**Errors**:
- `400 Bad Request` - Cannot delete current version
- `404 Not Found` - Version does not exist

---

## Badge State

### Get New Files Count

Get count of new/modified files in a session.

```http
GET /api/v1/files/session/:sessionId/new-count
```

**Response**: `200 OK`

```json
{
  "newCount": 3,
  "modifiedCount": 2,
  "totalCount": 5
}
```

---

### Mark All Files as Seen

Clear all badges for a session.

```http
POST /api/v1/files/session/:sessionId/mark-seen
```

**Response**: `200 OK`

```json
{
  "markedCount": 5
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "code": "FILE_NOT_FOUND",
  "message": "File with ID file-uuid-1 not found",
  "statusCode": 404,
  "recoverable": false,
  "retryable": false,
  "timestamp": "2024-01-15T12:00:00Z",
  "path": "/api/v1/files/file-uuid-1",
  "requestId": "req_123"
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `FILE_NOT_FOUND` | 404 | File does not exist |
| `VERSION_NOT_FOUND` | 404 | Version does not exist |
| `FILE_TOO_LARGE` | 400 | File exceeds size limit |
| `INVALID_MIME_TYPE` | 400 | MIME type not allowed |
| `VERSION_EXISTS` | 400 | Version already exists |
| `CANNOT_DELETE_CURRENT_VERSION` | 400 | Cannot delete active version |
| `FILE_CONTENT_UNAVAILABLE` | 404 | File content not accessible |
| `INTERNAL_ERROR` | 500 | Internal server error |

---

## Examples

### Example 1: Upload and Track File

```bash
# 1. Upload file
curl -X POST http://localhost:3001/api/v1/files/upload \
  -H "X-API-Key: sk-your-key" \
  -F "file=@report.pdf" \
  -F "sessionId=session-123" \
  -F "targetPath=docs/"

# Response:
# { "id": "file-abc", "status": "new", ... }

# 2. List files (shows badge)
curl http://localhost:3001/api/v1/sessions/session-123/files \
  -H "X-API-Key: sk-your-key"

# Response:
# [{ "id": "file-abc", "status": "new", ... }]

# 3. Mark as synced (clear badge)
curl -X POST http://localhost:3001/api/v1/files/file-abc/mark-synced \
  -H "X-API-Key: sk-your-key"

# Response:
# { "status": "synced", "downloadedAt": "..." }
```

---

### Example 2: Version Control Workflow

```bash
# 1. Create initial version
curl -X POST http://localhost:3001/api/v1/files/file-abc/versions \
  -H "X-API-Key: sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{"changelog": "Initial version"}'

# 2. Modify file (agent updates it)
# ... file modified by agent ...

# 3. Create new version
curl -X POST http://localhost:3001/api/v1/files/file-abc/versions \
  -H "X-API-Key: sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{"bumpType": "minor", "changelog": "Added new section"}'

# 4. List versions
curl http://localhost:3001/api/v1/files/file-abc/versions \
  -H "X-API-Key: sk-your-key"

# Response:
# [
#   { "version": "1.1.0", "changelog": "Added new section" },
#   { "version": "1.0.0", "changelog": "Initial version" }
# ]

# 5. Compare versions
curl "http://localhost:3001/api/v1/files/file-abc/versions/compare?from=1.0.0&to=1.1.0" \
  -H "X-API-Key: sk-your-key"

# Response:
# { "sizeDiff": 512, "hashChanged": true }

# 6. Rollback to previous version
curl -X POST http://localhost:3001/api/v1/files/file-abc/rollback \
  -H "X-API-Key: sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{"targetVersion": "1.0.0"}'

# Response:
# { "currentVersion": "1.1.1", "status": "modified" }
```

---

### Example 3: Real-time Updates via SSE

File events are delivered through the SSE push channel. Use the SDK hooks to subscribe:

```typescript
// React SDK - file events via useAgentChat callback
import { useAgentConnection, useAgentChat } from '@kedge-agentic/react-sdk'

const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',
})

// File events (file.created, file.modified, file.version_created, file.deleted)
// are automatically handled by the SDK and delivered through the event stream.
// Subscribe to the push channel for cross-turn file events:
// GET /api/v1/sessions/:id/events (SSE endpoint)
```

```typescript
// Or subscribe to the SSE push channel directly
const eventSource = new EventSource(
  `http://localhost:3001/api/v1/sessions/${sessionId}/events`
)

eventSource.addEventListener('file.created', (e) => {
  const event = JSON.parse(e.data)
  console.log('New file created:', event.file)
})

eventSource.addEventListener('file.modified', (e) => {
  const event = JSON.parse(e.data)
  console.log('File modified:', event.fileId, event.status)
})
```

---

## Rate Limiting

File operations are rate-limited per tenant:
- **Default**: 60 requests per minute
- **Upload**: 10 uploads per minute
- **Version creation**: 20 versions per minute

Rate limit headers:
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1642252800
```

---

## Real-time Events

### file.created

Emitted when a file is created.

```json
{
  "type": "file.created",
  "fileId": "file-uuid-1",
  "sessionId": "session-uuid-1",
  "solutionId": "solution-1",
  "filename": "report.md",
  "status": "new",
  "uploadedBy": "agent",
  "file": { /* full file metadata */ }
}
```

### file.modified

Emitted when a file is modified.

```json
{
  "type": "file.modified",
  "fileId": "file-uuid-1",
  "sessionId": "session-uuid-1",
  "status": "modified",
  "size": 2048,
  "action": "rollback",
  "targetVersion": "1.0.0"
}
```

### file.version_created

Emitted when a new version is created.

```json
{
  "type": "file.version_created",
  "fileId": "file-uuid-1",
  "versionId": "version-uuid-1",
  "version": "1.0.1",
  "filename": "report.md"
}
```

### file.deleted

Emitted when a file is deleted.

```json
{
  "type": "file.deleted",
  "fileId": "file-uuid-1",
  "sessionId": "session-uuid-1"
}
```

---

## Best Practices

1. **Badge Management**: Always call `mark-synced` after user views/downloads file to clear badges
2. **Version Control**: Create versions before major changes to enable rollback
3. **Changelog**: Always provide meaningful changelog messages for version tracking
4. **Real-time Updates**: Use SSE push channel events to keep UI synchronized
5. **Error Handling**: Check for 404 errors and handle gracefully (file may have been deleted)
6. **File Size**: Check file size before upload to avoid exceeding limits
7. **Preview Caching**: Cache preview content client-side to reduce API calls

---

## See Also

- [React SDK Documentation](../../react-sdk/docs/FILE_MANAGEMENT.md)
- [Error Handling Guide](./ERROR_HANDLING.md)
- [Authentication Guide](./AUTHENTICATION_AND_AUTHORIZATION.md)
