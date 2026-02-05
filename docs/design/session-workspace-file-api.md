# Design Doc: Session Workspace File API

**Status:** Draft
**Author:** Claude
**Date:** 2026-02-05
**Related:** CCAAS Backend, File Explorer UI

---

## Executive Summary

This design introduces REST API endpoints to access any file in CCAAS session workspaces (tracked or untracked) via HTTP, enabling the development of a File Explorer UI component for web-based solutions.

**Key endpoints:**
- `GET /api/v1/sessions/:sessionId/workspace` - List files as tree
- `GET /api/v1/sessions/:sessionId/workspace/*` - Download file

---

## Motivation

### Problem

Currently, files in session workspaces have limited accessibility:

- **Tracked files** (created via Write tool or attach_file) → accessible via `/api/v1/files/{fileId}/download`
- **Untracked files** → stuck in `.agent-workspace/sessions/{sessionId}/` with no API access

This prevents building comprehensive File Explorer UIs that show all workspace files.

### Use Case

The ccaas-demo solution needs a File Explorer component that allows users to:
- Browse all files in a session workspace
- Download files via web interface
- See nested folder structures
- View file metadata (size, type)

### Goals

1. ✅ Enable REST API access to any session workspace file
2. ✅ Support nested directory structures
3. ✅ Maintain security (path traversal prevention)
4. ✅ Provide tree/list endpoints for UI rendering
5. ✅ Stream large files efficiently

### Non-Goals

- ❌ File upload endpoint (future enhancement)
- ❌ File editing/modification via API
- ❌ Real-time file change notifications (WebSocket)
- ❌ File versioning/history

---

## Design

### API Endpoints

#### 1. List Files (Tree Structure)

```
GET /api/v1/sessions/:sessionId/workspace
```

**Response:**
```json
{
  "tree": [
    {
      "id": "folder-scripts",
      "name": "scripts",
      "type": "folder",
      "path": "scripts",
      "children": [
        {
          "id": "file-scripts/intro.md",
          "name": "intro.md",
          "type": "file",
          "path": "scripts/intro.md",
          "size": 2048,
          "mimeType": "text/markdown"
        }
      ]
    }
  ]
}
```

**Features:**
- Recursive tree structure
- Folders sorted before files
- File metadata included (size, MIME type)
- Suitable for tree UI rendering

#### 2. Download File

```
GET /api/v1/sessions/:sessionId/workspace/*
```

**Examples:**
```
/api/v1/sessions/abc-123/workspace/scripts/intro.md
/api/v1/sessions/abc-123/workspace/.context/lesson-plan.json
/api/v1/sessions/abc-123/workspace/deep/nested/path/file.txt
```

**Response:**
- Status: 200 OK
- Headers: `Content-Type`, `Content-Disposition`, `Content-Length`
- Body: File stream

**Features:**
- Wildcard routing for nested paths
- Streaming (no memory buffering)
- Automatic MIME type detection
- URL-safe (NestJS handles decoding)

### Architecture

```
┌─────────────────┐
│  File Explorer  │  (Frontend Component)
│      UI         │
└────────┬────────┘
         │ HTTP GET
         ↓
┌─────────────────┐
│ SessionsController│
│  /workspace/*    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ SessionService  │
│ - getWorkspaceFile()
│ - getWorkspaceTree()
│ - sanitizeFilePath()
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Filesystem     │
│ .agent-workspace/
│  sessions/{id}/
└─────────────────┘
```

### Security Model

#### Multi-Layer Defense

1. **Path Sanitization**
   ```typescript
   // Remove dangerous sequences
   sanitized = filePath.replace(/^\/+|\/+$/g, '');
   sanitized = path.normalize(sanitized);

   if (sanitized.includes('..')) {
     throw new BadRequestException();
   }
   ```

2. **Boundary Validation**
   ```typescript
   const resolvedPath = path.resolve(absolutePath);
   const resolvedWorkspace = path.resolve(workspaceDir);

   if (!resolvedPath.startsWith(resolvedWorkspace + path.sep)) {
     throw new BadRequestException('Access denied');
   }
   ```

3. **File Type Validation**
   - Reject symlinks (could escape workspace)
   - Reject directories (only regular files allowed)
   - Use `fs.statSync()` for validation

4. **Session Isolation**
   - Each session has isolated workspace directory
   - Filesystem-level boundaries prevent cross-session access

#### Attack Vector Mitigation

