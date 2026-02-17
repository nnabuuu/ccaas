# Documentation Decision Tree

## When to Create Code Documentation

This decision tree helps determine what documentation (if any) should be created in the code repository when a task is complete.

**Core Principle**: Linear is for task tracking and progress. Code repo is for architecture decisions, technical mechanisms, and API specifications.

---

## The Decision Tree

```
┌─────────────────────────────────────┐
│   Task Implementation Complete      │
│   All tests passing                 │
└──────────────┬──────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Architectural        │
    │ Decision Made?       │
    └──────┬───────────────┘
           │
    ┌──────┴──────┐
    │             │
   YES           NO
    │             │
    │             ▼
    │      ┌──────────────────────┐
    │      │ Complex Technical    │
    │      │ Mechanism?           │
    │      └──────┬───────────────┘
    │             │
    │      ┌──────┴──────┐
    │      │             │
    │     YES           NO
    │      │             │
    │      │             ▼
    │      │      ┌──────────────────────┐
    │      │      │ New API              │
    │      │      │ Specification?       │
    │      │      └──────┬───────────────┘
    │      │             │
    │      │      ┌──────┴──────┐
    │      │      │             │
    │      │     YES           NO
    │      │      │             │
    │      │      │             ▼
    │      │      │      ┌──────────────────────┐
    │      │      │      │ Reusable Debugging   │
    │      │      │      │ Checklist?           │
    │      │      │      └──────┬───────────────┘
    │      │      │             │
    │      │      │      ┌──────┴──────┐
    │      │      │      │             │
    │      │      │     YES           NO
    │      │      │      │             │
    ▼      ▼      ▼      ▼             ▼
┌──────┐┌──────┐┌──────┐┌──────┐ ┌──────────┐
│ ADR  ││Guide ││ API  ││Debug │ │ Linear   │
│      ││      ││ Docs ││Guide │ │ Summary  │
│      ││      ││      ││      │ │ Only     │
└──────┘└──────┘└──────┘└──────┘ └──────────┘
```

---

## Decision Points

### 1. Architectural Decision?

**Question**: Did this task require choosing between fundamentally different architectural approaches?

**Examples of YES**:
- Chose WebSocket over HTTP polling for real-time features
- Chose monorepo over polyrepo structure
- Chose microservices over monolith
- Chose event sourcing over CRUD
- Chose SQL over NoSQL for primary datastore

**Examples of NO**:
- Fixed a bug in existing code
- Added a new endpoint using existing patterns
- Refactored code without changing architecture
- Improved performance using existing architecture

**If YES → Create ADR** (`docs/adr/NNNN-decision-title.md`)

---

### 2. Complex Technical Mechanism?

**Question**: Does this implementation involve a complex technical mechanism that others need to understand?

**Characteristics of Complex Mechanisms**:
- Multi-step process with non-obvious ordering
- Requires specific configuration or setup
- Involves multiple components working together
- Has edge cases that need explanation
- Could benefit from step-by-step guide

**Examples of YES**:
- WebSocket connection lifecycle management
- Database migration strategy (dual-write pattern)
- OAuth authentication flow implementation
- Complex state machine logic
- Custom caching strategy with invalidation

**Examples of NO**:
- Standard CRUD operations
- Simple helper functions
- Straightforward bug fixes
- Standard library usage
- Basic data transformations

**If YES → Create Implementation Guide** (`docs/implementation/mechanism-name.md`)

---

### 3. New API Specification?

**Question**: Did this task create or significantly modify API endpoints?

**What Qualifies**:
- New REST endpoints
- New GraphQL queries/mutations
- New WebSocket events
- New RPC methods
- Breaking changes to existing APIs

**Examples of YES**:
- Added POST /api/v1/notifications endpoint
- Changed authentication mechanism
- Added new WebSocket event types
- Deprecated old API version

**Examples of NO**:
- Internal function signatures changed
- Database schema updated (not API-level)
- Frontend component props changed
- Internal service methods updated

**If YES → Update API Documentation**:
- Update Swagger/OpenAPI spec
- Update API documentation in `docs/api/`
- Update client SDK if applicable
- Update README with API examples

---

### 4. Reusable Debugging Checklist?

**Question**: Did you encounter problems that future developers might also face?

**Characteristics of Reusable Checklists**:
- Common failure modes identified
- Diagnostic steps documented
- Solutions to typical problems
- Troubleshooting workflow
- Tool-specific gotchas

**Examples of YES**:
- Troubleshooting WebSocket connection failures
- Debugging TypeORM migration issues
- Resolving CORS configuration problems
- Fixing performance bottlenecks in queries
- Handling deployment-specific issues

**Examples of NO**:
- One-time typo fix
- Obvious error messages
- Well-documented library issues
- Straightforward debugging

**If YES → Create Debug Guide** (`docs/implementation/debugging-feature.md`)

---

### 5. Simple Task?

**Question**: If none of the above apply, is this a simple feature, bug fix, or refactor?

**If YES → Linear Summary Only**:
- Add comprehensive summary to Linear issue
- No additional documentation in code repo
- Commit messages provide implementation details
- Code comments explain complex logic

---

## Output Formats

### ADR (Architectural Decision Record)

**Location**: `docs/adr/NNNN-decision-title.md`

