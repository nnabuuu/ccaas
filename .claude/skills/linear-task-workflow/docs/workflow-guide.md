# Linear-Centric Workflow Guide

## Complete Task Lifecycle

This guide walks through the complete lifecycle of a task using the Linear-centric workflow.

## Phase 1: Task Discovery & Creation

### Trigger
User describes a task requirement in natural language.

**Examples**:
- "实现 WebSocket 实时通知功能"
- "修复 session pagination 的内存泄漏"
- "添加用户头像上传功能"
- "优化数据库查询性能"

### Actions
1. **Search for duplicates**: Check recent issues to avoid duplicate creation
2. **Create Linear issue**: Use standard template with all sections
3. **Set metadata**: Team, priority, labels, status=Backlog
4. **Inform user**: Share Linear issue URL

### Output
```
✅ Created Linear issue: NIE-XX
📎 https://linear.app/niex/issue/NIE-XX/

Now let's discuss the technical approach...
```

---

## Phase 2: Technical Discussion

### Location
All technical discussions happen in:
- **Conversation**: Real-time discussion with Claude
- **Linear comments**: Key decisions and clarifications

### Topics Discussed
- Requirement clarifications
- Technical approach options
- Architecture implications
- Trade-offs and constraints

### Example Discussion Flow
```
User: "Should we use WebSocket or Server-Sent Events?"

Claude: "Let me add this discussion to Linear..."

[Adds comment to Linear issue]

## Technical Approach Discussion

**Option A**: WebSocket
- Pros: Bidirectional, widely supported
- Cons: Connection management complexity

**Option B**: Server-Sent Events (SSE)
- Pros: Simpler, built-in reconnection
- Cons: Unidirectional, less browser support

**Decision**: WebSocket - Real-time bidirectional communication is core requirement

**ADR Required**: Yes - this is an architectural decision
```

---

## Phase 3: Planning

### When
After technical approach is decided, before implementation starts.

### Actions
1. **Break down into phases**: Logical implementation steps
2. **Identify files**: Key files to create/modify
3. **Define verification**: How to test each phase
4. **Estimate effort**: Time estimates per phase
5. **Add to Linear**: Update issue with implementation plan comment

### Example Plan Comment
```markdown
## Implementation Plan

### Phase 1: Database Schema (30 min)
- [ ] Create NotificationEntity
- [ ] Create migration
- [ ] Unit tests for entity

**Files**:
- `src/notifications/entities/notification.entity.ts`
- `src/migrations/XXX-CreateNotifications.ts`

**Verification**:
```bash
npm test notification.entity.spec.ts
```

### Phase 2: WebSocket Gateway (1 hour)
- [ ] Implement NotificationGateway
- [ ] Handle connection lifecycle
- [ ] Integration tests

**Files**:
- `src/notifications/notification.gateway.ts`
- `src/notifications/notification.gateway.spec.ts`

**Verification**:
```bash
npm test notification.gateway.spec.ts
wscat -c ws://localhost:3001/notifications
```

### Total Estimate: 2.5 hours
```

### Linear Status Update
Backlog → **In Progress**

---

## Phase 4: Implementation

### Workflow
```
For each phase:
  1. Implement code
  2. Write tests
  3. Run tests
  4. Commit with Linear reference
  5. Add milestone comment to Linear
```

### Milestone Comment Timing
Add milestone comment when:
- ✅ Major phase completed
- 🐛 Significant problem encountered and resolved
- 📊 Key metric validated (performance, coverage, etc.)
- ⚠️ Approach changed (different from plan)

### Example Milestone Comment
```markdown
## ✅ Phase 1 Complete (2026-02-17 14:30)

**Completed Work**:
- ✅ NotificationEntity created with all fields
- ✅ Migration generated and tested
- ✅ Unit tests passing (12 tests, 100% coverage)

**Commit**: `a3f9d2c`

**Problems & Solutions**:
- **Problem**: TypeORM @CreateDateColumn not working with SQLite
- **Solution**: Used custom @BeforeInsert hook instead

**Test Output**:
```
PASS src/notifications/entities/notification.entity.spec.ts
  NotificationEntity
    ✓ should create notification with UUID
    ✓ should auto-set createdAt timestamp
    ... (10 more tests)
```

**Next Steps**: Start Phase 2 - WebSocket Gateway implementation
```

### ⚠️ Critical Rules
- ❌ **Never** create `PHASE_X_COMPLETE.md` files
- ❌ **Never** create `IMPLEMENTATION_PROGRESS.md` files
- ✅ **Always** add milestone updates to Linear comments
- ✅ **Always** include "Related: NIE-XX" in commit messages

---

## Phase 5: Code Review

### When
After implementation is complete, before declaring task done.

### Who Reviews
- Code-reviewer agent (automated)
- Manual review (if needed)
- Security-reviewer agent (for security-sensitive code)

### Review Checklist
- [ ] Code quality and patterns
- [ ] Security vulnerabilities
- [ ] Performance implications
- [ ] Test coverage adequacy
- [ ] Documentation completeness
- [ ] Backward compatibility

### Example Review Comment
```markdown
## 🔍 Code Review Complete (2026-02-17 16:00)

**Reviewed by**: Claude Code (code-reviewer agent)

**Issues Found**:
1. ✅ Fixed: Missing error handling in WebSocket disconnect
2. ✅ Fixed: Memory leak in subscription cleanup
3. ⚠️ Note: Consider adding rate limiting (non-blocking)

**Security Check**:
- ✅ No sensitive data in WebSocket messages
- ✅ Authentication verified on connection
- ✅ Input validation on all message types

**Performance Review**:
- ✅ Connection pooling implemented
- ✅ Message batching for high-frequency events
- 📊 Benchmark: 10,000 concurrent connections supported

**Test Coverage**:
- ✅ Unit tests: 45 tests, 98% coverage
- ✅ Integration tests: 12 scenarios
- ✅ E2E tests: 5 user journeys

**Review Commit**: `b4e8f1a`

---

**Overall Assessment**: ✅ Ready for merge
```

