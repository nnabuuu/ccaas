# Workflow Examples

Real-world scenarios demonstrating the Linear-centric workflow in action.

---

## Example 1: Simple Feature Addition

### Scenario
User requests: "添加用户最后登录时间显示"

### Workflow

#### 1. Task Start
```
✅ Created Linear issue: NIE-62
📎 https://linear.app/niex/issue/NIE-62/

Title: Add last login time display for users
Labels: type:feature, area:frontend, effort:small
Status: Backlog
```

**Linear Issue Description**:
```markdown
## 需求描述
在用户列表页面显示每个用户的最后登录时间

## 背景与动机
管理员需要了解用户活跃度，最后登录时间是重要指标

## 验收标准
- [ ] 用户列表显示 lastLoginAt 字段
- [ ] 时间格式为相对时间（"2 hours ago"）
- [ ] Hover 显示完整时间戳
- [ ] 未登录过的用户显示 "Never"

## 技术考量
### 架构影响
- 无架构变更
- 使用现有 User entity

### 相关文件
- `src/components/UserList.tsx`
- `src/hooks/useUsers.ts`

### 测试策略
- 单元测试: UserList 组件渲染
- 快照测试: 时间格式化
```

#### 2. Implementation
直接实现（无需 Plan 阶段，因为简单）:

```typescript
// src/components/UserList.tsx
<TableCell>
  {user.lastLoginAt
    ? formatRelativeTime(user.lastLoginAt)
    : 'Never'}
</TableCell>
```

**Commit**:
```
feat(frontend): display last login time in user list

Added relative time display with hover tooltip for exact timestamp.

Related: NIE-62

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

#### 3. Completion
**Linear Comment**:
```markdown
## ✅ Implementation Complete (2026-02-17 11:00)

### Delivery Checklist
- ✅ lastLoginAt field displayed in user list
- ✅ Relative time format ("2 hours ago")
- ✅ Hover tooltip shows exact timestamp
- ✅ "Never" displayed for users who haven't logged in
- ✅ 8 unit tests added
- ✅ Snapshot tests passing

### Key Metrics
- **Test Coverage**: 8 tests, 100% coverage for new code
- **Breaking Changes**: None

### Verification Results
```bash
$ npm test UserList.test.tsx
PASS - 8 tests passed
```

**Manual Verification**: Checked in browser, all formats correct

### Git References
- **Commit**: `f3a7b2d`
- **PR**: #146 (merged)

### Documentation
No additional documentation needed - standard UI feature

---

**Status**: ✅ Done
**Total Time**: 30 minutes
```

**Files Created in Repo**: 0 (no documentation files)
**Documentation Location**: Linear issue only ✅

---

## Example 2: Bug Fix with Root Cause Analysis

### Scenario
User reports: "修复 WebSocket 连接在 Safari 中频繁断开的问题"

### Workflow

#### 1. Task Start
```
✅ Created Linear issue: NIE-63
📎 https://linear.app/niex/issue/NIE-63/

Title: Fix WebSocket connection drops in Safari
Labels: type:bug, area:backend, priority:high, effort:medium
Status: In Progress (immediately)
```

#### 2. Investigation
**Linear Comment** (Root Cause Analysis):
```markdown
## 🔍 Root Cause Investigation (2026-02-17 14:00)

### Symptoms
- WebSocket connections drop every 60 seconds in Safari
- Chrome and Firefox work fine
- Reconnection works but disrupts user experience

### Investigation Steps
1. ✅ Checked server-side keepalive: Configured correctly
2. ✅ Checked Safari console: No obvious errors
3. ✅ Network tab: Connection reset by peer after 60s
4. ✅ Server logs: No errors, clean disconnect

### Root Cause
**Safari's aggressive timeout policy**:
- Safari closes "idle" WebSocket connections after 60s
- Server ping interval: 90s (too long!)
- Chrome/Firefox tolerate longer intervals

### Solution
Change ping interval from 90s → 30s

**Files to modify**:
- `src/websocket/websocket.gateway.ts` (pingInterval config)

**Testing**:
- Manual: Keep Safari connection open for 5 minutes
- Automated: Mock Safari timeout behavior
```

#### 3. Implementation
**Commit**:
```
fix(websocket): reduce ping interval for Safari compatibility

Changed ping interval from 90s to 30s to prevent Safari from
closing idle WebSocket connections.

Root cause: Safari's aggressive 60s idle timeout.

