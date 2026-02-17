# solution.json v2 Specification

This document is the reference specification for the `solution.json` v2 configuration format used by CCAAS solutions.

---

## Overview

Every CCAAS solution has a `solution.json` file at its root that declares the solution's identity, skills, MCP servers, and runtime configuration.

**v2** introduces a structured separation between platform-facing configuration and solution-internal configuration:

```
solution.json v2
├── ccaas          # What the CCAAS platform reads (auto-discovery)
│   ├── tenant     # Solution identity on the platform
│   └── discovery  # Skills and MCP servers to register
└── internal       # What the solution itself reads (ports, DB, etc.)
    ├── backend
    ├── frontend
    ├── syncFields
    └── setup
```

### Key Differences from v1

| Aspect | v1 (flat) | v2 (structured) |
|--------|-----------|-----------------|
| Layout | All fields at top level | Separated into `ccaas` and `internal` sections |
| Discovery | Manual script (`npm run skill:import`) | Automatic on backend startup |
| Identity | `name` + `slug` at root | `ccaas.tenant.name` + `ccaas.tenant.slug` |
| Skills | `skills[]` or `skill` at root | `ccaas.discovery.skills[]` |
| MCP servers | `mcpServers` at root | `ccaas.discovery.mcpServers` |
| Version marker | `$schema` URL (optional) | `schemaVersion: "2.0"` (required) |
| Backend config | `backend` at root | `internal.backend` |

### Why Two Sections?

**`ccaas`** contains everything the CCAAS backend needs to auto-discover and register a solution. The backend only reads this section -- it never looks at `internal`.

**`internal`** contains everything the solution itself needs to run (ports, database paths, sync fields). The CCAAS backend ignores this section entirely.

This separation means:
- The backend can scan `solutions/*/solution.json`, read only `ccaas`, and register all skills and MCP servers without understanding each solution's internal structure.
- Solutions can add arbitrary fields to `internal` without affecting the platform.
- The contract between platform and solution is explicit and versioned.

---

## Schema Version Detection

The CCAAS backend determines the schema version using the following logic:

1. If `schemaVersion` is `"2.0"` -- treat as v2
2. If a `ccaas` top-level key is present (and is an object) -- treat as v2
3. Otherwise -- treat as v1 (legacy)

Both v1 and v2 configs are supported simultaneously. Existing v1 solutions continue to work without changes.

---

## Top-Level Structure

```jsonc
{
  "$schema": "https://ccaas.dev/schemas/solution.v2.json",  // optional
  "schemaVersion": "2.0",                                    // required
  "ccaas": { ... },                                          // required
  "internal": { ... }                                        // optional
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$schema` | `string` | No | JSON Schema URL for IDE validation |
| `schemaVersion` | `"2.0"` | Yes | Must be the literal string `"2.0"` |
| `ccaas` | `CcaasConfig` | Yes | Platform-facing configuration |
| `internal` | `InternalConfig` | No | Solution-private configuration |

---

## CCAAS Section

The `ccaas` section is the contract between the solution and the CCAAS platform.

```jsonc
{
  "ccaas": {
    "tenant": { ... },     // required
    "discovery": { ... }   // optional (defaults applied)
  }
}
```

### ccaas.tenant

Identifies the solution on the platform. Used to create or look up the tenant in the CCAAS database.