---

## Phase 6: Completion & Summary

### When
All work complete, tests passing, review approved.

### Final Summary Comment
Comprehensive summary including:
- ✅ All deliverables checklist
- 📊 Key metrics and performance data
- ✅ Verification commands and results
- 🔗 Git references (commits, PR)
- 📚 Documentation links (ADR if created)
- 🚀 Deployment notes
- 📋 Follow-up work (if any)

### Example Completion Comment
```markdown
## ✅ Implementation Complete (2026-02-17 17:00)

### Delivery Checklist
- ✅ NotificationEntity with migration
- ✅ WebSocket Gateway implementation
- ✅ Real-time notification delivery
- ✅ 45 unit tests (98% coverage)
- ✅ 12 integration tests
- ✅ 5 E2E test scenarios

### Key Metrics
- **Concurrent Connections**: Supports 10,000+ connections
- **Latency**: <50ms notification delivery (p95)
- **Test Coverage**: 98% (45 tests)
- **Breaking Changes**: None

### Verification Results

**Test Execution**:
```bash
$ npm test notifications
PASS - 45 tests passed, 0 failed
```

**Manual Verification**:
```bash
$ npm run start:dev
$ wscat -c ws://localhost:3001/notifications?token=xxx
Connected (press CTRL+C to quit)
< {"type":"welcome","data":{"userId":"123"}}
```

### Git References
- **PR**: #145 (merged)
- **Commits**:
  - `a3f9d2c` - feat(notifications): add entity and migration
  - `f7b2e9d` - feat(notifications): implement WebSocket gateway
  - `b4e8f1a` - fix(notifications): resolve memory leak in cleanup

### Documentation
- **ADR**: [ADR-0008: WebSocket for Real-Time Notifications](link)
- **API Docs**: WebSocket events documented in README
- **README**: Updated with WebSocket connection guide

### Deployment Notes
```bash
# Migration runs automatically
npm run start:prod
```

**Environment Variables**: Add `WS_PORT=3001` (defaults to HTTP port)

### Follow-up Work
- [ ] Phase 2: Add notification preferences (Q3 2026)
- [ ] Phase 3: Implement notification history API

---

**Status**: ✅ Done
**Total Time**: 2.5 hours (matched estimate)
```

### Linear Status Update
In Progress → **Done** (manual update by user)

---

## Documentation Decision Making

### When Implementation is Complete

Use this flowchart to decide if additional documentation is needed:

```
Task Complete
    ↓
Architectural decision made?
    YES → Create ADR in docs/adr/
    ↓ NO

Complex technical mechanism?
    YES → Create guide in docs/implementation/
    ↓ NO

New API endpoints?
    YES → Update Swagger + API docs
    ↓ NO

Debugging checklist valuable?
    YES → Create debug guide in docs/implementation/
    ↓ NO

Simple feature/bug fix?
    YES → Linear summary only ✅
```

### Examples

**Scenario 1: WebSocket Real-Time Notifications**
- Architectural decision: WebSocket vs SSE → **Create ADR**
- Complex mechanism: Connection lifecycle → **Create implementation guide**
- API: WebSocket events → **Update API docs**
- Result: 3 documentation artifacts + Linear summary

**Scenario 2: Fix Memory Leak in Pagination**
- No architectural decision
- No complex new mechanism
- No new API
- Result: **Linear summary only** (no additional docs)

**Scenario 3: Add Health Check Endpoint**
- No architectural decision
- Simple mechanism (standard health check)
- New API endpoint → **Update Swagger**
- Result: Swagger update + Linear summary

---

## Git Integration

### Branch Naming
```bash
git checkout -b feature/nie-61-linear-workflow-automation

# Format: <type>/<linear-id>-<description>
```

### Commit Messages
```
feat(notifications): implement WebSocket gateway

Added real-time notification delivery via WebSocket.

Key features:
- Connection authentication
- Message batching
- Auto-reconnection

Tests: 45 tests, 98% coverage

Related: NIE-61

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### PR Creation
```bash
gh pr create --title "feat(notifications): real-time WebSocket notifications [NIE-61]"
```

---

## Best Practices

### Do ✅
- Create Linear issue at task start
- Update Linear at each milestone
- Use templates for consistency
- Reference Linear in commits
- Add final summary when complete
- Create ADR for architectural decisions

### Don't ❌
- Create `PHASE_*_COMPLETE.md` files
- Create `*_IMPLEMENTATION.md` files
- Create `*_PROGRESS.md` files
- Skip milestone updates
- Forget Linear reference in commits
- Create documentation for simple tasks

---

## Troubleshooting

### Linear API Fails
```
Error: Linear API request failed

Solution:
1. Check network connection
2. Verify Linear API key in MCP config
3. Create issue manually if needed
4. Continue implementation
5. Add updates to Linear manually when API recovers
```

### Duplicate Issue Created
```
Solution:
1. Check recent issues first (list_issues with query)
2. If duplicate exists, use existing issue
3. Close/archive duplicate if accidentally created
```

### Forgot to Add Milestone Update
```
Solution:
1. Add retrospective comment to Linear
2. Include all missing milestone information
3. Mark as "[Retrospective] Phase X Complete"
```
