---
name: linear-task-workflow
slug: linear-task-workflow
description: Linear-centric task workflow automation - tracks all tasks in Linear, prevents creation of *_COMPLETE.md files
scope: global
triggers:
  - type: keyword
    value: "实现"
    priority: 15
  - type: keyword
    value: "修复"
    priority: 15
  - type: keyword
    value: "添加"
    priority: 15
  - type: keyword
    value: "优化"
    priority: 14
  - type: keyword
    value: "重构"
    priority: 14
  - type: pattern
    value: "需要.*(功能|特性|改进)"
    priority: 14
allowedTools:
  - mcp__linear-server__create_issue
  - mcp__linear-server__create_comment
  - mcp__linear-server__update_issue
  - mcp__linear-server__list_issues
  - mcp__linear-server__get_issue
---

# Linear-Centric Task Workflow

## Overview

This skill automates a Linear-centric workflow, ensuring every task is tracked in Linear throughout its entire lifecycle. It eliminates the need for `*_COMPLETE.md`, `PHASE_*.md`, and similar tracking files in the codebase.

**Core Principle**: Linear is the single source of truth for task tracking, progress updates, and completion summaries.

## When This Skill Activates

This skill **automatically activates** (no explicit command needed) when:

1. **User describes a new task**:
   - "实现 XX 功能"
   - "修复 XX 问题"
   - "添加 XX 特性"
   - "优化 XX 性能"
   - "重构 XX 模块"

2. **User enters Plan mode**: Check if Linear issue exists for the current task

3. **Major milestone reached**: Update Linear with progress

4. **Code review completed**: Record review results in Linear

5. **Task completed**: Add final summary to Linear

## Execution Flow

### Phase 1: Task Start - Create Linear Issue

**When**: User describes a new task requirement

**Steps**:

1. **Check for existing issue** (avoid duplicates):
   ```typescript
   const recentIssues = await linear.list_issues({
     assignee: "me",
     query: "[extract key terms from user request]",
     limit: 5,
     orderBy: "updatedAt"
   })
   ```

2. **If no recent issue exists, create new issue**:
   - Use `templates/issue-template.md` as the base structure
   - Fill in:
     - Title: Concise description of task
     - Description: Use template format (需求描述, 背景与动机, 验收标准, 技术考量)
     - Team: "Niex"
     - Priority: Based on urgency (1=Urgent, 2=High, 3=Normal, 4=Low)
     - Labels: `["type:feature/bug/refactor", "area:backend/frontend/...", "effort:small/medium/large"]`
     - Status: Backlog

3. **Inform user**:
   ```
   ✅ Created Linear issue: NIE-XX
   📎 https://linear.app/niex/issue/NIE-XX/

   Now let's discuss the technical approach...
   ```

### Phase 2: Plan Phase - Update Linear with Implementation Plan

**When**: After Plan mode completes (user approves the plan)

**Steps**:

1. **Add comment with implementation plan**:
   - Use `templates/milestone-comment.md` format
   - Include:
     - Phases breakdown (Phase 1, 2, 3... with time estimates)
     - Key files to be modified/created
     - Verification steps
     - Testing strategy

2. **Update issue status**:
   ```typescript
   await linear.update_issue({
     id: issueId,
     status: "In Progress"
   })
   ```

3. **Inform user**:
   ```
   ✅ Updated Linear issue NIE-XX with implementation plan
   📋 Status: Backlog → In Progress
   ```

### Phase 3: Implementation - Milestone Updates

**When**: Key milestones reached during implementation (e.g., Phase 1 complete, Phase 2 complete)

**Steps**:

1. **Add milestone comment**:
   - Use `templates/milestone-comment.md` format
   - Include:
     - ✅ Completed work
     - 🔗 Commit hash
     - 🐛 Problems encountered and solutions
     - 📝 Next steps

2. **Example comment**:
   ```markdown
   ## ✅ Phase 1 Complete (2026-02-17 15:30)

   **Completed**:
   - ✅ Session entity created
   - ✅ Migration file generated
   - ✅ Unit tests passing (15 tests)

   **Commit**: `62294fa`

   **Problems & Solutions**:
   - Issue: TypeORM UUID generation incompatible with SQLite
   - Solution: Used SQLite's randomblob() function

   **Next**: Start Phase 2 - Service layer implementation
   ```

**⚠️ CRITICAL**: Never create `PHASE_X_COMPLETE.md` files. All progress tracking goes in Linear comments.

### Phase 4: Code Review - Record Review Results

**When**: Code review completed (by code-reviewer agent or manual review)

**Steps**:

1. **Add review comment**:
   - Use `templates/review-comment.md` format
   - Include:
     - 🔍 Issues found and fixes
     - 🔒 Security checks
     - ⚡ Performance review
     - 🧪 Test coverage verification

2. **Example comment**:
   ```markdown
   ## 🔍 Code Review Complete (2026-02-17 16:00)

   **Reviewed by**: Claude Code (code-reviewer agent)

   **Issues Found**:
   1. ✅ Fixed: Hardcoded path depth → monorepo root detection
   2. ✅ Fixed: Missing package.json consistency

   **Security**:
   - ✅ No SQL injection risk (parameterized queries)
   - ✅ Tenant ownership check prevents cross-tenant access

   **Performance**:
   - ✅ Indexes correctly used
   - ✅ Batch queries avoid N+1 problem

   **Commit**: `a4b3c2d`
   ```

### Phase 5: Task Completion - Final Summary

**When**: All work completed, tests passing, ready to close

**Steps**:

