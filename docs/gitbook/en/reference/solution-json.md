# solution.json Reference (v3.0)

Complete reference for the solution.json configuration file in KedgeAgentic platform.

---

## Schema Version

**Current:** `3.0` (Recommended)
**Supported:** `1.0`, `2.0`, `3.0`

```json
{
  "schemaVersion": "3.0"
}
```

**Migration:** v1/v2 configs are automatically migrated to v3 at runtime. See [Migration Guide](./migration.md) for manual upgrade.

---

## Overview

The `solution.json` file defines your solution's configuration, including:
- **Tenant Information** - Name, slug, description
- **Skills** - AI capabilities (via folder paths or wildcards)
- **MCP Servers** - Tool services for AI agents

**Philosophy:** v3.0 follows **convention over configuration** - minimal config with sensible defaults.

---

## Minimal Example

The simplest valid solution.json (recommended for most solutions):

```json
{
  "schemaVersion": "3.0",
  "tenant": {
    "name": "My Solution",
    "slug": "my-solution",
    "description": "Brief description of what this solution does"
  },
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"]
    }
  }
}
```

**That's it!**
- Skills auto-discovered from `skills/*/SKILL.md`
- All skill metadata in SKILL.md frontmatter
- Clean, readable, maintainable

---

## Core Configuration

### schemaVersion

**Type:** `"3.0"`
**Required:** Yes

```json
{
  "schemaVersion": "3.0"
}
```

Always use `"3.0"` for new solutions.

### tenant

**Type:** `Object`
**Required:** Yes

Identifies your solution in the CCAAS platform.

```json
{
  "tenant": {
    "name": "Quiz Analyzer",
    "slug": "quiz-analyzer",
    "description": "Educational quiz analysis system"
  }
}
```

**Fields:**
- `name` (string, required) - Display name
- `slug` (string, required) - Unique identifier (kebab-case)
- `description` (string, optional) - Brief description

### skills

**Type:** `Array<string | { folder: string }>`
**Default:** `["skills/*"]`
**Required:** No (uses default if omitted)

Defines which skills to load. Supports glob patterns for auto-discovery.

#### Option 1: Omit (Recommended)

```json
{
  "tenant": { ... },
  "mcpServers": { ... }
  // No "skills" field = uses default ["skills/*"]
}
```

✅ **Best practice** - Convention over configuration

#### Option 2: Wildcard Pattern

```json
{
  "skills": ["skills/*"]
}
```

✅ Makes auto-discovery explicit

#### Option 3: Specific Folders

```json
{
  "skills": [
    "skills/analyzer",
    "skills/reporter",
    "custom-skills/special"
  ]
}
```

✅ Full control over which skills load

#### Option 4: Mixed

```json
{
  "skills": [
    "skills/*",              // Auto-discover all
    "experimental/beta"      // Plus specific skill
  ]
}
```

✅ Flexibility for edge cases

**Pattern Matching:**
- `skills/*` - All direct subdirectories
- `features/*/skill` - Nested paths
- Looks for `SKILL.md` file in each matched directory

### discovery

**Type:** `Object`
**Default:** `{ "enabled": true }`
**Required:** No

Controls whether this solution is automatically registered at backend startup.

```json
{
  "discovery": {
    "enabled": false
  }
}
```

**Fields:**
- `enabled` (boolean, default: `true`) - When `true`, skills and MCP servers are auto-registered when the CCAAS backend starts. Set to `false` to disable automatic registration for this solution.

**Use cases for `enabled: false`:**
- Work-in-progress solutions not ready for deployment
- Solutions that should only be registered manually
- Temporarily disabling a solution without removing it

> **Note:** When `discovery.enabled` is omitted or `true`, the backend automatically registers all skills and MCP servers from this solution on every startup. There is no longer a need to run `npm run skill:import` manually.

---

### mcpServers

**Type:** `Record<string, McpServerConfig>`
**Default:** `{}`
**Required:** Usually yes (unless skill needs no tools)