| Attack Type | Example | Mitigation |
|-------------|---------|-----------|
| Path Traversal | `../../etc/passwd` | Normalize + boundary check |
| URL Encoded | `%2e%2e%2f` | NestJS auto-decodes |
| Null Byte | `file.txt\0.png` | Explicit rejection |
| Symlink | `ln -s /etc/passwd` | `isSymbolicLink()` check |
| Absolute Path | `/etc/passwd` | Leading slash removal |

### Implementation Details

#### Controller Changes

**File:** `packages/backend/src/sessions/sessions.controller.ts`

Add two endpoints:

```typescript
@Get(':sessionId/workspace/*')
async downloadWorkspaceFile(
  @Param('sessionId') sessionId: string,
  @Param('*') filePath: string,
  @Res({ passthrough: true }) res: Response,
): Promise<StreamableFile> {
  const fileInfo = await this.sessionService.getWorkspaceFile(sessionId, filePath);

  res.set({
    'Content-Type': fileInfo.mimeType,
    'Content-Disposition': `attachment; filename="${encodeURIComponent(fileInfo.filename)}"`,
    'Content-Length': fileInfo.size,
  });

  return new StreamableFile(createReadStream(fileInfo.absolutePath));
}

@Get(':sessionId/workspace')
async listWorkspaceFiles(
  @Param('sessionId') sessionId: string,
): Promise<{ tree: FileTreeNode[] }> {
  return this.sessionService.getWorkspaceTree(sessionId);
}
```

#### Service Changes

**File:** `packages/backend/src/chat/session.service.ts`

Add three methods:

1. **getWorkspaceFile()** - Validates and returns file info for download
2. **getWorkspaceTree()** - Builds recursive directory tree
3. **sanitizeFilePath()** - Security validation (private)
4. **detectMimeType()** - MIME type detection (private)
5. **buildDirectoryTree()** - Recursive tree builder (private)

**Key Security Logic:**
```typescript
private sanitizeFilePath(filePath: string): string {
  let sanitized = filePath.replace(/^\/+|\/+$/g, '');
  sanitized = path.normalize(sanitized);

  if (sanitized.includes('..') || sanitized.includes('\0')) {
    throw new BadRequestException('Invalid file path');
  }

  return sanitized;
}
```

#### TypeScript Interfaces

**File:** `packages/backend/src/common/interfaces.ts`

```typescript
export interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  size?: number;
  mimeType?: string;
  children?: FileTreeNode[];
}
```

---

## Frontend Integration

### Component Structure

```
FileExplorer/
├── FileExplorer.tsx          # Main container
├── FileTree.tsx              # Recursive tree renderer
├── FileItem.tsx              # File/folder row
├── FilePreview.tsx           # Optional preview panel
└── useWorkspaceFiles.ts      # API integration hook
```

### API Hook