1. **Add final summary comment**:
   - Use `templates/completion-comment.md` format
   - Include:
     - ✅ Delivery checklist
     - 📊 Key metrics (performance, coverage, etc.)
     - ✅ Verification results
     - 🔗 Git references (commits, PR)
     - 📚 Documentation links (ADR/guides if created)
     - 🚀 Deployment notes (if applicable)
     - 📋 Follow-up work (if any)

2. **Remind user to update status**:
   ```
   ✅ Task implementation complete!

   Please update Linear issue status:
   https://linear.app/niex/issue/NIE-XX/

   Status: In Progress → Done

   Summary added to Linear with:
   - Delivery checklist
   - Performance metrics
   - Verification results
   - Git references
   ```

**⚠️ CRITICAL**: Never create summary files like `IMPLEMENTATION_COMPLETE.md`, `FEATURE_SUMMARY.md`, etc. All summaries go in Linear final comment.

## Documentation Decision Tree

When task is complete, decide if additional documentation is needed:

```
Task Complete
    ↓
Is this an architectural decision?
    YES → Create ADR in docs/adr/
    Example: "Chose WebSocket over HTTP polling for real-time sync"
    ↓ NO

Is this a complex technical mechanism?
    YES → Create implementation guide in docs/implementation/
    Example: "WebSocket connection management step-by-step"
    ↓ NO

Is this an API specification?
    YES → Update Swagger + API docs
    Example: "New REST endpoint specification"
    ↓ NO

Is this a reusable debugging checklist?
    YES → Create debug guide in docs/implementation/
    Example: "Troubleshooting session pagination issues"
    ↓ NO

Simple feature/bugfix?
    YES → Linear summary + Git commits only ✅
    No additional docs needed
```

**❌ Never Create**:
- `PHASE_X_COMPLETE.md` - Use Linear comments
- `FEATURE_IMPLEMENTATION.md` - Use Linear comments
- `BUGFIX_SUMMARY.md` - Use Linear comments
- `TASK_PROGRESS.md` - Use Linear issue status
- `MILESTONE_*.md` - Use Linear comments

**✅ Only Create When Necessary**:
- `docs/adr/NNNN-decision-title.md` - For architectural decisions
- `docs/implementation/feature-guide.md` - For complex technical mechanisms
- `docs/api/endpoint-spec.md` - For API specifications

## Commit Message Integration

All commits should reference the Linear issue:

```
<type>(<scope>): <subject>

<body>

Related: NIE-XX

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Examples**:
```
feat(backend): add pagination support for admin sessions

Implemented database-backed pagination with dual-write pattern.

Related: NIE-61

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Branch Naming Convention

Create branches that auto-link to Linear:

```bash
git checkout -b feature/nie-61-linear-workflow-automation

# Format: <type>/<linear-id>-<description>
# type: feature | fix | refactor | docs
# linear-id: NIE-61 (Linear issue identifier)
# description: kebab-case description
```

## Error Handling

**If Linear API fails**:
1. Inform user of the failure
2. Suggest manual Linear issue creation
3. Continue with implementation
4. Remind user to update Linear manually at milestones

**If duplicate issue detected**:
1. Show user the existing issue
2. Ask if they want to:
   - Use existing issue
   - Create new issue
   - Cancel

## Examples

### Example 1: New Feature

**User**: "实现 WebSocket 实时通知功能"

**Skill Actions**:
1. ✅ Create Linear issue NIE-XX with template
2. 💬 Discuss technical approach in conversation
3. 📝 After Plan: Add implementation plan comment to Linear
4. 🔧 During implementation: Add milestone comments
5. 🔍 After review: Add review results comment
6. ✅ At completion: Add final summary comment
7. 🚫 Never create `WEBSOCKET_IMPLEMENTATION.md`

**Result**: Complete task history in Linear, clean codebase

### Example 2: Bug Fix

**User**: "修复 session pagination 的内存泄漏"

**Skill Actions**:
1. ✅ Create Linear issue NIE-XX (type:bug)
2. 💬 Root cause analysis in conversation
3. 🔧 After fix: Add summary comment to Linear
4. 🔗 Commit: "fix(backend): resolve memory leak. Related: NIE-XX"
5. 🚫 Never create `BUGFIX_MEMORY_LEAK.md`

**Result**: Bug tracked and resolved in Linear, no extra files

### Example 3: Refactoring with ADR

**User**: "将 session 存储从内存迁移到数据库"

**Skill Actions**:
1. ✅ Create Linear issue NIE-XX (type:refactor)
2. 💬 Discuss migration strategy
3. 📝 After Plan: Add implementation plan to Linear
4. 🔧 During implementation: Milestone updates in Linear
5. 📚 **Create ADR**: `docs/adr/0007-dual-write-session-storage.md` (architectural decision)
6. ✅ Final summary in Linear **includes ADR link**
7. 🚫 Never create `MIGRATION_COMPLETE.md`

**Result**: Linear tracks progress, ADR documents architecture decision, no redundant files

## Templates Location

All templates are in `.claude/skills/linear-task-workflow/templates/`:

- `issue-template.md` - Initial Linear issue structure
- `milestone-comment.md` - Progress update format
- `review-comment.md` - Code review results format
- `completion-comment.md` - Final summary format

## Additional Documentation

For detailed workflow guides and examples, see:

- `docs/workflow-guide.md` - Complete workflow walkthrough
- `docs/decision-tree.md` - When to create documentation
- `docs/examples.md` - Real-world scenarios

## Skill Maintenance

**When to update this skill**:
- Linear API changes
- New workflow phases needed
- Template improvements
- Trigger refinements

**Testing this skill**:
Use a simple test task to verify:
1. Linear issue auto-creation
2. Comment additions at each phase
3. No `*_COMPLETE.md` files created
4. Commit messages include "Related: NIE-XX"
