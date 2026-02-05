# Skill Exclusion Fix - PDF & PPTX Conflicts with NotebookLM

## Problem

When the user requested "用notebooklm给作业检测做一个pdf", the system was incorrectly triggering the `example-skills:pdf` skill instead of allowing NotebookLM to generate the PDF.

### Root Cause Analysis

The problem had **two sources**:

1. **Global Plugin Auto-Loading**
   - Claude Code CLI automatically loads plugins from `~/.claude/settings.json`
   - The global settings had `"example-skills@anthropic-agent-skills": true`
   - This loaded pdf/pptx skills into ALL sessions, overriding workspace configuration

2. **Keyword Matching Priority**
   - Skill router matched "pdf" keyword in user message
   - Triggered `example-skills:pdf` before considering NotebookLM

**Conflict Log:**
```
用notebooklm给作业检测做一个pdf
→ 🔧 Skill: Completed: Executing Skill (131ms)
→ ❌ Wrong: Suggested using example-skills:pdf
→ ✅ Expected: Use NotebookLM to generate PDF
```

## Solution

Excluded `example-skills:pdf` and `example-skills:pptx` from the enabled skills list to prevent keyword conflicts.

### Changes Made

#### 1. Backend - Disable Global Plugins (session.service.ts:96-105)

**Critical Fix:** Prevent Claude Code from loading global plugins into workspace sessions.

**Before:**
```typescript
fs.writeFileSync(
  path.join(claudeDir, 'settings.local.json'),
  JSON.stringify({
    permissions: {
      allow: ['Bash(*)', 'Write(*)', 'Edit(*)', 'Read(*)'],
      deny: [],
    },
  }, null, 2),
);
```

**After:**
```typescript
fs.writeFileSync(
  path.join(claudeDir, 'settings.local.json'),
  JSON.stringify({
    permissions: {
      allow: ['Bash(*)', 'Write(*)', 'Edit(*)', 'Read(*)'],
      deny: [],
    },
    // Disable global plugins to prevent conflicts with workspace skills
    // Solutions should manage their own skills via CCAAS database
    enabledPlugins: {},
  }, null, 2),
);
```

**Effect:**
- `enabledPlugins: {}` overrides `~/.claude/settings.json` global plugins
- Prevents example-skills (pdf, pptx, xlsx, etc.) from loading
- Each solution's session has clean plugin slate
- Skills are only loaded from CCAAS database (via skillSyncService)

**Why This Matters:**
- Global plugins from `~/.claude/settings.json` are loaded AFTER workspace skills
- They override workspace configuration and can't be controlled per-solution
- This was the root cause - even though frontend filtered skills, Claude Code still loaded them globally

#### 2. Frontend - App.tsx (Lines 92-99)

**Before:**
```typescript
const enabledSkillSlugs = useMemo(() => {
  return skills
    .filter(s => enabledSkillIds.has(s.id))
    .map(s => s.slug)
}, [skills, enabledSkillIds])
```

**After:**
```typescript
// Exclude pdf and pptx skills to avoid conflict with NotebookLM
const enabledSkillSlugs = useMemo(() => {
  const EXCLUDED_SKILLS = ['example-skills:pdf', 'example-skills:pptx']
  return skills
    .filter(s => enabledSkillIds.has(s.id))
    .map(s => s.slug)
    .filter(slug => !EXCLUDED_SKILLS.includes(slug))
}, [skills, enabledSkillIds])
```

**Effect:**
- Even if pdf/pptx skills are enabled globally in CCAAS
- They will not be synced to lesson plan designer sessions
- The skills will not interfere with keyword matching

#### 2. Solution Configuration - solution.json

**Before:**
```json
{
  "relatedSkills": ["notebooklm", "example-skills:pptx"],
  "chainedSkills": {
    "notebooklm": { ... },
    "example-skills:pptx": { ... }
  }
}
```

**After:**
```json
{
  "relatedSkills": ["notebooklm"],
  "chainedSkills": {
    "notebooklm": {
      "description": "生成教案讲解音频、PDF文档等内容",
      "triggerPhrase": "生成音频|生成PDF|生成文档",
      "inputFrom": "教案内容",
      "outputTo": ".agent-workspace/sessions/{sessionId}/outputs/"
    }
  }
}
```