**Structure**:
```markdown
# ADR-NNNN: Decision Title

## Status
Accepted | Proposed | Deprecated | Superseded

## Context
[What situation are we in?]

## Decision
[What did we decide?]

## Consequences
[What are the results of this decision?]

## Alternatives Considered
[What other options did we evaluate?]
```

---

### Implementation Guide

**Location**: `docs/implementation/mechanism-name.md`

**Structure**:
```markdown
# Feature Name Implementation Guide

## Overview
[High-level description]

## Architecture
[How components fit together]

## Step-by-Step Implementation
1. [Step 1]
2. [Step 2]
...

## Configuration
[Required config]

## Testing
[How to test]

## Troubleshooting
[Common issues]
```

---

### API Documentation

**Location**: `docs/api/endpoint-name.md` or Swagger spec

**Structure**:
```markdown
# Endpoint Name

## Endpoint
GET/POST/PUT/DELETE /api/v1/resource

## Authentication
[Auth requirements]

## Request
[Request format]

## Response
[Response format]

## Examples
[Usage examples]

## Errors
[Error codes]
```

---

### Debug Guide

**Location**: `docs/implementation/debugging-feature.md`

**Structure**:
```markdown
# Debugging Feature Name

## Common Issues

### Issue 1: [Problem]
**Symptoms**: [What you see]
**Cause**: [Why it happens]
**Solution**: [How to fix]

### Issue 2: [Problem]
...

## Diagnostic Checklist
- [ ] Check 1
- [ ] Check 2
...

## Tools & Commands
[Useful debugging commands]
```

---

## Real-World Examples

### Example 1: WebSocket Real-Time Notifications

**Analysis**:
- ✅ Architectural decision: WebSocket vs SSE
- ✅ Complex mechanism: Connection lifecycle
- ✅ New API: WebSocket events
- ❌ Not just debugging

**Output**:
1. **ADR**: `docs/adr/0008-websocket-for-realtime.md`
2. **Implementation Guide**: `docs/implementation/websocket-lifecycle.md`
3. **API Docs**: Update with WebSocket events
4. **Linear Summary**: Complete task summary

---

### Example 2: Fix Session Pagination Memory Leak

**Analysis**:
- ❌ No architectural decision
- ❌ No complex new mechanism
- ❌ No new API
- ❌ Not reusable debugging (one-time fix)

**Output**:
1. **Linear Summary Only**: Bug description, root cause, fix, verification

---

### Example 3: Add Health Check Endpoint

**Analysis**:
- ❌ No architectural decision (standard pattern)
- ❌ Not complex (simple endpoint)
- ✅ New API endpoint
- ❌ Not debugging

**Output**:
1. **API Docs**: Update Swagger with health check endpoint
2. **Linear Summary**: Endpoint added, usage examples

---

### Example 4: Migrate to Database-Backed Sessions

**Analysis**:
- ✅ Architectural decision: Memory vs Database storage
- ✅ Complex mechanism: Dual-write pattern
- ❌ No new API (internal change)
- ✅ Debugging: Migration troubleshooting

**Output**:
1. **ADR**: `docs/adr/0007-dual-write-session-storage.md`
2. **Implementation Guide**: `docs/implementation/session-migration.md`
3. **Debug Guide**: `docs/implementation/debugging-session-migration.md`
4. **Linear Summary**: Complete migration summary

---

### Example 5: Add User Avatar Upload

**Analysis**:
- ❌ No architectural decision (standard file upload)
- ❌ Not complex (standard pattern)
- ✅ New API endpoint
- ❌ Not debugging

**Output**:
1. **API Docs**: Update Swagger with upload endpoint
2. **Linear Summary**: Feature added, multipart form handling

---

## Quick Reference

| Scenario | ADR | Guide | API | Debug | Linear |
|----------|-----|-------|-----|-------|--------|
| Architectural choice | ✅ | | | | ✅ |
| Complex mechanism | | ✅ | | | ✅ |
| New API | | | ✅ | | ✅ |
| Troubleshooting value | | | | ✅ | ✅ |
| Simple feature/bug | | | | | ✅ |
| Multiple criteria | ✅ | ✅ | ✅ | ✅ | ✅ |

**Linear Summary is ALWAYS required** - it's the single source of truth for task completion.

---

## Anti-Patterns to Avoid

### ❌ Don't Create These Files

1. **`PHASE_X_COMPLETE.md`** → Use Linear milestone comments
2. **`FEATURE_IMPLEMENTATION.md`** → Use Linear summary + code comments
3. **`BUGFIX_SUMMARY.md`** → Use Linear summary
4. **`TASK_PROGRESS.md`** → Use Linear issue status
5. **`MILESTONE_XXX.md`** → Use Linear comments
6. **`PROJECT_STATUS.md`** → Use Linear project view

### ✅ Instead, Use

- **Linear comments**: For progress updates
- **Linear final summary**: For completion records
- **Code comments**: For explaining complex logic
- **Commit messages**: For change history
- **ADR**: For architectural decisions only
- **Implementation guides**: For complex mechanisms only

---

## When in Doubt

**Golden Rule**: If you're unsure, ask yourself:

> "Will someone ELSE need this information in 6 months?"

- **YES, for architecture understanding** → ADR
- **YES, for implementing similar feature** → Implementation Guide
- **YES, for using the API** → API Docs
- **YES, for debugging problems** → Debug Guide
- **NO, just tracking task** → Linear Summary Only

**Default to Linear Summary** - only create code documentation when there's clear, lasting value.
