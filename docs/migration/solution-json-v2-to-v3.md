# Migrating solution.json from v2.0 to v3.0

**Target Audience:** Solution developers upgrading from v2.0 to v3.0
**Time Required:** 15-30 minutes per solution
**Difficulty:** Medium

---

## Overview

This guide walks you through migrating a v2.0 solution.json to the simplified v3.0 format.

**What's Changing:**
- ✅ Flat structure (no `ccaas`/`internal` nesting)
- ✅ Skills as folder paths instead of 200+ line objects
- ✅ Wildcard pattern support (`skills/*`)
- ✅ SKILL.md frontmatter as single source of truth

**Benefits:**
- 📉 **78.7% configuration reduction** (254 → 54 lines for quiz-analyzer)
- 🎯 **Single source of truth** (no duplication)
- 🚀 **Convention over configuration** (default auto-discovery)
- 🔧 **Easier maintenance** (change one file, not two)

---

## Migration Steps

### Step 1: Update Schema Version

Change `schemaVersion` from `"2.0"` to `"3.0"`:

```json
{
- "schemaVersion": "2.0",
+ "schemaVersion": "3.0",
  ...
}
```

### Step 2: Flatten Structure

Remove `ccaas` and `internal` wrappers, promote children to top level:

**Before (v2.0):**
```json
{
  "schemaVersion": "2.0",
  "ccaas": {
    "tenant": {
      "name": "Quiz Analyzer",
      "slug": "quiz-analyzer"
    },
    "discovery": {
      "enabled": true,
      "mode": "auto",
      "skills": [ ... ],
      "mcpServers": { ... }
    }
  },
  "internal": {
    "backend": { ... },
    "frontend": { ... }
  }
}
```

**After (v3.0):**
```json
{
  "schemaVersion": "3.0",
  "tenant": {
    "name": "Quiz Analyzer",
    "slug": "quiz-analyzer"
  },
  "skills": [ ... ],
  "mcpServers": { ... },
  "backend": { ... },
  "frontend": { ... }
}
```

**Changes:**
- `ccaas.tenant` → `tenant`
- `ccaas.discovery.skills` → `skills`
- `ccaas.discovery.mcpServers` → `mcpServers`
- `internal.backend` → `backend`
- `internal.frontend` → `frontend`
- `internal.syncFields` → `syncFields`
- `internal.setup` → `setup`

**Removed Fields:**
- ❌ `ccaas.discovery.enabled` - Solution presence = enabled
- ❌ `ccaas.discovery.mode` - Never used

### Step 3: Simplify Skills

This is the biggest change. Replace detailed skill objects with simple folder paths.

#### Option 1: Omit Entirely (Recommended)

**Best for:** Solutions with all skills in `skills/` directory

```json
{
  "schemaVersion": "3.0",
  "tenant": { ... },
  "mcpServers": { ... }
  // No "skills" field = auto-discover via default ["skills/*"]
}
```

✅ **Simplest approach** - Let CCAAS auto-discover all SKILL.md files

#### Option 2: Use Wildcard

**Best for:** Explicit confirmation of auto-discovery

```json
{
  "schemaVersion": "3.0",
  "tenant": { ... },
  "skills": ["skills/*"],  // Explicit wildcard
  "mcpServers": { ... }
}
```

✅ Makes auto-discovery explicit

#### Option 3: List Specific Folders

**Best for:** Non-standard structure or selective skill loading

```json
{
  "schemaVersion": "3.0",
  "tenant": { ... },
  "skills": [
    "skills/three-column-analysis",
    "skills/analyze-student-answer",
    "custom-skills/special-analyzer"
  ],
  "mcpServers": { ... }
}
```

✅ Full control over which skills load

#### Option 4: Mix Wildcard and Specific

**Best for:** Standard skills + custom additions

