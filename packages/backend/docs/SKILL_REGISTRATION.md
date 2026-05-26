# Skill Registration System

This document explains how to register solution skills to the CCAAS backend database, enabling AI to use solution-specific tools and capabilities.

## Table of Contents

- [Overview](#overview)
- [Why Skill Registration is Required](#why-skill-registration-is-required)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Skill Import CLI Tool](#skill-import-cli-tool)
- [Solution.json Schema](#solutionjson-schema)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Integration with Solutions](#integration-with-solutions)
- [Future: Auto-Discovery](#future-auto-discovery)

---

## Overview

CCAAS solutions define their AI skills in `solution.json` files, but these configurations must be **registered to the CCAAS backend database** before the AI can use them. This document explains the registration process and provides tools to automate it.

**Key Concept**: Skill definitions in `solution.json` are **configuration files**, not runtime registrations. The CCAAS backend needs skills in its database to:
1. Auto-load skills when a session connects with a `solutionId`
2. Route user messages to appropriate skills via triggers
3. Restrict AI to specific tools via `allowedTools`
4. Track skill versions and updates

---

## Why Skill Registration is Required

### The Problem

Without skill registration, this happens:

```
User sends: "请帮我分析这道题目" with solutionId: 'quiz-analyzer'
  ↓
CCAAS backend: skillsService.findPublished('quiz-analyzer') → []
  ↓
AI receives: Default/global skills (e.g., Linear tools: list_issues, get_issue)
  ↓
AI uses wrong tools ❌
  ↓
Frontend: No output_update events, no data in UI ❌
```

**User Impact**: Complete frontend failure - no API calls work, no chat functionality.

### The Solution

With skill registration:

```
Developer runs: npm run skill:import -- quiz-analyzer
  ↓
Script reads: solutions/quiz-analyzer/solution.json
  ↓
Database: 4 skills inserted with status='published', enabled=true
  ↓
User sends: "请帮我分析这道题目" with solutionId: 'quiz-analyzer'
  ↓
CCAAS backend: skillsService.findPublished('quiz-analyzer') → [4 skills]
  ↓
AI receives: quiz-analyzer-specific skills (parse_quiz_content, write_output, etc.)
  ↓
AI uses correct tools ✅
  ↓
Frontend: Receives output_update events, displays analysis ✅
```

---

## Architecture

### Components

```
┌─────────────────────────┐
│  solution.json          │  ← Skill definitions (config)
│  - skills[]             │
│  - allowedTools[]       │
│  - triggers[]           │
└────────────┬────────────┘
             │
             │ npm run skill:import
             ↓
┌─────────────────────────┐
│  import-solution-skills │  ← CLI tool (script)
│  - Read solution.json   │
│  - Create/update tenant │
│  - Register skills      │
│  - Publish skills       │
└────────────┬────────────┘
             │
             │ SkillsService.create()
             ↓
┌─────────────────────────┐
│  CCAAS Database         │  ← Runtime storage
│  - tenants table        │
│  - skills table         │
│  - skill_versions       │
└────────────┬────────────┘
             │
             │ Auto-load on session creation
             ↓
┌─────────────────────────┐
│  AI Session             │  ← AI uses registered skills
│  - Skill routing        │
│  - Tool restriction     │
│  - Trigger matching     │
└─────────────────────────┘
```

### Data Flow

1. **Configuration** (Developer): Define skills in `solution.json`
2. **Registration** (CLI): Import skills to database via `npm run skill:import`
3. **Runtime** (Session): CCAAS auto-loads skills when user connects
4. **Execution** (AI): AI uses solution-specific skills and tools

---

## Quick Start

### Prerequisites

- CCAAS backend installed: `cd packages/backend && npm install`
- Solution has `solution.json` with skills array

### 1. Register Skills

```bash
cd packages/backend
npm run skill:import -- <solution-name>

# Example:
npm run skill:import -- quiz-analyzer
npm run skill:import -- lesson-plan-designer
```

### 2. Verify Registration

```bash
# Via API (requires backend running)
curl "http://localhost:3001/api/v1/skills?solutionId=quiz-analyzer"

# Via database (direct access)
sqlite3 .agent-workspace/data.db \
  "SELECT slug, status, enabled FROM skills WHERE solutionId='227f2b75...'"
```

**Expected Output:**
```
analyze-student-answer|published|1
complete-analysis|published|1
knowledge-point-matching|published|1
three-column-analysis|published|1
```

### 3. Start Using

Skills are now available to AI sessions with `solutionId: 'quiz-analyzer'`.

---

## Skill Import CLI Tool

### Location

`packages/backend/src/scripts/import-solution-skills.ts`

### Usage

```bash
npm run skill:import -- <solution-name>
```

**Arguments:**
- `<solution-name>` (required): Solution slug (e.g., `quiz-analyzer`, `lesson-plan-designer`)

### What It Does

1. **Load Configuration**: Reads `solutions/<solution-name>/solution.json`
2. **Create/Get Solution**: Ensures tenant exists in database
3. **Register Skills**: For each skill in `solution.json`:
   - Reads skill file content from `skillFile` path (if specified)
   - Appends additional `instructions` (if specified)
   - Creates or updates skill in database
   - Sets `status='published'` and `enabled=true`
4. **Output Summary**: Shows created/updated counts and tenant ID

### Example Output

```
🚀 Importing skills for solution: quiz-analyzer

📦 Solution: Quiz Analyzer
📋 Skills to import: 4

✅ Solution exists: quiz-analyzer (227f2b75-d73a-d450-27ee-d523e270161f)

📝 Processing: three-column-analysis
   📄 Loaded content from: skills/three-column-analysis/SKILL.md
   ➕ Creating new skill...
   ✅ Created: three-column-analysis (aa54abc7...)
   📢 Published: three-column-analysis

📝 Processing: knowledge-point-matching
   📄 Loaded content from: SKILL_KNOWLEDGE_POINT_MATCHING.md
   ➕ Creating new skill...
   ✅ Created: knowledge-point-matching (5f93143d...)
   📢 Published: knowledge-point-matching

📝 Processing: analyze-student-answer
   📄 Loaded content from: skills/analyze-student-answer/SKILL.md
   ➕ Creating new skill...
   ✅ Created: analyze-student-answer (8cf67b26...)
   📢 Published: analyze-student-answer

📝 Processing: complete-analysis
   ⚠️  Skill file not found: /path/to/complete-analysis/SKILL.md
   ➕ Creating new skill...
   ✅ Created: complete-analysis (3009619a...)
   📢 Published: complete-analysis

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ Import complete!

📊 Summary:
   • Created: 4 skill(s)
   • Updated: 0 skill(s)
   • Total: 4 skill(s)
   • Solution: quiz-analyzer (227f2b75-d73a-d450-27ee-d523e270161f)

🔍 Verification:
   curl "http://localhost:3001/api/v1/skills?solutionId=quiz-analyzer"
```

### Error Handling

The script handles:
- ✅ Missing solution.json → Exit with error
- ✅ Missing skill file → Use fallback content (name + description)
- ✅ Existing skills → Update instead of create
- ✅ WebSocket errors → Gracefully continue (script context doesn't need WebSocket)

---

## Solution.json Schema

### Minimal Example

```json
{
  "name": "My Solution",
  "slug": "my-solution",
  "description": "Solution description",
  "skills": [
    {
      "name": "My Skill",
      "slug": "my-skill",
      "description": "Skill description",
      "skillFile": "skills/my-skill/SKILL.md",
      "scope": "tenant",
      "allowedTools": ["tool1", "tool2"],
      "triggers": [
        {
          "type": "keyword",
          "value": "trigger phrase",
          "priority": 10
        }
      ]
    }
  ]
}
```

### Skill Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ Yes | Display name for the skill |
| `slug` | string | ✅ Yes | Unique identifier (kebab-case) |
| `description` | string | ✅ Yes | Brief description of skill purpose |
| `skillFile` | string | ⚠️ Optional | Path to markdown file (relative to solution root) |
| `instructions` | string | ⚠️ Optional | Additional instructions appended to content |
| `allowedTools` | string[] | ⚠️ Optional | Tools AI can use with this skill |
| `triggers` | object[] | ⚠️ Optional | Trigger conditions for skill activation |
| `scope` | enum | ⚠️ Optional | `"tenant"` (default) or `"personal"` |
| `outputFormat` | string | ⚠️ Optional | Expected output format |

### Trigger Schema

```typescript
{
  "type": "keyword" | "intent" | "pattern" | "context",
  "value": string,      // Trigger phrase or pattern
  "priority": number,   // Higher = more priority (1-10)
  "description": string // Optional description
}
```

### Content Resolution

The skill's `content` field in the database is populated as follows:

1. **If `skillFile` is specified**: Read file content from path
2. **If `skillFile` is missing**: Use fallback: `# ${name}\n\n${description}`
3. **If `instructions` is specified**: Append as `## Additional Instructions\n\n${instructions}`

**Example**:
```markdown
# Quiz Analyzer - Three Column Analysis

三栏布局题目分析 - 解析题目、标注知识点、查找目录、生成思路

## Additional Instructions

请严格遵循 skills/three-column-analysis/SKILL.md 中的标准工作流...
```

---

## Verification

### 1. Database Check

```bash
sqlite3 packages/backend/.agent-workspace/data.db \
  "SELECT slug, status, enabled FROM skills WHERE solutionId='YOUR-TENANT-ID';"
```

**Expected Output:**
```
skill-1|published|1
skill-2|published|1
skill-3|published|1
```

### 2. API Check

```bash
curl "http://localhost:3001/api/v1/skills?solutionId=my-solution" | python3 -m json.tool
```

**Check for:**
- `total` count matches expected number of skills
- Each skill has `status: "published"` and `enabled: true`
- `allowedTools` and `triggers` arrays are populated correctly

### 3. Runtime Check (Backend Logs)

When a session starts with `solutionId`:

```
[SkillRouter] Auto-loading skills for tenant: quiz-analyzer
[SkillRouter] Loaded 4 skills for tenant quiz-analyzer
[SkillRouter] Matched skill: three-column-analysis (trigger: keyword)
```

### 4. Frontend Check (Browser Console)

When user sends a message:

```javascript
console.log("Auto-loading tenant skills for: quiz-analyzer")
// AI should call solution-specific tools
console.log("Tool call: parse_quiz_content") // ✅ Correct
// NOT global tools:
// console.log("Tool call: list_issues") // ❌ Wrong
```

---

## Troubleshooting

### Issue: AI Uses Global Skills (e.g., Linear tools)

**Symptoms:**
- AI calls `list_issues`, `get_issue` instead of solution tools
- No `output_update` events in browser console
- Frontend shows "暂无数据" or empty state

**Root Cause:** Skills not registered in database

**Solution:**
```bash
cd packages/backend
npm run skill:import -- quiz-analyzer
# Verify:
curl "http://localhost:3001/api/v1/skills?solutionId=quiz-analyzer"
```

### Issue: Import Script Fails with "Solution not found"

**Symptoms:**
```
❌ Solution not found: /path/to/solutions/my-solution/solution.json
```

**Root Cause:** Script looks in wrong directory

**Solution:**
```bash
# Ensure you're in backend directory:
cd packages/backend
pwd  # Should show: .../ccaas/packages/backend

# Then run import:
npm run skill:import -- my-solution
```

### Issue: Import Script Fails with TypeScript Errors

**Symptoms:**
```
Cannot find module '@nestjs/common'
```

**Root Cause:** Backend dependencies not installed

**Solution:**
```bash
cd packages/backend
npm install
npm run skill:import -- my-solution
```

### Issue: Skills Registered but AI Still Uses Wrong Tools

**Symptoms:**
- Database shows skills with `status=published`, `enabled=1`
- AI still uses global skills

**Root Cause:** Frontend not sending `solutionId` in requests

**Solution:**

Check frontend code:
```typescript
// ✅ Correct:
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',
  solutionId: 'quiz-analyzer'  // MUST be set
})

// ❌ Wrong:
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001'
  // Missing solutionId!
})
```

### Issue: Skill File Not Found Warning

**Symptoms:**
```
⚠️  Skill file not found: /path/to/skill/SKILL.md
```

**Impact:** Non-critical. Script uses fallback content (name + description).

**Solution (Optional):**
1. Create the skill file at the specified path
2. OR update `solution.json` to point to correct path
3. OR remove `skillFile` field (uses fallback)

---

## Integration with Solutions

### Solution Setup Checklist

When creating a new solution, ensure:

- [ ] `solution.json` exists with `skills` array
- [ ] Each skill has `name`, `slug`, `description`
- [ ] Skill files exist at paths specified in `skillFile` (optional)
- [ ] `allowedTools` array matches MCP tools available
- [ ] `triggers` array covers expected user phrases
- [ ] `scope` is set to `"tenant"` (default) or `"personal"`

### Solution README Template

Add this section to your solution's README.md:

```markdown
## ⚙️ Skill Registration (Required)

**Important**: Before using [solution-name] with CCAAS, register skills to the backend:

```bash
cd ../../packages/backend
npm run skill:import -- [solution-slug]
```

**Verification:**
```bash
curl "http://localhost:3001/api/v1/skills?solutionId=[solution-slug]"
```

**Troubleshooting:**
If AI uses wrong tools, see [SKILL_REGISTRATION.md](../../packages/backend/docs/SKILL_REGISTRATION.md#troubleshooting).
```
```

### Development Workflow

```bash
# 1. Develop solution with solution.json
cd solutions/my-solution
vim solution.json  # Define skills

# 2. Register skills to CCAAS
cd ../../packages/backend
npm run skill:import -- my-solution

# 3. Start services
cd ../../solutions/my-solution
npm run dev  # Start solution backend & frontend

# 4. Test in browser
open http://localhost:YOUR_PORT
# Verify AI uses solution-specific tools
```

---

## Future: Auto-Discovery

### Current Limitation

Skill registration is manual:
- Developer must run `npm run skill:import` after changes
- Easy to forget during development
- No automatic sync between `solution.json` and database

### Planned Enhancement

**Goal**: Automatically discover and register skills at CCAAS backend startup.

**Design**:

```typescript
// packages/backend/src/solutions/solution-loader.service.ts
@Injectable()
export class SolutionLoaderService implements OnModuleInit {
  async onModuleInit() {
    // 1. Scan solutions/ directory
    const solutions = await this.discoverSolutions();

    // 2. For each solution.json:
    for (const solution of solutions) {
      // 3. Create/update tenant
      await this.ensureTenant(solution);

      // 4. Sync skills (with version tracking)
      await this.syncSkills(solution);
    }
  }

  private async syncSkills(solution: SolutionConfig) {
    // Compare solution.json with database
    // Create/update/archive skills as needed
    // Track versions to detect changes
  }
}
```

**Benefits**:
- ✅ Zero manual steps
- ✅ Always in sync
- ✅ Works for all solutions
- ✅ Supports skill updates and versioning

**Implementation Plan**:
1. Create `SolutionLoaderService` with discovery logic
2. Add version tracking to skills table
3. Implement diff detection for updates
4. Add configurable scan paths
5. Provide CLI override for manual control

**Configuration**:
```typescript
// packages/backend/src/config/solutions.config.ts
export default {
  autoDiscovery: {
    enabled: true,  // Toggle auto-discovery
    scanPaths: ['../../solutions/*/solution.json'],
    updateStrategy: 'merge' | 'replace',  // How to handle updates
  }
}
```

---

## Related Documentation

- [Authentication & Authorization](./AUTHENTICATION_AND_AUTHORIZATION.md) - API key management for solutions
- [Error Handling](./ERROR_HANDLING.md) - Standardized error responses
- [Swagger API](./SWAGGER.md) - API documentation for skills endpoints

---

## Feedback

If you encounter issues with skill registration or have suggestions for improvement, please:
1. Check the [Troubleshooting](#troubleshooting) section
2. Search existing issues on GitHub
3. Create a new issue with:
   - Solution name and version
   - Command output and error messages
   - Database verification results

---

**Last Updated**: 2026-02-16
**Version**: 1.0.0
**Maintainer**: CCAAS Team