Tested: 5+ minute connections stable in Safari, Chrome, Firefox.

Related: NIE-63

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

#### 4. Completion
**Linear Comment**:
```markdown
## ✅ Bug Fix Complete (2026-02-17 14:30)

### Delivery Checklist
- ✅ Ping interval changed to 30s
- ✅ Tested in Safari, Chrome, Firefox
- ✅ 5+ minute connections stable
- ✅ Unit tests updated
- ✅ Integration tests passing

### Root Cause
Safari closes "idle" WebSocket connections after 60s. Previous ping interval (90s) was too long.

### Fix
Reduced ping interval: 90s → 30s

### Verification Results
**Manual Testing**:
- ✅ Safari: 5+ min stable
- ✅ Chrome: 5+ min stable
- ✅ Firefox: 5+ min stable

**Automated Testing**:
```bash
$ npm test websocket.gateway.spec.ts
PASS - 12 tests passed
```

### Performance Impact
- Bandwidth increase: ~120 bytes/min per connection (negligible)
- CPU impact: Minimal (~0.1% increase)

### Git References
- **Commit**: `d9e4f3a`
- **PR**: #147 (merged)

---

**Status**: ✅ Done
**Total Time**: 30 minutes
```

**Files Created in Repo**: 0 (no documentation files)
**Documentation Location**: Linear issue only ✅

---

## Example 3: Feature with Architectural Decision

### Scenario
User requests: "实现数据导出功能，支持 CSV 和 Excel 格式"

### Workflow

#### 1. Task Start
```
✅ Created Linear issue: NIE-64
📎 https://linear.app/niex/issue/NIE-64/

Title: Implement data export (CSV/Excel)
Labels: type:feature, area:backend, effort:large
Status: Backlog
```

#### 2. Technical Discussion
**Linear Comment**:
```markdown
## Technical Approach Discussion (2026-02-17 15:00)

### Export Format Options

**Option A**: Generate files server-side
- Pros: More control, can handle large datasets
- Cons: Server memory usage, slower for small exports

**Option B**: Generate files client-side
- Pros: Offload work to client, faster for small exports
- Cons: Limited dataset size, browser compatibility

**Option C**: Hybrid approach
- Small exports (<1000 rows): Client-side
- Large exports (>1000 rows): Server-side with streaming

### Decision: Option C (Hybrid)

**Rationale**:
- Best UX for small exports (instant)
- Handles large exports efficiently
- Progressive enhancement

**ADR Required**: Yes - this is an architectural decision
**ADR Title**: "Hybrid Client/Server Data Export Strategy"
```

#### 3. Plan Phase
**Linear Comment**:
```markdown
## Implementation Plan (2026-02-17 15:15)

### Phase 1: Client-Side Export (Small Datasets) - 2 hours
- [ ] CSV generation utility
- [ ] Excel generation (using xlsx library)
- [ ] Trigger mechanism (<1000 rows)
- [ ] Unit tests

**Files**:
- `src/utils/export/csv-generator.ts`
- `src/utils/export/excel-generator.ts`
- `src/hooks/useDataExport.ts`

### Phase 2: Server-Side Export (Large Datasets) - 3 hours
- [ ] Export queue service
- [ ] Streaming CSV generation
- [ ] Streaming Excel generation
- [ ] Progress tracking
- [ ] Integration tests

**Files**:
- `src/export/export.service.ts`
- `src/export/export.controller.ts`
- `src/export/export-queue.service.ts`

### Phase 3: UI Integration - 1 hour
- [ ] Export button with format selector
- [ ] Progress indicator for large exports
- [ ] Download link delivery
- [ ] E2E tests

**Files**:
- `src/components/ExportButton.tsx`
- `src/components/ExportProgress.tsx`

### Total Estimate: 6 hours

### Verification
```bash
# Small export (client-side)
click "Export CSV" → instant download

# Large export (server-side)
click "Export Excel (10K rows)" → progress bar → download link
```
```

#### 4. Implementation Milestones
**Milestone 1**:
```markdown
## ✅ Phase 1 Complete (2026-02-17 17:00)

**Completed**:
- ✅ CSV generator utility
- ✅ Excel generator (using xlsx)
- ✅ useDataExport hook with <1000 row detection
- ✅ 15 unit tests (100% coverage)

**Commit**: `a8f3d2e`

**Test Results**:
```
PASS src/utils/export/csv-generator.test.ts
PASS src/utils/export/excel-generator.test.ts
PASS src/hooks/useDataExport.test.ts
```

**Next**: Phase 2 - Server-side export service
```