```json
{
  "schemaVersion": "3.0",
  "tenant": { ... },
  "skills": [
    "skills/*",                      // Auto-discover all
    "experimental/beta-analyzer"     // Plus specific skill
  ],
  "mcpServers": { ... }
}
```

✅ Flexibility for edge cases

### Step 4: Ensure SKILL.md Frontmatter

v3.0 requires complete frontmatter in all SKILL.md files. Move skill metadata from solution.json to SKILL.md.

**v2.0 solution.json (200+ lines):**
```json
{
  "skills": [
    {
      "name": "Quiz Analyzer - Three Column Analysis",
      "slug": "three-column-analysis",
      "description": "三栏布局题目分析",
      "skillFile": "skills/three-column-analysis/SKILL.md",
      "scope": "tenant",
      "triggers": [
        {
          "type": "keyword",
          "value": "请帮我分析这道题目",
          "priority": 11
        },
        {
          "type": "keyword",
          "value": "分析这道题",
          "priority": 10
        }
      ],
      "allowedTools": [
        "parse_quiz_content",
        "search_knowledge_points_json",
        "write_output"
      ]
    }
  ]
}
```

**v3.0 SKILL.md frontmatter:**
```yaml
---
name: Quiz Analyzer - Three Column Analysis
slug: three-column-analysis
description: 三栏布局题目分析
scope: tenant
triggers:
  - type: keyword
    value: "请帮我分析这道题目"
    priority: 11
  - type: keyword
    value: "分析这道题"
    priority: 10
allowedTools:
  - parse_quiz_content
  - search_knowledge_points_json
  - write_output
---

# Three Column Analysis

[Skill content...]
```

**Required Fields:**
- ✅ `name` - Display name
- ✅ `slug` - Unique identifier (kebab-case)
- ✅ `description` - Brief description
- ✅ `scope` - `"tenant"` or `"personal"`

**Optional Fields:**
- `triggers` - Activation triggers
- `allowedTools` - MCP tools this skill can use
- `instructions` - Special instructions for AI

**Validation:**
```bash
# CCAAS will log errors if frontmatter is missing
[WARN] Invalid frontmatter in skills/my-skill/SKILL.md: slug: Required
```

---

## Complete Example: quiz-analyzer

### Before (v2.0) - 254 lines

```json
{
  "schemaVersion": "2.0",
  "ccaas": {
    "tenant": {
      "name": "Quiz Analyzer",
      "slug": "quiz-analyzer",
      "description": "教育题目智能分析系统"
    },
    "discovery": {
      "enabled": true,
      "mode": "auto",
      "skills": [
        {
          "name": "Quiz Analyzer - Three Column Analysis",
          "slug": "three-column-analysis",
          "description": "三栏布局题目分析。采用标准三栏格式...",
          "skillFile": "skills/three-column-analysis/SKILL.md",
          "type": "skill",
          "scope": "tenant",
          "instructions": "请严格遵循标准工作流...",
          "triggers": [
            {
              "type": "keyword",
              "value": "请帮我分析这道题目",
              "priority": 11,
              "description": "用户明确要求分析题目"
            },
            {
              "type": "keyword",
              "value": "分析这道题",
              "priority": 10,
              "description": "简短的分析请求"
            }
            // ... 50+ more lines of triggers
          ],
          "allowedTools": [
            "parse_quiz_content",
            "search_knowledge_points_json",
            "write_output",
            "get_catalog",
            "get_textbook_chapters"
          ]
        },
        {
          "name": "Knowledge Point Matching",
          "slug": "knowledge-point-matching",
          // ... another 100+ lines
        }
        // ... more skills
      ],
      "mcpServers": {
        "quiz-analyzer-tools": {
          "command": "node",
          "args": ["mcp-server/dist/index.js"],
          "description": "Quiz Analyzer MCP tools",
          "type": "stdio",
          "env": {
            "MCP_PORT": "3006"
          }
        }
      }
    }
  },
  "internal": {
    "backend": {
      "port": 3005,
      "database": {
        "type": "sqlite",
        "path": "data/quiz-analyzer.db"
      }
    },
    "frontend": {
      "port": 5282
    },
    "syncFields": [
      "parsedQuiz", "catalog", "difficulty",
      // ... more fields
    ],
    "setup": {
      "customScripts": {
        "preInstall": ".solution-hooks/pre-install.sh",
        "customInit": ".solution-hooks/custom-init.sh",
        "postInstall": ".solution-hooks/post-install.sh"
      }
    }
  }
}
```

