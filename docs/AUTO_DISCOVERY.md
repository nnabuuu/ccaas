# Auto-Discovery Architecture

This document describes how the CCAAS backend automatically discovers and loads solutions at startup.

---

## Overview

Auto-discovery replaces the manual `npm run skill:import` workflow. Instead of requiring developers to run import scripts after every skill change, the backend scans the `solutions/` directory on startup and registers skills and MCP servers automatically.

### Before (Manual Registration)

```bash
# After every skill change:
cd packages/backend
npm run skill:import -- quiz-analyzer
npm run skill:import -- lesson-plan-designer
```

### After (Auto-Discovery)

```
# Backend startup automatically:
1. Scans solutions/ directory
2. Reads solution.json from each solution
3. Parses SKILL.md frontmatter from each skill
4. Registers skills and MCP servers to the database
```

---

## Discovery Flow

```
Backend Startup
    |
    v
SolutionScannerService
    |  Scans solutions/ directory
    |  Finds solution.json files
    v
SolutionConfigAdapter
    |  Detects schema version (v1 or v2)
    |  Migrates v1 to v2 if needed
    |  Validates against v2 schema
    v
SkillMetadataParserService
    |  Reads SKILL.md files referenced by skills
    |  Parses YAML frontmatter
    |  Merges frontmatter with solution.json skill definitions
    v
SolutionLoaderService
    |  Registers skills to database (upsert by tenant + slug)
    |  Registers MCP servers to database
    |  Logs results
    v
Ready
```

---

## Components

### SolutionScannerService

Scans the `solutions/` directory for valid solution directories.

**Directory detection criteria:**
- Contains a `solution.json` file
- Is a direct child of `solutions/`

**Output:** List of `{ path, config }` tuples with the raw parsed JSON from each `solution.json`.

### SolutionConfigAdapter

Normalizes solution configuration to the v2 format.

**Responsibilities:**
- Detect schema version (v1 vs v2)
- Migrate v1 configs to v2 structure
- Validate the result against the v2 Zod schema
- Collect warnings for any lossy transformations

**Key behavior:**
- v2 configs are validated as-is
- v1 configs are migrated automatically with warnings logged
- Invalid configs are rejected with detailed error messages

See [solution.json v2 Specification](./SOLUTION_JSON_V2_SPEC.md) for the migration mapping.

### SkillMetadataParserService

Reads and parses `SKILL.md` files to extract frontmatter metadata.

**Merge strategy (SKILL.md frontmatter + solution.json):**

When both a SKILL.md frontmatter field and a solution.json skill field exist, the merge follows these rules:

| Field | Priority | Rationale |
|-------|----------|-----------|
| `name` | SKILL.md wins | Frontmatter is the source of truth |
| `slug` | SKILL.md wins | Must match directory name |
| `description` | SKILL.md wins | Frontmatter is the source of truth |
| `scope` | SKILL.md wins | Declared where the skill lives |
| `triggers` | Merged (deduplicated) | Both sources may define triggers |
| `allowedTools` | Merged (deduplicated) | Both sources may define tools |
| `instructions` | solution.json only | Not part of frontmatter schema |
| `skillFile` | solution.json only | Path is a solution.json concern |
| `outputFormat` | solution.json only | Not part of frontmatter schema |

See [SKILL.md Frontmatter Reference](./SKILL_MD_FRONTMATTER.md) for the frontmatter schema.

### SolutionLoaderService

Persists discovered skills and MCP servers to the database.

**Registration strategy:** Upsert by `(tenantId, slug)` composite key. If a skill already exists with the same tenant and slug, it is updated. New skills are created.

**What gets registered:**
- Skill content (the Markdown body of SKILL.md, after the frontmatter)
- Skill metadata (name, slug, description, scope, triggers, allowedTools)
- MCP server definitions (command, args, env, type)

---

## Discovery Modes

Configured via `ccaas.discovery.mode` in solution.json:

### `auto` (Default)

The backend:
1. Reads skills listed in `ccaas.discovery.skills[]`
2. Scans the `skills/` directory for any `SKILL.md` files not listed in solution.json
3. Merges all discovered skills
4. Registers everything

This is the recommended mode. It lets you add new skills by simply creating a `skills/<name>/SKILL.md` file without editing solution.json.