**Milestone 2**:
```markdown
## ✅ Phase 2 Complete (2026-02-17 19:30)

**Completed**:
- ✅ Export queue service with Redis
- ✅ Streaming CSV/Excel generation
- ✅ Progress tracking via WebSocket
- ✅ 22 integration tests

**Commit**: `f9a7d3b`

**Performance**:
- 100K rows: 45 seconds (CSV), 90 seconds (Excel)
- Memory: Constant ~50MB (streaming)

**Next**: Phase 3 - UI integration
```

**Milestone 3**:
```markdown
## ✅ Phase 3 Complete (2026-02-17 20:15)

**Completed**:
- ✅ Export button with format dropdown
- ✅ Progress indicator (real-time updates)
- ✅ Download link in notification
- ✅ 5 E2E tests

**Commit**: `c4e8a2d`

**Next**: Code review
```

#### 5. Code Review
**Linear Comment**:
```markdown
## 🔍 Code Review Complete (2026-02-17 20:45)

**Reviewed by**: Claude Code (code-reviewer agent)

**Issues Found**:
1. ✅ Fixed: Memory leak in streaming generator
2. ✅ Fixed: Missing error handling for unsupported formats
3. ⚠️ Note: Consider adding XLSX compression (future enhancement)

**Security**:
- ✅ Path traversal prevention in file names
- ✅ File size limits enforced
- ✅ Rate limiting on export endpoint

**Performance**:
- ✅ Streaming prevents memory issues
- ✅ Redis queue handles concurrent exports
- 📊 Benchmark: 100K rows in <90s

**Test Coverage**:
- ✅ Unit: 37 tests, 98% coverage
- ✅ Integration: 22 tests
- ✅ E2E: 5 scenarios

**Review Commit**: `b2f9e1c`

---

**Overall**: ✅ Ready for merge
```

#### 6. Create ADR
**File**: `docs/adr/0009-hybrid-data-export.md`

```markdown
# ADR-0009: Hybrid Client/Server Data Export Strategy

## Status
Accepted

## Context
Need to implement data export in CSV and Excel formats. Datasets range from 100 rows to 100,000+ rows.

## Decision
Implement hybrid approach:
- **Small exports (<1000 rows)**: Client-side generation (instant)
- **Large exports (≥1000 rows)**: Server-side streaming (efficient)

## Consequences
**Positive**:
- Best UX for common case (small exports)
- Scalable for large datasets
- No server load for small exports

**Negative**:
- More complex implementation
- Two code paths to maintain

**Risks**:
- Threshold tuning needed
- Browser compatibility for client-side generation

## Alternatives Considered
1. **Server-only**: Simpler but slower for small exports
2. **Client-only**: Faster but limited dataset size
```

#### 7. Completion
**Linear Comment**:
```markdown
## ✅ Implementation Complete (2026-02-17 21:00)

### Delivery Checklist
- ✅ Client-side CSV/Excel generation (<1000 rows)
- ✅ Server-side streaming export (≥1000 rows)
- ✅ Progress tracking via WebSocket
- ✅ Export queue with Redis
- ✅ 37 unit tests (98% coverage)
- ✅ 22 integration tests
- ✅ 5 E2E tests
- ✅ ADR documented

### Key Metrics
- **Small Exports**: Instant (<100ms)
- **Large Exports**: 100K rows in <90s
- **Memory**: Constant ~50MB (streaming)
- **Test Coverage**: 98% (37 unit + 22 integration + 5 E2E)
- **Breaking Changes**: None

### Verification Results
**Small Export**:
```bash
Click "Export CSV" (500 rows)
→ Instant download ✅
```

**Large Export**:
```bash
Click "Export Excel" (100K rows)
→ Progress bar: 0% ... 50% ... 100%
→ Notification: "Export ready"
→ Download link active ✅
```

### Git References
- **PR**: #148 (merged)
- **Commits**:
  - `a8f3d2e` - Phase 1: Client-side generation
  - `f9a7d3b` - Phase 2: Server-side streaming
  - `c4e8a2d` - Phase 3: UI integration
  - `b2f9e1c` - Code review fixes

### Documentation
- **ADR**: [ADR-0009: Hybrid Data Export Strategy](../docs/adr/0009-hybrid-data-export.md)
- **API Docs**: Updated Swagger with export endpoints
- **README**: Added export feature documentation

### Deployment Notes
```bash
# Requires Redis for export queue
docker-compose up -d redis