### After (v3.0) - 54 lines (78.7% reduction)

```json
{
  "schemaVersion": "3.0",
  "tenant": {
    "name": "Quiz Analyzer",
    "slug": "quiz-analyzer",
    "description": "教育题目智能分析系统"
  },
  "mcpServers": {
    "quiz-analyzer-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "Quiz Analyzer MCP tools",
      "type": "stdio",
      "env": {
        "MCP_PORT": "3006"
      }
    }
  },
  "backend": {
    "port": 3005,
    "database": {
      "type": "sqlite",
      "path": "data/quiz-analyzer.db"
    }
  },
  "frontend": {
    "port": 5282
  },
  "syncFields": [
    "parsedQuiz", "catalog", "difficulty", "quizAnalysis",
    "knowledgePointTags", "thinkingProcess", "solutionSteps",
    "correctAnswer", "commonMistakes", "knowledgeGapAnalysis",
    "difficultyAnalysis", "relatedQuizzes"
  ],
  "setup": {
    "customScripts": {
      "preInstall": ".solution-hooks/pre-install.sh",
      "customInit": ".solution-hooks/custom-init.sh",
      "postInstall": ".solution-hooks/post-install.sh"
    }
  }
}
```

**Key Changes:**
- ❌ Removed 200+ lines of skill definitions
- ❌ Removed `ccaas` and `internal` wrappers
- ❌ Removed `discovery.enabled` and `discovery.mode`
- ✅ Skills auto-discovered via default `["skills/*"]`
- ✅ All skill metadata now in SKILL.md frontmatter

---

## Verification Checklist

After migration, verify your solution loads correctly:

### 1. Schema Validation

```bash
cd packages/backend
npm run build
```

✅ **Expected:** No TypeScript errors

### 2. Backend Loading

```bash
npm start
```

✅ **Expected Log Output:**
```
[SolutionLoaderService] Tenant "your-solution" already exists (...)
[SkillMetadataParserService] Parsed valid frontmatter from skills/skill-1/SKILL.md
[SkillMetadataParserService] Parsed valid frontmatter from skills/skill-2/SKILL.md
[SolutionLoaderService] Loaded "Your Solution": 0 skills created, 2 updated, ...
[SolutionLoaderService] Auto-discovery complete: X solutions, Y skills, Z MCP servers
```

❌ **Common Errors:**
```
[WARN] Invalid frontmatter in skills/my-skill/SKILL.md: slug: Required
→ Fix: Add missing frontmatter fields

[WARN] Failed to register skill from "skills/my-skill": SKILL.md not found
→ Fix: Ensure SKILL.md exists in skill folder

[WARN] No skills found matching pattern "skills/*"
→ Fix: Check directory structure (should be skills/*/SKILL.md)
```

### 3. Skill Registration

```bash
# Check database for loaded skills
npm run skill:list -- your-solution-slug
```

✅ **Expected:** All skills listed with correct metadata

### 4. Frontend Testing

Start your solution's frontend and verify:
- ✅ Skills trigger correctly
- ✅ MCP tools work
- ✅ Session context syncs properly

---

## Troubleshooting

### Issue 1: "Invalid frontmatter: slug: Required"

**Cause:** SKILL.md missing required frontmatter fields.

**Fix:**
```yaml
# Add complete frontmatter to SKILL.md
---
name: My Skill
slug: my-skill
description: Brief description
scope: tenant
---
```

### Issue 2: "No skills found matching pattern"

