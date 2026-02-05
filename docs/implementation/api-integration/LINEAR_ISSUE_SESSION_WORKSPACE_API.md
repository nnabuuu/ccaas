# Linear Issue: Session Workspace File API

**Project:** CCAAS
**Status:** Backlog
**Priority:** High
**Assignee:** TBD

---

## Title

Add REST API for Session Workspace File Access

---

## Description

Implement REST API endpoints to access any file in CCAAS session workspaces (tracked or untracked) with nested path support, enabling File Explorer UI development.

**Problem:**
- Currently only tracked files (in database) are accessible via REST API
- Untracked files stuck in session workspace with no API access
- Cannot build comprehensive File Explorer UI

**Solution:**
- Add `GET /api/v1/sessions/:sessionId/workspace/*` (download file)
- Add `GET /api/v1/sessions/:sessionId/workspace` (list files as tree)
- Multi-layer security validation (path traversal prevention)
- Enable File Explorer UI component for ccaas-demo

---

## Acceptance Criteria

### Backend (CCAAS)

- [ ] Add `getWorkspaceFile()` method to SessionService
- [ ] Add `getWorkspaceTree()` method to SessionService
- [ ] Add wildcard download endpoint to SessionsController
- [ ] Add tree listing endpoint to SessionsController
- [ ] Implement path sanitization and security validation
- [ ] Create FileTreeNode TypeScript interface
- [ ] Write unit tests (path traversal, null bytes, symlinks)
- [ ] Write integration tests (E2E endpoint testing)
- [ ] Write security test suite
- [ ] Pass security review

### Frontend (ccaas-demo)

- [ ] Create FileExplorer component
- [ ] Create FileTree component
- [ ] Create useWorkspaceFiles API hook
- [ ] Add file type icons
- [ ] Add folder collapse/expand functionality
- [ ] Test download functionality
- [ ] Add loading and error states
- [ ] Style with design system

### Documentation

- [ ] Update API documentation
- [ ] Add security notes to README
- [ ] Document FileExplorer component
- [ ] Add usage examples
- [ ] Update gitbook

---

## Technical Details

**Endpoints:**
```
GET /api/v1/sessions/:sessionId/workspace        # List files
GET /api/v1/sessions/:sessionId/workspace/*      # Download file
```

**Security:**
- Path traversal prevention (normalize + boundary check)
- Symlink rejection
- Null byte injection prevention
- Session isolation

**Files to Modify:**
- `packages/backend/src/chat/session.service.ts`
- `packages/backend/src/sessions/sessions.controller.ts`
- `packages/backend/src/common/interfaces.ts`
- `packages/backend/src/chat/session.service.spec.ts`
- `packages/backend/test/integration/workspace-files.e2e.spec.ts` (new)

---

## Related Documents

- Design Doc: `/docs/design/session-workspace-file-api.md`
- Implementation Plan: `~/.claude/plans/tranquil-plotting-tiger.md`
- Integration Summary: `/CCAAS_FILE_SERVICE_INTEGRATION.md`

---

## Estimated Effort

- Backend Implementation: 3-4 days
- Frontend Implementation: 3-4 days
- Testing & Security Review: 2 days
- Documentation: 1 day

**Total:** 9-11 days (1.5-2 sprint cycles)

---

## Dependencies

- None (standalone feature)
- Nice-to-have: File upload endpoint (future enhancement)

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Path traversal vulnerability | Critical | Multi-layer validation, security tests |
| Performance with large workspaces | Medium | Streaming, lazy loading |
| Session cleanup race condition | Low | Existence check before operations |

---

## Testing Plan

### Unit Tests
- Path sanitization edge cases
- Security validation (traversal, symlinks, null bytes)
- Tree building logic
- MIME type detection

### Integration Tests
- End-to-end download flow
- Tree listing
- Error handling (404, 400)
- CORS validation

### Security Tests
- Attack vector suite (6+ scenarios)
- Boundary validation
- Session isolation

---

## Success Metrics

- [ ] All security tests passing
- [ ] 100% unit test coverage for security methods
- [ ] Integration tests passing
- [ ] File Explorer UI functional in ccaas-demo
- [ ] No path traversal vulnerabilities in security audit
- [ ] Performance: Tree loads in <500ms for typical workspaces
- [ ] Zero production incidents related to file access

---

## Labels

`feature`, `api`, `security`, `ccaas`, `file-system`, `high-priority`

---

## Linked Issues

- Related to: File Explorer UI Component (TBD - create separate issue)
- Blocks: File Upload API (future)
- Related to: CCAAS File Service Integration (completed)