# Environment variables
EXPORT_QUEUE_REDIS_URL=redis://localhost:6379
EXPORT_THRESHOLD=1000
EXPORT_MAX_SIZE=1000000
```

### Follow-up Work
- [ ] Add XLSX compression (reduce file size 30%)
- [ ] Support JSON export format
- [ ] Export templates/presets

---

**Status**: ✅ Done
**Total Time**: 6 hours (matched estimate)
```

**Files Created in Repo**:
1. ✅ `docs/adr/0009-hybrid-data-export.md` (ADR - architectural decision)
2. ✅ Updated Swagger spec (API documentation)

**Documentation Location**: Linear issue + ADR + API docs ✅

---

## Example 4: Refactoring with Complex Mechanism

### Scenario
User requests: "重构 session 存储，从内存迁移到数据库，使用双写模式确保零停机"

### Workflow

(Similar to Example 3, but creates Implementation Guide instead of ADR)

**Files Created in Repo**:
1. ✅ `docs/adr/0007-dual-write-session-storage.md` (architectural decision)
2. ✅ `docs/implementation/session-migration-guide.md` (complex mechanism)
3. ✅ `docs/implementation/debugging-session-migration.md` (troubleshooting)

**Why Multiple Docs**:
- **ADR**: Architectural decision (memory → database)
- **Implementation Guide**: Complex dual-write mechanism
- **Debug Guide**: Reusable troubleshooting checklist

---

## Example 5: Simple Bug Fix (No Extra Docs)

### Scenario
User reports: "修复用户名输入框的 trim 问题"

### Workflow

#### Complete Flow (Summary)
1. Create Linear issue NIE-65
2. Identify problem: Input not trimmed before validation
3. Fix: Add `.trim()` before validation
4. Test: 3 unit tests
5. Commit with "Related: NIE-65"
6. Add completion summary to Linear
7. Close issue

**Files Created in Repo**: 0
**Documentation Location**: Linear issue only ✅

**Linear Summary**:
```markdown
## ✅ Bug Fix Complete

### Problem
Username input not trimmed, leading to validation errors with spaces.

### Fix
Added `.trim()` before validation in `UserForm.tsx`

### Verification
```bash
$ npm test UserForm.test.tsx
PASS - 3 tests passed
```

**Commit**: `d8a3f1b`

---

**Status**: ✅ Done
**Time**: 10 minutes
```

---

## Comparison: Old vs New Workflow

### Old Workflow (❌ Anti-Pattern)

```
User: "实现 WebSocket 通知"

Claude:
1. Implements feature
2. Creates WEBSOCKET_IMPLEMENTATION.md
3. Creates PHASE_1_COMPLETE.md
4. Creates PHASE_2_COMPLETE.md
5. Creates WEBSOCKET_TESTING.md
6. Maybe updates Linear (manual)

Result:
- 4 documentation files in repo ❌
- Linear not updated or incomplete ❌
- Information scattered ❌
- No single source of truth ❌
```

### New Workflow (✅ Correct Pattern)

```
User: "实现 WebSocket 通知"

Claude:
1. ✅ Creates Linear issue NIE-XX automatically
2. 💬 Discusses approach (in conversation)
3. 📝 Adds implementation plan to Linear
4. 🔧 Implements with milestone updates in Linear
5. 🔍 Adds review results to Linear
6. ✅ Adds final summary to Linear
7. 📚 Creates ADR (architectural decision)
8. 🔗 References ADR in Linear summary

Result:
- 1 documentation file (ADR) ✅
- Linear has complete history ✅
- Single source of truth ✅
- Clean codebase ✅
```

---

## Key Takeaways

### Always ✅
- Create Linear issue at task start
- Update Linear at each milestone
- Add comprehensive final summary to Linear
- Reference Linear in all commits
- Create ADR for architectural decisions
- Create guides for complex mechanisms

### Never ❌
- Create `PHASE_*_COMPLETE.md`
- Create `*_IMPLEMENTATION.md` for simple features
- Create `*_PROGRESS.md`
- Duplicate task tracking outside Linear
- Skip Linear updates
- Forget "Related: NIE-XX" in commits

### Result
- **Linear**: Complete task history
- **Code Repo**: Clean, focused, valuable documentation only
- **Single Source of Truth**: Linear issues
- **Easy Onboarding**: New team members check Linear first