**Cause:** Directory structure doesn't match expected `skills/*/SKILL.md`.

**Fix:**
```bash
# Ensure structure is:
skills/
  my-skill/
    SKILL.md
  another-skill/
    SKILL.md

# NOT:
skills/
  SKILL.md  # ❌ Wrong location
```

### Issue 3: "SKILL.md not found"

**Cause:** File path case mismatch (SKILL.md vs Skill.md).

**Fix:** Ensure exact filename `SKILL.md` (all caps).

### Issue 4: Skills not auto-discovering

**Cause:** Custom skill paths not covered by default wildcard.

**Fix:** Add explicit paths:
```json
{
  "skills": [
    "skills/*",              // Standard skills
    "custom/special-skill"   // Custom location
  ]
}
```

---

## Backward Compatibility

**Good News:** The adapter automatically migrates v2 → v3!

If you don't manually migrate, CCAAS will:
1. Detect v2.0 schema
2. Auto-convert to v3.0 in memory
3. Load successfully with warnings

**Adapter Log:**
```
[SolutionConfigAdapter] Migrating v2.0 → v3.0 for solution "your-solution"
[SolutionConfigAdapter] Extracted 3 skill folder paths from v2 config
[SolutionLoaderService] Loaded "Your Solution": 0 skills created, 3 updated, ...
```

**Recommendation:** Manually migrate to v3.0 for cleaner config and better maintainability.

---

## Migration Checklist

Use this checklist when migrating each solution:

**Preparation:**
- [ ] Read this guide completely
- [ ] Backup current solution.json
- [ ] Verify all SKILL.md files exist

**Migration:**
- [ ] Update `schemaVersion` to `"3.0"`
- [ ] Remove `ccaas` wrapper, promote `tenant` and `discovery.*` to top level
- [ ] Remove `internal` wrapper, promote children to top level
- [ ] Remove `discovery.enabled` and `discovery.mode`
- [ ] Replace `skills` array with:
  - [ ] Option A: Omit entirely (use default `["skills/*"]`)
  - [ ] Option B: `["skills/*"]` (explicit wildcard)
  - [ ] Option C: List specific folders
- [ ] Ensure all SKILL.md files have complete frontmatter
- [ ] Move skill metadata from solution.json to SKILL.md

**Verification:**
- [ ] Build succeeds (`npm run build`)
- [ ] Backend starts without errors (`npm start`)
- [ ] All skills discovered and loaded (check logs)
- [ ] Skills listed in database (`npm run skill:list`)
- [ ] Frontend connects and works
- [ ] Skills trigger correctly

**Cleanup:**
- [ ] Commit changes with clear message
- [ ] Test in development environment
- [ ] Update solution README if needed

---

## Need Help?

**Common Questions:**

**Q: Can I mix v2 and v3 solutions?**
A: Yes! Adapter supports both simultaneously.

**Q: Do I need to migrate immediately?**
A: No, v2 still works. But v3 is much cleaner and easier to maintain.

**Q: Can I revert back to v2?**
A: Yes, just restore your backup. But you'll lose v3 benefits.

**Q: What if I have a complex custom structure?**
A: Use explicit skill paths instead of wildcards:
```json
{
  "skills": [
    "features/analyzer/skill",
    "features/reporter/skill",
    "legacy/old-skill"
  ]
}
```

**Q: How do I know if migration succeeded?**
A: Check backend logs for "Parsed valid frontmatter" and "X skills updated".

---

## References

- [ADR 0011: solution.json v3.0 Simplification](../adr/0011-solution-json-v3-simplification.md)
- [Backend Architecture](../../packages/backend/CLAUDE.md)
- [Skill Registration Guide](../SKILL_REGISTRATION.md)
- [Example: quiz-analyzer v3.0](../../solutions/quiz-analyzer/solution.json)

---

**Last Updated:** 2026-02-17
**Questions?** Open an issue or check the ADR for design rationale.