```typescript
export function useWorkspaceFiles(sessionId: string) {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:3001/api/v1/sessions/${sessionId}/workspace`)
      .then(res => res.json())
      .then(data => setTree(data.tree))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const downloadFile = (filePath: string) => {
    window.open(
      `http://localhost:3001/api/v1/sessions/${sessionId}/workspace/${filePath}`,
      '_blank'
    );
  };

  return { tree, loading, downloadFile };
}
```

### UI Features

- **Tree View**: Collapsible folders, file icons, size display
- **File Actions**: Click to download, context menu (future)
- **Search/Filter**: By filename, type, size
- **Preview**: Inline for text/images (future)

---

## Performance Considerations

### Streaming

- Uses `createReadStream()` for file downloads
- No memory buffering (files don't load into RAM)
- Efficient for large files (GBs)
- Node.js handles backpressure automatically

### Tree Building

- Synchronous filesystem reads (`readdirSync`)
- Cached in-memory (no database queries)
- Fast for typical workspace sizes (<1000 files)
- Recursive algorithm with O(n) complexity

### Optimizations

- **Lazy Loading**: Load subtrees on demand (future)
- **Pagination**: Limit tree depth or file count (future)
- **Caching**: Cache tree responses with TTL (future)

---

## Testing Strategy

### Unit Tests

**File:** `packages/backend/src/chat/session.service.spec.ts`

Test coverage:
- ✅ Valid file paths
- ✅ Path traversal attempts (../)
- ✅ Null byte injection
- ✅ Symlink rejection
- ✅ Nested paths
- ✅ Non-existent files
- ✅ Tree structure
- ✅ Sorting (folders before files)

### Integration Tests

**File:** `packages/backend/test/integration/workspace-files.e2e.spec.ts`

Test scenarios:
- ✅ Download file successfully
- ✅ Block traversal attempts
- ✅ Handle nested paths
- ✅ Return 404 for missing files
- ✅ List files as tree
- ✅ MIME types correct

### Security Tests

Attack vectors to test:
- `../../../etc/passwd`
- `..%2F..%2F..%2Fetc%2Fpasswd`
- `file.txt\0.png`
- `\\\\server\\share\\file.txt`
- `/etc/passwd`
- `%252e%252e%252f`

All should be rejected with 400 Bad Request.

---

## Rollout Plan

### Phase 1: Backend Implementation (Week 1)

1. Add methods to SessionService
2. Add endpoints to SessionsController
3. Create TypeScript interfaces
4. Write unit tests
5. Write integration tests
6. Security review

### Phase 2: Frontend Implementation (Week 2)

7. Create FileExplorer component
8. Create FileTree component
9. Create useWorkspaceFiles hook
10. Add file type icons
11. Test download functionality
12. Style with design system

### Phase 3: Testing & Refinement (Week 3)

13. End-to-end testing
14. Performance testing (large files, deep trees)
15. Security audit
16. Documentation updates
17. Demo video

### Phase 4: Launch (Week 4)

18. Deploy to staging
19. User acceptance testing
20. Deploy to production
21. Monitor metrics

---

## Metrics

Track the following:

- **Adoption**: % of sessions using File Explorer
- **Performance**: Average tree load time
- **Security**: Failed path traversal attempts
- **Errors**: 404s, 500s per endpoint
- **Traffic**: Downloads per session

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Path traversal vulnerability | Critical | Multi-layer validation, security tests |
| Performance with large workspaces | Medium | Lazy loading, pagination |
| CORS issues | Low | Already configured for all origins (dev) |
| Session cleanup race condition | Low | Check workspace exists before listing |
| Large file memory usage | Medium | Streaming (already implemented) |

---

## Alternatives Considered

### 1. Query Parameter Approach

```
GET /api/v1/sessions/:id/workspace?path=/nested/file.txt
```

**Pros:** No wildcard routing
**Cons:** Cluttered URLs, encoding overhead, harder to cache
**Decision:** Rejected - wildcard is cleaner

### 2. Base64-Encoded Path

```
GET /api/v1/sessions/:id/workspace/{base64EncodedPath}
```

**Pros:** No special character issues
**Cons:** Obfuscated, hard to debug, no clear benefit
**Decision:** Rejected - unnecessary complexity

### 3. Separate Controller

Create `WorkspaceFilesController` instead of adding to `SessionsController`.

**Pros:** Separation of concerns
**Cons:** Extra module, workspace is conceptually part of session
**Decision:** Rejected - keep in SessionsController

---

## Future Enhancements

### 1. File Upload

```
POST /api/v1/sessions/:id/workspace
Content-Type: multipart/form-data
```

Allow users to upload files to workspace.

### 2. File Preview

```
GET /api/v1/sessions/:id/workspace/preview?path=file.txt
```

Return file content inline for text/images.

### 3. Batch Download

```
POST /api/v1/sessions/:id/workspace/download
{ "files": ["file1.txt", "file2.md"] }
```

Download multiple files as ZIP.

### 4. Real-time Updates

WebSocket events when files are created/modified/deleted.

### 5. Search

```
GET /api/v1/sessions/:id/workspace/search?q=keyword
```

Full-text search across workspace files.

### 6. Version History

Track file modifications over time, allow rollback.

### 7. Permissions

Fine-grained access control per file (read-only, read-write).

### 8. Quotas

Limit workspace size per tenant/session.

---

## References

- [NestJS File Upload](https://docs.nestjs.com/techniques/file-upload)
- [NestJS Streaming Files](https://docs.nestjs.com/techniques/streaming-files)
- [Node.js Path Traversal Prevention](https://nodejs.org/api/path.html#path_path_resolve_paths)
- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)

---

## Appendix A: Code Examples

### Full SessionService Implementation

See implementation plan for complete code.

### Full SessionsController Implementation

See implementation plan for complete code.

### Frontend FileExplorer Component

See implementation plan for complete code.

---

## Appendix B: Security Checklist

Pre-launch security review:

- [ ] Path traversal prevention tested
- [ ] Null byte injection prevention tested
- [ ] Symlink traversal prevention tested
- [ ] URL encoding handled correctly
- [ ] Session ownership validated
- [ ] File type validation (directories rejected)
- [ ] Boundary validation tested
- [ ] CORS configuration reviewed
- [ ] Error messages don't leak sensitive info
- [ ] Security tests passing
- [ ] Code review by security team

---

## Change Log

- **2026-02-05**: Initial draft