### `manual`

The backend:
1. Reads **only** skills listed in `ccaas.discovery.skills[]`
2. Does **not** scan directories
3. Registers only explicitly listed skills

Use this when you need precise control over which skills are active.

### Disabling Discovery

Set `ccaas.discovery.enabled: false` to skip a solution entirely:

```json
{
  "ccaas": {
    "discovery": {
      "enabled": false
    }
  }
}
```

---

## Directory Structure

Auto-discovery expects this layout:

```
solutions/
  quiz-analyzer/
    solution.json                    # Solution config (v1 or v2)
    skills/
      three-column-analysis/
        SKILL.md                     # Skill with frontmatter
      analyze-student-answer/
        SKILL.md
    mcp-server/
      dist/index.js                  # MCP server entry point
  lesson-plan-designer/
    solution.json
    skills/
      lesson-plan-designer/
        SKILL.md
      lesson-plan-pptx/
        SKILL.md
    mcp-server/
      dist/index.js
```

**Conventions:**
- Skill directory name should match the skill slug
- Each skill directory contains exactly one `SKILL.md`
- MCP server paths in solution.json are relative to the solution root

---

## Startup Logging

During auto-discovery, the backend logs progress and any issues:

```
[SolutionScanner] Scanning solutions/ directory...
[SolutionScanner] Found 3 solutions: quiz-analyzer, lesson-plan-designer, lego-playground

[SolutionConfigAdapter] quiz-analyzer: v1 config migrated to v2 (2 warnings)
[SolutionConfigAdapter]   Warning: Missing "version", using fallback
[SolutionConfigAdapter] lesson-plan-designer: v1 config migrated to v2 (0 warnings)
[SolutionConfigAdapter] lego-playground: v2 config validated

[SkillMetadataParser] quiz-analyzer: Parsed 4 skills from SKILL.md files
[SkillMetadataParser] lesson-plan-designer: Parsed 3 skills from SKILL.md files

[SolutionLoader] Registered 7 skills, 3 MCP servers across 3 solutions
[SolutionLoader] quiz-analyzer: 4 skills, 1 MCP server
[SolutionLoader] lesson-plan-designer: 3 skills, 2 MCP servers
[SolutionLoader] lego-playground: 0 skills (discovery disabled)
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| solution.json missing | Solution directory is skipped with a warning |
| solution.json invalid JSON | Solution is skipped with an error log |
| v2 validation fails | Solution is skipped, errors are logged |
| v1 migration produces invalid v2 | Solution is skipped, errors are logged |
| SKILL.md missing frontmatter | Skill uses solution.json definition only |
| SKILL.md has invalid frontmatter | Skill is skipped with a warning, other skills load normally |
| MCP server command not found | MCP server is registered but marked as error status |

The principle is: **one bad skill or solution should not prevent other solutions from loading**. Errors are isolated and logged.

---

## Troubleshooting

### Skills not appearing after startup

1. Check that `ccaas.discovery.enabled` is not `false`
2. Check that the SKILL.md file exists at the path referenced by `skillFile`
3. Check backend logs for validation errors
4. Verify the slug is unique within the tenant

### v1 config migration warnings

Warnings during migration are informational and usually harmless. Common warnings:

| Warning | Meaning |
|---------|---------|
| `Missing or empty "name"` | solution.json has no name; fallback "Unnamed Solution" was used |
| `Skills defined but none could be parsed` | Skills array exists but entries are malformed |
| `Skipping skill with missing name` | A skill entry has no `name` field |
| `Backend config missing port, skipping` | Backend section exists but has no `port`; internal.backend is omitted |

### Testing discovery locally

```bash
# Start the backend and check logs
cd packages/backend
npm run start:dev

# Look for [SolutionScanner], [SolutionLoader] log lines
```

---

## Related Documentation

- [solution.json v2 Specification](./SOLUTION_JSON_V2_SPEC.md) -- Complete v2 schema reference
- [SKILL.md Frontmatter Reference](./SKILL_MD_FRONTMATTER.md) -- Frontmatter format
- [Skill Registration](../packages/backend/docs/SKILL_REGISTRATION.md) -- Legacy manual registration
- [Solution Developer Guide](./SOLUTION_DEVELOPER_GUIDE.md) -- Full integration guide