Defines MCP tool servers available to skills.

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "Tool service description",
      "type": "stdio",
      "env": {
        "MCP_PORT": "3006"
      }
    }
  }
}
```

**McpServerConfig Fields:**
- `command` (string, required) - Executable command
- `args` (string[], required) - Command arguments
- `description` (string, optional) - Human-readable description
- `type` (string, optional) - `"stdio"` (default)
- `env` (object, optional) - Environment variables

---

## Solution-Specific Configuration

These fields are for your solution's internal use. **CCAAS ignores them**.

### syncFields

**Type:** `Array<string> | Array<{ name: string, type: string }>`
**Required:** No

Fields to sync between frontend and backend via context.

```json
{
  "syncFields": [
    "parsedQuiz",
    "catalog",
    "difficulty"
  ]
}
```

Or with types:

```json
{
  "syncFields": [
    { "name": "parsedQuiz", "type": "object" },
    { "name": "catalog", "type": "string" }
  ]
}
```

### setup

**Type:** `Object`
**Required:** No

Solution setup and lifecycle hooks.

```json
{
  "setup": {
    "customScripts": {
      "preInstall": ".solution-hooks/pre-install.sh",
      "postInstall": ".solution-hooks/post-install.sh"
    }
  }
}
```

---

## Complete Example

Full solution.json with all features:

```json
{
  "schemaVersion": "3.0",

  // ============ CCAAS Core Configuration ============
  "tenant": {
    "name": "Quiz Analyzer",
    "slug": "quiz-analyzer",
    "description": "Educational quiz intelligent analysis system"
  },

  "skills": ["skills/*"],  // Optional: defaults to this

  "mcpServers": {
    "quiz-analyzer-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "Quiz analysis MCP tools",
      "type": "stdio",
      "env": {
        "MCP_PORT": "3006",
        "LOG_LEVEL": "info"
      }
    }
  },

  // ============ Solution Configuration ============
  "backend": {
    "port": 3005,
    "database": {
      "type": "sqlite",
      "path": "data/quiz-analyzer.db"
    },
    "cors": {
      "origin": ["http://localhost:5282"]
    }
  },

  "frontend": {
    "port": 5282,
    "theme": "light",
    "features": ["sync", "export", "history"]
  },

  "syncFields": [
    "parsedQuiz",
    "catalog",
    "difficulty",
    "quizAnalysis",
    "knowledgePointTags"
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

---

## Configuration Levels

Choose the configuration level that fits your needs:

### Level 1: Minimal (Recommended)

**87% smaller than v2.0**

```json
{
  "schemaVersion": "3.0",
  "tenant": {
    "name": "My Solution",
    "slug": "my-solution"
  },
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"]
    }
  }
}
```

✅ Convention over configuration
✅ Auto-discovers all skills
✅ Cleanest, most maintainable

### Level 2: Explicit Skills

```json
{
  "schemaVersion": "3.0",
  "tenant": { ... },
  "skills": [
    "skills/analyzer",
    "skills/reporter"
  ],
  "mcpServers": { ... }
}
```

✅ Control over skill loading
✅ Still clean and readable

### Level 3: With Solution Config

```json
{
  "schemaVersion": "3.0",
  "tenant": { ... },
  "mcpServers": { ... },
  "backend": {
    "port": 3002,
    "database": { ... }
  },
  "frontend": {
    "port": 5280
  }
}
```

✅ Complete solution definition
✅ Single source of configuration
✅ Still ~70% smaller than v2.0

---

## SKILL.md Requirements

v3.0 requires **complete frontmatter** in all SKILL.md files. This is the single source of truth for skill metadata.

**Minimal SKILL.md:**

```markdown
---
name: My Skill
slug: my-skill
description: Brief description
scope: tenant
---

# Skill Content

Instructions for the AI agent...
```

**Complete SKILL.md with triggers:**

```markdown
---
name: Quiz Analyzer
slug: quiz-analyzer
description: Intelligent quiz analysis
scope: tenant
triggers:
  - type: keyword
    value: "analyze this quiz"
    priority: 10
  - type: pattern
    value: "\\d+\\.\\s+.+"
    priority: 5
allowedTools:
  - parse_quiz_content
  - write_output
---

# Quiz Analyzer

This skill analyzes educational quizzes...
```

**Required Fields:**
- ✅ `name` - Display name
- ✅ `slug` - Unique identifier
- ✅ `description` - Brief description
- ✅ `scope` - `"tenant"` or `"personal"`

**Optional Fields:**
- `triggers` - Activation triggers
- `allowedTools` - MCP tool allowlist
- `instructions` - Special AI instructions

---

## Validation

CCAAS validates solution.json on load and provides helpful error messages:

**Common Errors:**

```
✗ Schema validation failed: "schemaVersion" is required
→ Fix: Add "schemaVersion": "3.0"

✗ Invalid frontmatter in skills/my-skill/SKILL.md: slug: Required
→ Fix: Add required frontmatter fields to SKILL.md

✗ No skills found matching pattern "skills/*"
→ Fix: Ensure directory structure is skills/*/SKILL.md

✗ MCP server "my-tools" failed to start: command not found
→ Fix: Check command path and build output
```

---

## Best Practices

### ✅ DO:
- Use v3.0 schema for new solutions
- Omit `skills` field (use default auto-discovery)
- Keep skill metadata in SKILL.md frontmatter only
- Use descriptive tenant slug (kebab-case)
- Document MCP servers with `description`

### ❌ DON'T:
- Duplicate metadata between solution.json and SKILL.md
- Use deep nesting (v3.0 is flat by design)
- Include sensitive data (use environment variables)
- Over-configure (embrace defaults)

---

## Migration

If you have an existing v1.0 or v2.0 solution.json:

**Automatic:** CCAAS automatically migrates at runtime (no action needed)

**Manual:** Follow [Migration Guide](./migration.md) for clean upgrade

**Benefits of migrating:**
- 📉 78.7% configuration reduction
- 🎯 Single source of truth (SKILL.md)
- 🔧 Easier maintenance
- 🚀 Convention over configuration

---

## Related Documentation

- [Solution Development Guide](../guide/solution-dev.md) - Creating solutions
- [Migration Guide](./migration.md) - Upgrading from v2.0
- [Skill Writing Guide](../guide/skill-writing.md) - SKILL.md frontmatter
- [MCP Server Guide](../guide/mcp-server.md) - Tool implementation

---

**Last Updated:** 2026-02-17
**Schema Version:** 3.0