```json
{
  "tenant": {
    "name": "Quiz Analyzer",
    "slug": "quiz-analyzer",
    "description": "Educational quiz analysis system"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Human-readable solution name (min 1 character) |
| `slug` | `string` | Yes | URL-safe identifier. Must match `^[a-z0-9-]+$` |
| `description` | `string` | No | Brief description of the solution |

**Slug rules:**
- Lowercase letters, digits, and hyphens only
- No spaces, underscores, or uppercase
- Used as the `tenantId` in the CCAAS backend
- Must be unique across all solutions on the platform

### ccaas.discovery

Controls how the CCAAS backend discovers and registers the solution's skills and MCP servers.

```json
{
  "discovery": {
    "enabled": true,
    "mode": "auto",
    "skills": [ ... ],
    "mcpServers": { ... }
  }
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `enabled` | `boolean` | No | `true` | Whether the backend should discover this solution |
| `mode` | `"auto" \| "manual"` | No | `"auto"` | Discovery mode (see below) |
| `skills` | `SkillDefinition[]` | No | `[]` | Skills to register |
| `mcpServers` | `Record<string, McpServerDefinition>` | No | `{}` | MCP servers to register |

**Discovery modes:**

- **`auto`** -- The backend scans this config on startup and registers skills and MCP servers automatically. Changes to `solution.json` take effect on next backend restart.
- **`manual`** -- The backend reads the config but does not auto-register. Use `npm run skill:import` to register manually. Useful during development when you want explicit control.

If `enabled` is `false`, the backend skips this solution entirely during scanning.

### SkillDefinition

Each entry in `ccaas.discovery.skills` defines one skill to register.

```json
{
  "name": "Three Column Analysis",
  "slug": "three-column-analysis",
  "description": "Analyze quiz with three-column layout",
  "skillFile": "skills/three-column-analysis/SKILL.md",
  "scope": "tenant",
  "instructions": "Follow the standard workflow. Use progressive updates.",
  "triggers": [
    { "type": "keyword", "value": "analyze quiz", "priority": 10 }
  ],
  "allowedTools": ["write_output", "parse_quiz_content"],
  "relatedSkills": ["knowledge-point-matching"],
  "outputFormat": "QuizAnalysis"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `string` | Yes | -- | Human-readable skill name |
| `slug` | `string` | Yes | -- | URL-safe identifier (`^[a-z0-9-]+$`). Unique per tenant. |
| `description` | `string` | No | -- | What this skill does |
| `skillFile` | `string` | No | -- | Path to SKILL.md relative to solution root |
| `scope` | `"tenant" \| "personal"` | No | `"tenant"` | Visibility scope |
| `instructions` | `string` | No | -- | Additional instructions appended to skill content |
| `triggers` | `SkillTrigger[]` | No | -- | When to activate this skill |
| `allowedTools` | `string[]` | No | -- | MCP tools this skill may use |
| `relatedSkills` | `string[]` | No | -- | Slugs of related skills |
| `chainedSkills` | `Record<string, ChainedSkill>` | No | -- | Skills to chain after this one |
| `outputFormat` | `string` | No | -- | Expected output format name |

### SkillTrigger

Defines when the skill router should activate a skill based on user input.

```json
{ "type": "keyword", "value": "analyze", "priority": 10 }
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | `"keyword" \| "intent" \| "pattern" \| "context"` | Yes | -- | Matching strategy |
| `value` | `string` | Yes | -- | The value to match (min 1 character) |
| `priority` | `integer` | No | -- | 0-100, higher wins when multiple skills match |
| `description` | `string` | No | -- | Explanation of the trigger for humans |

**Trigger types:**
- **`keyword`** -- Exact word match in user message
- **`pattern`** -- Regular expression match
- **`intent`** -- Semantic intent classification (reserved for future use)
- **`context`** -- Contextual conditions (reserved for future use)

### ChainedSkill

Defines a skill that should run after the current skill completes.

```json
{
  "notebooklm": {
    "description": "Generate audio from lesson plan",
    "triggerPhrase": "generate audio",
    "inputFrom": "Lesson plan content",
    "outputTo": ".agent-workspace/sessions/{sessionId}/outputs/audio.mp3"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | `string` | No | What this chained skill does |
| `triggerPhrase` | `string` | No | Phrase that activates the chain |
| `inputFrom` | `string` | No | Description of input source |
| `outputTo` | `string` | No | Output file path template |

### McpServerDefinition

Each entry in `ccaas.discovery.mcpServers` defines one MCP server to register.

```json
{
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
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `command` | `string` | Yes | -- | Executable command (min 1 character) |
| `args` | `string[]` | No | `[]` | Command-line arguments |
| `description` | `string` | No | -- | What this server provides |
| `type` | `"stdio" \| "rest-adapter"` | No | `"stdio"` | Transport type |
| `env` | `Record<string, string>` | No | -- | Environment variables |

---

## Internal Section

The `internal` section is ignored by the CCAAS backend. It contains configuration that the solution's own backend and frontend read.

```jsonc
{
  "internal": {
    "backend": { ... },
    "frontend": { ... },
    "syncFields": [ ... ],
    "setup": { ... }
  }
}
```

All fields in `internal` are optional. If `internal` is omitted entirely, the CCAAS backend still works -- it only reads `ccaas`.

### internal.backend

```json
{
  "backend": {
    "port": 3005,
    "ccaasUrl": "http://localhost:3001",
    "database": {
      "type": "sqlite",
      "path": "data/quiz-analyzer.db"
    }
  }
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `port` | `integer` | Yes | -- | Solution backend port (1-65535) |
| `ccaasUrl` | `string` (URL) | No | `"http://localhost:3001"` | CCAAS backend URL |
| `database.type` | `"sqlite" \| "postgres"` | No | `"sqlite"` | Database engine |
| `database.path` | `string` | No | -- | SQLite file path (relative to solution root) |
| `database.url` | `string` | No | -- | PostgreSQL connection URL |

### internal.frontend

```json
{
  "frontend": {
    "port": 5282,
    "apiBaseUrl": "http://localhost:3005"
  }
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `port` | `integer` | Yes | -- | Frontend dev server port (1-65535) |
| `apiBaseUrl` | `string` | No | -- | Solution backend API base URL |

### internal.syncFields

Defines the fields that are synchronized between the AI agent and the frontend via `write_output`.

Two formats are supported:

**Flat array** (most common):
```json
{
  "syncFields": ["parsedQuiz", "catalog", "difficulty", "thinkingProcess"]
}
```

**Grouped record** (for solutions with multiple modes):
```json
{
  "syncFields": {
    "lessonPlan": ["title", "subject", "objectives", "activities"],
    "problemExplain": ["analysis", "steps", "answer", "mistakes"]
  }
}
```

### internal.setup

Lifecycle scripts for solution installation and initialization.

```json
{
  "setup": {
    "skipSteps": [],
    "customScripts": {
      "preInstall": ".solution-hooks/pre-install.sh",
      "customInit": ".solution-hooks/custom-init.sh",
      "postInstall": ".solution-hooks/post-install.sh"
    }
  }
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `skipSteps` | `string[]` | No | `[]` | Steps to skip during setup |
| `customScripts.preInstall` | `string` | No | -- | Script to run before `npm install` |
| `customScripts.customInit` | `string` | No | -- | Script for custom initialization |
| `customScripts.postInstall` | `string` | No | -- | Script to run after installation |

---

## Examples

### Minimal

The smallest valid v2 config. Registers one skill and one MCP server:

```json
{
  "schemaVersion": "2.0",
  "ccaas": {
    "tenant": {
      "name": "My Solution",
      "slug": "my-solution"
    },
    "discovery": {
      "skills": [
        {
          "name": "My Skill",
          "slug": "my-skill",
          "skillFile": "skills/my-skill/SKILL.md",
          "triggers": [
            { "type": "keyword", "value": "help", "priority": 10 }
          ],
          "allowedTools": ["write_output"]
        }
      ],
      "mcpServers": {
        "my-tools": {
          "command": "node",
          "args": ["mcp-server/dist/index.js"]
        }
      }
    }
  }
}
```

See [examples/solution-v2-minimal.json](examples/solution-v2-minimal.json) for the complete file.

### Full-Featured

A complete config with multiple skills, MCP servers, backend/frontend config, sync fields, and setup scripts. Based on the quiz-analyzer solution.

See [examples/solution-v2-full.json](examples/solution-v2-full.json).

---

## Migration from v1 to v2

### Mapping

| v1 field | v2 field |
|----------|----------|
| `name` | `ccaas.tenant.name` |
| `slug` | `ccaas.tenant.slug` |
| `description` | `ccaas.tenant.description` |
| `skills` | `ccaas.discovery.skills` |
| `skill` (single object) | `ccaas.discovery.skills` (wrap in array) |
| `mcpServers` | `ccaas.discovery.mcpServers` |
| `backend` | `internal.backend` |
| `frontend` | `internal.frontend` |
| `syncFields` | `internal.syncFields` |
| `setup` | `internal.setup` |
| `chainedSkills` (top-level) | Move into the relevant skill's `chainedSkills` field |
| `version` | Dropped (not used by platform) |
| `author` | Dropped (not used by platform) |
| `tags` | Dropped (not used by platform) |
| `workflow` | Dropped (move to SKILL.md or internal docs) |
| `subjects` | Dropped (move to solution backend data) |

### Step-by-Step

1. **Add version marker:**
   ```json
   { "schemaVersion": "2.0" }
   ```

2. **Create `ccaas.tenant`** from top-level `name`, `slug`, `description`:
   ```json
   {
     "ccaas": {
       "tenant": {
         "name": "Quiz Analyzer",
         "slug": "quiz-analyzer",
         "description": "..."
       }
     }
   }
   ```

3. **Move `skills` and `mcpServers` into `ccaas.discovery`:**
   ```json
   {
     "ccaas": {
       "discovery": {
         "enabled": true,
         "mode": "auto",
         "skills": [ /* move skills array here */ ],
         "mcpServers": { /* move mcpServers here */ }
       }
     }
   }
   ```
   If the v1 config uses a single `skill` object instead of a `skills` array, wrap it in an array and ensure it has a `slug` field.

4. **Move `backend`, `frontend`, `syncFields`, `setup` into `internal`:**
   ```json
   {
     "internal": {
       "backend": { /* move backend here */ },
       "frontend": { /* move frontend here */ },
       "syncFields": [ /* move syncFields here */ ],
       "setup": { /* move setup here */ }
     }
   }
   ```

5. **Remove dropped fields** (`version`, `author`, `tags`, `workflow`, `subjects`, top-level `chainedSkills`).

6. **Remove `$schema`** or update it to `https://ccaas.dev/schemas/solution.v2.json`.

7. **Validate** the result (see Validation section below).

### Before and After

**v1:**
```json
{
  "name": "Quiz Analyzer",
  "slug": "quiz-analyzer",
  "version": "1.0.0",
  "description": "Educational quiz analysis",
  "backend": { "port": 3005 },
  "frontend": { "port": 5282 },
  "skills": [
    { "name": "Analysis", "slug": "analysis", "skillFile": "SKILL.md" }
  ],
  "mcpServers": {
    "tools": { "command": "node", "args": ["dist/index.js"] }
  },
  "syncFields": ["field1", "field2"]
}
```

**v2:**
```json
{
  "schemaVersion": "2.0",
  "ccaas": {
    "tenant": {
      "name": "Quiz Analyzer",
      "slug": "quiz-analyzer",
      "description": "Educational quiz analysis"
    },
    "discovery": {
      "enabled": true,
      "mode": "auto",
      "skills": [
        { "name": "Analysis", "slug": "analysis", "skillFile": "SKILL.md" }
      ],
      "mcpServers": {
        "tools": { "command": "node", "args": ["dist/index.js"] }
      }
    }
  },
  "internal": {
    "backend": { "port": 3005 },
    "frontend": { "port": 5282 },
    "syncFields": ["field1", "field2"]
  }
}
```

---

## Best Practices

### Discovery Mode Selection

Use **`auto`** (the default) for most solutions. The backend registers skills on startup, so changes to `solution.json` take effect on restart.

Use **`manual`** during early development when:
- You are iterating rapidly on skill definitions and don't want automatic registration
- You need to test skills before they go live
- You want to control exactly when skills are registered

Set **`enabled: false`** to temporarily exclude a solution from discovery without deleting its config.

### Skill Structure

- **One skill per concern.** Prefer multiple focused skills over one monolithic skill. The skill router selects the best match based on triggers.
- **Use descriptive slugs.** `three-column-analysis` is better than `analysis-1`. Slugs are used in URLs, logs, and database records.
- **Set trigger priorities carefully.** When multiple skills match a user message, the highest priority wins. Use 10 for primary triggers, 8-9 for secondary, 5-7 for loose matches.
- **Always set `skillFile`.** The SKILL.md file is the source of truth for the skill's prompt content. Without it, only the `instructions` field is used.
- **List all MCP tools in `allowedTools`.** This creates a whitelist. Tools not listed are unavailable to the skill.

### MCP Server Configuration

- **Use `stdio` type** for MCP servers that run as child processes (the standard case).
- **Use `rest-adapter` type** for MCP servers exposed as HTTP REST APIs.
- **Set `env` variables** to configure ports, database paths, or feature flags for the MCP server process.
- **Use descriptive server names** as the key (e.g., `quiz-analyzer-tools`, not `tools`). The key is used as the server identifier in the CCAAS backend.

### SyncFields

- Only list fields that the AI agent writes via `write_output`. Don't list internal state or UI-only fields.
- Use the flat array format unless the solution has multiple distinct modes (like lesson plan + problem explanation in a single solution).

---

## Validation and Troubleshooting

### Programmatic Validation

The schema is implemented as Zod schemas in the backend. Use `validateSolutionConfig()` to validate any config:

```typescript
import { validateSolutionConfig } from '@/solutions/dto/solution-config.dto';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('solution.json', 'utf8'));
const result = validateSolutionConfig(config);

if (result.success) {
  console.log(`Valid ${result.version} config`);
  // result.data is typed as SolutionConfigV1 or SolutionConfigV2
} else {
  console.error(`Invalid ${result.version} config:`);
  for (const issue of result.errors.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
}
```

### Common Errors

**"Expected literal `2.0`, received string"** at `schemaVersion`
- The `schemaVersion` field must be exactly `"2.0"` (a string, not a number).

**"Required" at `ccaas`**
- The `ccaas` section is required in v2. If you only have `schemaVersion: "2.0"` without `ccaas`, validation fails.

**"Invalid" at `ccaas.tenant.slug`**
- Slugs must be lowercase alphanumeric with hyphens only. No spaces, underscores, or uppercase letters.
- Valid: `quiz-analyzer`, `my-solution`, `edu-agent`
- Invalid: `Quiz_Analyzer`, `my solution`, `MyApp`

**"Required" at `ccaas.tenant.name`**
- The tenant name cannot be empty. Provide a human-readable name.

**"Invalid url" at `internal.backend.ccaasUrl`**
- Must be a valid URL including protocol. Use `http://localhost:3001`, not `localhost:3001`.

**"Number must be less than or equal to 65535" at port fields**
- Port numbers must be between 1 and 65535.

### Debugging Tips

1. **Check version detection first.** If the backend treats your v2 config as v1, ensure `schemaVersion: "2.0"` is present at the top level.

2. **Validate incrementally.** Start with just `ccaas.tenant`, confirm it passes, then add `ccaas.discovery`, then `internal`.

3. **Compare with examples.** Use [examples/solution-v2-minimal.json](examples/solution-v2-minimal.json) as a starting point and modify it.

4. **Check the test file.** The test suite at `packages/backend/src/solutions/dto/solution-config.dto.spec.ts` contains 82 test cases covering valid and invalid configurations. Search for a case similar to yours.

---

## TypeScript Types

All types are inferred from the Zod schemas. Import from the DTO file:

```typescript
import type {
  SolutionConfigV2,
  SolutionConfigV1,
  TenantConfig,
  DiscoveryConfig,
  CcaasConfig,
  InternalConfig,
  SkillDefinition,
  McpServerDefinition,
  SkillTriggerConfig,
  BackendConfig,
  FrontendConfig,
  DatabaseConfig,
  SetupConfig,
  SchemaVersion,
} from '@/solutions/dto/solution-config.dto';
```

### Type Hierarchy

```
SolutionConfigV2
├── schemaVersion: "2.0"
├── ccaas: CcaasConfig
│   ├── tenant: TenantConfig
│   │   ├── name: string
│   │   ├── slug: string
│   │   └── description?: string
│   └── discovery: DiscoveryConfig
│       ├── enabled: boolean
│       ├── mode: "auto" | "manual"
│       ├── skills: SkillDefinition[]
│       │   ├── name, slug, description, skillFile
│       │   ├── scope: "tenant" | "personal"
│       │   ├── triggers: SkillTriggerConfig[]
│       │   ├── allowedTools: string[]
│       │   └── ...
│       └── mcpServers: Record<string, McpServerDefinition>
│           ├── command, args, description
│           ├── type: "stdio" | "rest-adapter"
│           └── env: Record<string, string>
└── internal?: InternalConfig
    ├── backend?: BackendConfig
    ├── frontend?: FrontendConfig
    ├── syncFields?: string[] | Record<string, string[]>
    └── setup?: SetupConfig
```

---

## Source Files

| File | Description |
|------|-------------|
| `packages/backend/src/solutions/dto/solution-config.dto.ts` | Zod schemas and TypeScript types |
| `packages/backend/src/solutions/dto/solution-config.dto.spec.ts` | 82 unit tests |
| `docs/examples/solution-v2-minimal.json` | Minimal working v2 config |
| `docs/examples/solution-v2-full.json` | Full-featured v2 config |
