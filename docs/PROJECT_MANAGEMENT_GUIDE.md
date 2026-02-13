# Project Management Guide

## Task Tracking Philosophy

### Use Linear for Task Tracking

**Linear is the single source of truth for**:
- ✅ Task creation and assignment
- ✅ Progress tracking (Todo → In Progress → Done)
- ✅ Status updates and comments
- ✅ Task completion summaries
- ✅ Sprint planning and milestones

**NOT in code repository**:
- ❌ `PHASE_1_COMPLETE.md` (use Linear comment instead)
- ❌ `FEATURE_X_IMPLEMENTATION.md` (use Linear description instead)
- ❌ Task status tracking files

---

## What Goes in Code Repository?

### docs/adr/ - Architecture Decision Records (ADRs)

**When to create an ADR**:
- Major architectural changes (e.g., removing lesson-plans from core)
- Technology selection (e.g., choosing WebSocket over polling)
- Breaking API changes
- Architectural principles (e.g., core vs solution backend separation)

**Format**: Use `docs/adr/TEMPLATE.md`

**Example**:
```
docs/adr/
├── 001-separate-core-and-solution-backends.md
├── 002-websocket-for-realtime-events.md
└── 003-monorepo-structure.md
```

---

### docs/implementation/ - Important Implementation Details

**When to create implementation docs**:
- Complex technical mechanisms that need explanation
- Debug checklists for recurring issues
- Integration guides for future reference

**NOT for**:
- Simple feature implementations
- Bug fixes (use Linear comment)
- Routine refactoring

**Example**:
```
docs/implementation/
├── FILE_HOOK_DEBUG_CHECKLIST.md      ← Good: Reusable debug guide
├── CONTEXT_MECHANISM_DESIGN.md       ← Good: Complex mechanism
└── NOT: ADDED_DELETE_BUTTON.md       ← Bad: Simple task
```

---

### docs/designs/ - Design Documents

**When to create a design doc**:
- Planning major features before implementation
- Cross-package/solution designs
- Need team/user alignment before coding

**Format**: Use `docs/designs/TEMPLATE.md`

---

## Workflow: Task → Linear → Commit → (ADR if needed)

### Standard Task Flow

```
1. Create Linear Issue
   CCAAS-123: Add user authentication

2. Implement with commits
   git commit -m "feat(backend): add JWT authentication"
   git commit -m "test(backend): add auth integration tests"

3. Update Linear
   - Add comment with implementation details
   - Move to "Done"
   - Link PR

4. (Optional) Create ADR if it's an architectural decision
   docs/adr/004-jwt-authentication.md
```

---

## When to Create Documentation Files

### ✅ Create File When:

1. **Architectural Decision**
   - Changes system architecture
   - Affects multiple packages/solutions
   - Needs to be referenced in future
   - Example: `docs/adr/001-core-solution-separation.md`

2. **Complex Technical Mechanism**
   - Not obvious from code alone
   - Requires explanation of design rationale
   - Example: `docs/implementation/CONTEXT_MECHANISM_DESIGN.md`

3. **Reusable Debug Guide**
   - Recurring issues with complex diagnosis
   - Helps future debugging
   - Example: `docs/implementation/FILE_HOOK_DEBUG_CHECKLIST.md`

4. **Integration/Setup Guide**
   - How to integrate with external systems
   - Setup instructions for new developers
   - Example: `docs/guides/MCP_SERVER_SETUP.md`

### ❌ Do NOT Create File For:

1. **Simple Task Completion**
   - "Added delete button" → Linear comment only
   - "Fixed bug in login" → Linear comment + commit message
   - "Updated dependencies" → Commit message only

2. **Routine Implementation**
   - Standard CRUD operations
   - UI component additions
   - Simple refactoring

3. **Bug Fixes**
   - Use Linear comment to document fix
   - Commit message should be descriptive
   - No need for separate markdown file

4. **Progress Updates**
   - "Phase 1 complete" → Linear issue status
   - "50% done" → Linear issue update
   - Sprint progress → Linear dashboard

---

## Migration: Existing *_COMPLETE.md Files

### Current State
We have ~48 files in `docs/internal/implementation-summaries/`:
- Many are simple task completions (should have been Linear updates)
- Some contain valuable architectural insights (should be ADRs)
- Mixed quality and usefulness

### Cleanup Strategy

**Phase 1: Identify Valuable Content**
Review each file and categorize:
- **ADR candidate**: Contains architectural decision → Extract to `docs/adr/`
- **Implementation guide**: Reusable technical guide → Keep in `docs/implementation/`
- **Task tracking**: Simple completion summary → Delete (info in git history)

**Phase 2: Archive Task Tracking Files**
```bash
# Move task tracking files to archive
mkdir docs/internal/archive/
mv docs/internal/implementation-summaries/*_COMPLETE.md docs/internal/archive/

# Keep only:
# - ADRs (move to docs/adr/)
# - Implementation guides (move to docs/implementation/)
# - Verification reports with debugging value
```

**Phase 3: Update Process**
- Add this guide to CLAUDE.md
- Update CONTRIBUTING.md with workflow
- Linear becomes primary tracking tool

---

## Decision Tree: Should I Create a Documentation File?

```
Task Completed
    ↓
Is this an architectural decision?
    YES → Create ADR (docs/adr/)
    NO  ↓
        
Is this a complex technical mechanism needing explanation?
    YES → Create implementation guide (docs/implementation/)
    NO  ↓
        
Is this a reusable debug guide?
    YES → Create debug checklist (docs/implementation/)
    NO  ↓
        
Is this a simple task/bug fix?
    YES → Update Linear + Commit → DONE ✅
```

---

## Benefits of This Approach

1. **Less Clutter**
   - Code repository contains only valuable, long-term documentation
   - No redundant task tracking files

2. **Clear Separation**
   - Linear = Task tracking, progress, status
   - Code repo = Technical decisions, complex mechanisms, guides

3. **Better Discoverability**
   - ADRs in one place (docs/adr/)
   - Implementation guides in one place (docs/implementation/)
   - Not mixed with task tracking

4. **Reduced Maintenance**
   - No need to update files when task status changes
   - Linear is the single source of truth

---

## Examples

### ❌ Bad: Task Tracking File
```markdown
# Add Delete Button - Complete

## What Was Done
- Added delete button to user profile
- Added confirmation dialog
- Added API endpoint

## Testing
- Manual testing passed

## Status
✅ Complete
```
**This should be**: Linear comment + commit message

---

### ✅ Good: Architecture Decision Record
```markdown
# ADR 001: Separate Core and Solution Backends

## Context
Core CCAAS backend contained lesson-plans module...

## Decision
Core = Relay + Auth + Routing
Solutions = Domain logic + Business rules

## Consequences
- Clearer architecture
- Better separation of concerns
- Prevents domain code in core

## References
- Commit: 2575c6f
- Implementation: packages/backend/
```

---

### ✅ Good: Implementation Guide
```markdown
# File Hook Debug Checklist

When files are not appearing in Files tab:

1. Check hook registration
2. Verify WriteFileTrackerHook is called
3. Check database file entries
...

## Common Issues
...
```

---

## See Also

- `CONTRIBUTING.md` - Development workflow
- `docs/adr/TEMPLATE.md` - ADR template
- `docs/designs/TEMPLATE.md` - Design doc template
- `docs/WORKFLOW.md` - Git workflow