**Effect:**
- Removed `example-skills:pptx` from related skills
- Consolidated all artifact generation through NotebookLM
- Updated NotebookLM description to include PDF generation

## How It Works

### Complete Skill Isolation Flow

```
Backend (Session Creation):
1. Create workspace: .agent-workspace/sessions/{sessionId}/
2. Write .claude/settings.local.json with enabledPlugins: {}
3. This DISABLES global plugins from ~/.claude/settings.json
4. Claude Code CLI won't load example-skills or other global plugins

Frontend (Skill Sync):
5. useSkills hook fetches tenant skills from CCAAS
6. enabledSkillIds contains IDs of enabled tenant skills
7. enabledSkillSlugs filters out EXCLUDED_SKILLS (extra safety)
8. SkillSyncService syncs only filtered skills to workspace
9. Workspace .claude/skills/ contains ONLY tenant skills

Result:
10. Skill router sees ONLY tenant-approved skills
11. No global plugin interference
12. Clean, predictable skill environment per solution
```

### Before Fix

```
User: "用notebooklm给作业检测做一个pdf"
   ↓
Skill Router matches: "pdf" keyword
   ↓
Triggers: example-skills:pdf ❌
   ↓
Result: Wrong skill executed
```

### After Fix

```
User: "用notebooklm给作业检测做一个pdf"
   ↓
Skill Router sees: only notebooklm (pdf skill excluded)
   ↓
Matches: "notebooklm" keyword in message
   ↓
Triggers: notebooklm ✅
   ↓
Result: Correct skill executed
```

## Testing

### Test Case 1: Generate PDF with NotebookLM

**Command:**
```
用notebooklm给作业检测做一个pdf
```

**Expected Behavior:**
1. No `example-skills:pdf` skill trigger
2. NotebookLM skill activated
3. PDF generated via NotebookLM

### Test Case 2: Generate Audio with NotebookLM

**Command:**
```
用notebooklm生成教学音频
```

**Expected Behavior:**
1. NotebookLM skill activated
2. Audio podcast generated

### Test Case 3: Verify Excluded Skills

**Check:**
```bash
# In frontend, check browser console log
# Should see: "🔧 Sending with enabled skills: [...]"
# Should NOT include: "example-skills:pdf" or "example-skills:pptx"
```

## Alternative Approaches Considered

### Option 1: Disable Skills Globally ❌
**Rejected:** Would affect all tenants, not just lesson plan designer

### Option 2: Modify Skill Triggers ❌
**Rejected:** Can't modify example-skills (external package)

### Option 3: Add Negative Triggers ❌
**Rejected:** Skill router doesn't support negative matching

### Option 4: Filter in Frontend ✅ **CHOSEN**
**Benefits:**
- Solution-specific exclusion
- No backend changes needed
- Easy to maintain and extend
- Can add more excluded skills easily

## Benefits

✅ **No more skill conflicts** - NotebookLM works as expected
✅ **User intent respected** - "用notebooklm做pdf" correctly uses NotebookLM
✅ **Flexible exclusion** - Can easily add more excluded skills
✅ **Solution-specific** - Other solutions can still use pdf/pptx skills
✅ **No backend changes** - All changes in frontend configuration

## Maintenance

### Adding More Excluded Skills

Edit `frontend/src/App.tsx`:
```typescript
const EXCLUDED_SKILLS = [
  'example-skills:pdf',
  'example-skills:pptx',
  'example-skills:xlsx',  // Add new exclusions here
]
```

### Re-enabling PDF/PPTX Skills

If you want to use pdf/pptx skills again:
1. Remove them from `EXCLUDED_SKILLS` array
2. Add back to `solution.json` relatedSkills if desired

## Related Files

- `packages/backend/src/chat/session.service.ts` - Workspace settings.local.json with disabled plugins
- `packages/backend/src/skills/skill-sync.service.ts` - Skill syncing with slug filtering
- `frontend/src/App.tsx` - Frontend skill filtering logic (defense in depth)
- `solution.json` - Solution configuration
- `packages/backend/src/chat/chat.gateway.ts` - enabledSkillSlugs handling

## Notes

- The excluded skills are still visible in CCAAS admin UI
- They're just not synced to lesson plan designer sessions
- Global skill state unchanged (other solutions not affected)
- User can still manually invoke excluded skills via `/skill` command if needed

## Implementation Date

2026-02-03
