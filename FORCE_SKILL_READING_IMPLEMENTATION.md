# Force Skill Reading via --append-system-prompt - Implementation Complete

**Date**: 2026-02-11
**Status**: ✅ Implemented and Type-Checked

## Problem Statement

Claude Code was finding skills but NOT reading SKILL.md content before responding. User observation:

> 似乎正确找到了skill，但是不知道有没有读取skill的具体内容，因为它没有自己读取contenxt

**Root Cause**:
- Claude Code auto-discovers skills from `.claude/skills/` directory ✅
- Reads SKILL.md **frontmatter** (name, description) ✅
- Does NOT auto-load SKILL.md **content** into system prompt ❌
- Requires Claude to manually use Read tool to see SKILL.md instructions ❌

## Solution Implemented

Inject skill instructions **directly into Claude's system prompt** via `--append-system-prompt` CLI parameter.

### Why This Works

| Approach | Priority | Guaranteed | Timing |
|----------|----------|------------|---------|
| CLAUDE.md | Low (workspace file) | ❌ | After startup |
| **--append-system-prompt** | **High (CLI param)** | ✅ | **Before first response** |

## Implementation Details

### Phase 1: Added `appendSystemPrompt` to ManagedSession ✅

**File**: `packages/backend/src/common/interfaces/session.interface.ts`

```typescript
export interface ManagedSession {
  // ... existing fields

  // Skill-specific system prompt injected via --append-system-prompt
  appendSystemPrompt?: string;
}
```

### Phase 2: Updated SessionService to Accept and Use Prompt ✅

**File**: `packages/backend/src/chat/session.service.ts`

**Changes**:
1. Added `appendSystemPrompt?` parameter to `ensureCLIProcess()`
2. Appended `--append-system-prompt '...'` to CLI command (initial spawn)
3. Preserved prompt across `--resume` in `sendFollowUp()`

**CLI Command Example**:
```bash
claude --output-format stream-json --input-format stream-json \
  --verbose --permission-mode bypassPermissions \
  --mcp-config '{"mcpServers":{...}}' \
  --append-system-prompt 'CRITICAL SKILL USAGE INSTRUCTIONS: ...'
```

### Phase 3: Added Prompt Generator to SessionsController ✅

**File**: `packages/backend/src/sessions/sessions.controller.ts`

**New Method**: `generateSkillSystemPrompt()`

Creates critical instruction block:
```
CRITICAL SKILL USAGE INSTRUCTIONS:

This session has 2 specialized skill(s) available:
  - **Lesson Plan Designer** (`lesson-plan-designer`): Create lesson plans
  - **Teaching Script Generator** (`teaching-script-generator`): Generate scripts

MANDATORY WORKFLOW - 强制工作流:

When a user message relates to ANY of the skills above:
1. IMMEDIATELY use Read tool: Read(".claude/skills/{relevant-skill-slug}/SKILL.md")
2. The SKILL.md contains MANDATORY instructions (e.g., "call read_context first")
3. Follow those instructions EXACTLY before responding

Why this matters:
- SKILL.md contains domain expertise you don't have
- SKILL.md provides tools to access existing data (read_context, read_form_state, etc.)
- Following SKILL.md prevents asking users for data they already provided

Example (lesson planning):
❌ WRONG: Ask "What's your subject? Grade level?"
✅ RIGHT: Read(".claude/skills/lesson-plan-designer/SKILL.md") → Follow instructions → Use read_context → Respond with data

Remember: Skills are your PRIMARY tools. Always read SKILL.md before responding to skill-related requests.
```

### Phase 4: Wired Up in createCompletion ✅

**File**: `packages/backend/src/sessions/sessions.controller.ts:282-308`

**Flow**:
1. After syncing skills to workspace
2. Generate skill system prompt
3. Store in `session.appendSystemPrompt`
4. Pass to `sessionService.ensureCLIProcess()` on first message
5. Preserved automatically on follow-up messages via `sendFollowUp()`

## Files Modified

1. ✅ `packages/backend/src/common/interfaces/session.interface.ts`
   - Added `appendSystemPrompt?: string` to ManagedSession

2. ✅ `packages/backend/src/chat/session.service.ts`
   - Added parameter to `ensureCLIProcess()`
   - Added `--append-system-prompt` to CLI command (spawn)
   - Added `--append-system-prompt` to CLI command (resume)

3. ✅ `packages/backend/src/sessions/sessions.controller.ts`
   - Added `generateSkillSystemPrompt()` helper method
   - Generate prompt after skill sync
   - Store in `session.appendSystemPrompt`
   - Pass to `sessionService.ensureCLIProcess()`

## Verification Checklist

- [x] TypeScript compilation passes (no errors)
- [ ] Backend starts successfully with DEBUG logging
- [ ] CLI command includes `--append-system-prompt` in logs
- [ ] Prompt preserved across `--resume` (follow-up messages)
- [ ] Claude reads SKILL.md before responding to skill-related messages
- [ ] Claude calls `read_context` as instructed in SKILL.md
- [ ] Claude doesn't ask for data already in context

## Testing Instructions

### Test 1: Check CLI Command

```bash
cd packages/backend
DEBUG=* npm run start:dev
```

Send message via frontend, check logs for:
```
Running command: claude --output-format stream-json ... --append-system-prompt 'CRITICAL SKILL USAGE INSTRUCTIONS: ...'
```

### Test 2: Verify Claude Behavior

**Test message**: "帮我编写课程要求"

**Expected Claude actions** (check in frontend or logs):
1. ✅ Read(".claude/skills/lesson-plan-designer/SKILL.md")
2. ✅ Call `read_context` tool
3. ✅ Use context data (subject, grade, etc.)
4. ✅ Respond directly without asking "你的学科是什么？"

### Test 3: Follow-up Message

**Test message 2**: "修改一下目标"

**Expected**:
- CLI spawned with `--resume` AND `--append-system-prompt`
- Prompt preserved from first message

## Success Criteria

- [x] `appendSystemPrompt` added to ManagedSession interface
- [x] `generateSkillSystemPrompt()` creates prompt from enabled skills
- [x] CLI command includes `--append-system-prompt` parameter
- [x] Prompt preserved across `--resume` (follow-up messages)
- [ ] Claude reads SKILL.md before responding to skill-related messages ⏳ (needs testing)
- [ ] Claude calls `read_context` as instructed in SKILL.md ⏳ (needs testing)
- [ ] Claude doesn't ask for data already in context ⏳ (needs testing)

## Rollback Plan

If this doesn't work:
1. The changes are minimal and non-breaking
2. Simply remove `--append-system-prompt` from CLI command
3. Fall back to CLAUDE.md approach
4. No database migrations to revert (using JSON config field)

## Future Enhancements

1. **Skill-specific prompts**: Each skill defines its own system prompt in SKILL.md frontmatter
2. **Prompt templates**: Configurable templates for different skill categories
3. **A/B testing**: Compare effectiveness of different prompt phrasings
4. **Analytics**: Track whether Claude actually reads SKILL.md files
5. **Tenant custom prompts**: Allow tenants to override/extend via `config.appendSystemPrompt`

## Notes

- This implementation uses the CLI parameter approach instead of relying on workspace files
- The prompt is injected at the highest priority level (system prompt)
- CLAUDE.md is still created for redundancy and human documentation
- No breaking changes to existing functionality
- No database schema changes required

## Related Issues

- User reported: "似乎正确找到了skill，但是不知道有没有读取skill的具体内容"
- Root cause: Claude Code finds skills but doesn't auto-load SKILL.md content
- Previous approach (CLAUDE.md) had lower priority and no guarantee of being read

## Implementation Complete

All code changes implemented and type-checked. Ready for testing with real Claude Code CLI.
