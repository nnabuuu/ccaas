# SKILL.md Frontmatter Reference

This document describes the YAML frontmatter format for `SKILL.md` files in CCAAS solution skill directories.

---

## Overview

Every skill in a CCAAS solution is defined by a `SKILL.md` file located at:

```
solutions/<solution-name>/skills/<skill-name>/SKILL.md
```

The file has two parts:

1. **YAML frontmatter** (between `---` delimiters) -- structured metadata used by the backend for skill registration, routing, and permission control.
2. **Markdown body** -- the skill prompt content that gets injected as the system prompt for the AgentEngine.

The frontmatter is the **single source of truth** for skill metadata. During solution auto-discovery, the backend parses this frontmatter to register skills into the database. This replaces the previous approach of duplicating metadata in `solution.json`.

---

## Schema Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | `string` | Yes | -- | Human-readable skill name |
| `slug` | `string` | Yes | -- | URL-safe identifier (lowercase, hyphens only) |
| `description` | `string` | Yes | -- | Brief description of what the skill does |
| `scope` | `"tenant" \| "global"` | No | `"tenant"` | Visibility scope |
| `triggers` | `SkillTrigger[]` | No | `[]` | Trigger rules for skill routing |
| `allowedTools` | `string[]` | No | `[]` | MCP tools this skill is permitted to use |

### SkillTrigger

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | `"keyword" \| "pattern" \| "intent" \| "context"` | Yes | -- | Trigger matching strategy |
| `value` | `string` | Yes | -- | The value to match against (min 1 character) |
| `priority` | `integer` | No | `5` | Routing priority, 1-100 (higher = matched first) |
| `description` | `string` | No | -- | Human-readable explanation of the trigger |

---

## Field Details

### `name`

The display name of the skill. Can contain any characters including Unicode. Shown in the admin UI and skill listings.

```yaml
name: Quiz Analyzer - Three Column Analysis
name: 教案优化专家
```

### `slug`

A URL-safe identifier used as the unique key within a tenant. Must match the pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$`:

- Lowercase letters and digits only
- Words separated by single hyphens
- No leading or trailing hyphens
- No underscores, spaces, or uppercase characters

```yaml
# Valid slugs
slug: three-column-analysis
slug: lesson-plan-pptx
slug: analyze-student-answer
slug: quiz-v2

# Invalid slugs (will fail validation)
slug: My-Skill          # uppercase
slug: my_skill           # underscores
slug: -leading-hyphen    # leading hyphen
slug: trailing-hyphen-   # trailing hyphen
slug: my skill           # spaces
```

**Convention**: The slug should match the skill directory name:

```
skills/three-column-analysis/SKILL.md   # slug: three-column-analysis
skills/lesson-plan-pptx/SKILL.md        # slug: lesson-plan-pptx
```

### `description`

A brief summary of the skill's purpose. Used for display in the admin UI and for skill discovery. Can contain Unicode.

```yaml
description: 三栏布局题目分析 - 解析题目、标注知识点、查找目录、生成思路
description: AI 乐高马赛克设计师 - 将图片转换为 2D 乐高拼图
```

### `scope`

Controls the visibility of the skill:

| Value | Description |
|-------|-------------|
| `tenant` | Available to all users within the same tenant. This is the most common scope. |
| `global` | Available across all tenants on the platform. Use sparingly for platform-level skills. |

Default is `tenant` if omitted.

### `triggers`

An array of trigger rules that the `SkillRouterService` uses to automatically activate this skill when a user message matches. The router evaluates all triggers across all skills and selects the highest-priority match.

#### Trigger Types

**`keyword`** -- Exact substring match in the user message. The most common and predictable trigger type.

```yaml
triggers:
  - type: keyword
    value: "请帮我分析这道题目"
    priority: 11
  - type: keyword
    value: "开始分析"
    priority: 10
```

**`pattern`** -- Regex pattern match against the user message. Use for flexible matching when exact keywords are too rigid.

```yaml
triggers:
  - type: pattern
    value: "分析.*题目"
    priority: 9
```

**`intent`** -- Semantic intent matching. The router interprets the user's intent rather than matching literal text. Best for natural language variation.

```yaml
triggers:
  - type: intent
    value: "quiz_analysis"
    priority: 8
```

**`context`** -- Matches based on session context (e.g., current state, active data). Use when activation depends on what the user is currently working on rather than what they say.

```yaml
triggers:
  - type: context
    value: "has_quiz_content"
    priority: 7
```

#### Priority

An integer from 1 to 100 (default: 5). When multiple skills match a user message, the skill with the highest priority trigger wins.

**Guidelines**:
- **90-100**: Exclusive triggers -- exact commands that should always activate this skill (e.g., "generate PPT")
- **10-20**: Primary triggers -- strong intent signals specific to this skill
- **5-9**: Secondary triggers -- general keywords that might also match other skills
- **1-4**: Fallback triggers -- broad matches, only activate if nothing else matches

### `allowedTools`

A list of MCP tool names that this skill is permitted to invoke. When the skill is active, only these tools are available to the AgentEngine. If empty or omitted, tool access is governed by the default session configuration.

```yaml
allowedTools:
  - parse_quiz_content
  - search_knowledge_points_json
  - search_catalog
  - write_output
```

Tool names must match the tool identifiers registered in your MCP server.

---

## Examples

### Minimal

The simplest valid SKILL.md frontmatter with only required fields:

```yaml
---
name: My Skill
slug: my-skill
description: A simple skill that does one thing well
---

# My Skill

Your skill prompt content goes here...
```

### Full-Featured

A skill with triggers, tools, and all optional fields:

```yaml
---
name: Quiz Analyzer - Three Column Analysis
slug: three-column-analysis
description: 三栏布局题目分析 - 解析题目、标注知识点、查找目录、生成思路
scope: tenant
triggers:
  - type: keyword
    value: "请帮我分析这道题目"
    priority: 11
  - type: keyword
    value: "开始分析"
    priority: 10
  - type: keyword
    value: "分析这道题"
    priority: 10
  - type: keyword
    value: "题目分析"
    priority: 9
  - type: keyword
    value: "解题思路"
    priority: 9
allowedTools:
  - parse_quiz_content
  - search_knowledge_points_json
  - search_catalog
  - write_output
  - generate_thinking_process_template
---

# 三栏布局题目分析

## 概述

配合前端三栏布局，提供完整的题目分析流程...
```

### Multi-Trigger with Mixed Types

```yaml
---
name: lesson-plan-pptx
slug: lesson-plan-pptx
description: 基于教案生成演示文稿
scope: tenant
triggers:
  - type: keyword
    value: "生成PPT"
    priority: 100
  - type: keyword
    value: "生成PDF"
    priority: 100
  - type: intent
    value: "generate_presentation"
    priority: 80
    description: User wants to create slides from their lesson plan
  - type: pattern
    value: "制作.*课件"
    priority: 85
allowedTools:
  - read_context
  - write_output
  - generate_pptx
---
```

### Global Scope Skill

```yaml
---
name: Platform Help
slug: platform-help
description: General platform help and onboarding guidance
scope: global
triggers:
  - type: keyword
    value: "帮助"
    priority: 2
  - type: keyword
    value: "help"
    priority: 2
---
```

---

## Best Practices

### Slug Naming

- Match the skill directory name to the slug
- Use descriptive, concise names: `three-column-analysis`, not `skill1` or `tca`
- Group related skills with a common prefix: `quiz-analysis`, `quiz-batch`, `quiz-export`

### Trigger Design

- Start with `keyword` triggers -- they are the most predictable and debuggable
- Use multiple keyword triggers to cover common phrasings of the same request
- Add `pattern` triggers only when keyword coverage is insufficient
- Reserve `intent` and `context` triggers for advanced routing scenarios
- Always test that your triggers do not conflict with other skills in the same solution

### Priority Allocation

Allocate priority ranges by purpose to avoid collisions:

```
100      Exclusive commands ("生成PPT" always means this skill)
 10-20   Primary intent ("分析这道题" is strongly this skill)
  5-9    Secondary keywords (might overlap with other skills)
  1-4    Broad fallbacks (low confidence matches)
```

### Tool Permissions

- List only the tools the skill actually needs -- principle of least privilege
- Include `write_output` if the skill updates frontend sync fields
- Include `read_context` if the skill needs to read the current form state
- Omit `allowedTools` entirely if the skill should have access to all available tools

---

## Validation

### How It Works

The backend validates SKILL.md frontmatter using the `SkillFrontmatterSchema` Zod schema defined in:

```
packages/backend/src/solutions/dto/skill-frontmatter.dto.ts
```

Validation runs automatically during solution auto-discovery. Invalid frontmatter prevents the skill from being registered and logs a detailed error.

### Programmatic Validation

```typescript
import { validateSkillFrontmatter } from './solutions/dto/skill-frontmatter.dto';

const result = validateSkillFrontmatter(parsedYaml);

if (result.success) {
  console.log('Valid:', result.data);
} else {
  console.error('Errors:', result.errors);
  // [{ path: 'slug', message: 'Slug must be lowercase...', code: 'invalid_string' }]
}
```

### Common Validation Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Skill name is required` | Missing or empty `name` field | Add a non-empty `name` |
| `Skill slug is required` | Missing or empty `slug` field | Add a valid slug |
| `Slug must be lowercase alphanumeric with hyphens` | Invalid slug format | Use only `a-z`, `0-9`, and `-` |
| `Skill description is required` | Missing or empty `description` | Add a non-empty `description` |
| `Priority must be at least 1` | Trigger priority < 1 | Use a value between 1 and 100 |
| `Priority must be at most 100` | Trigger priority > 100 | Use a value between 1 and 100 |
| `Priority must be an integer` | Trigger priority is a float | Use a whole number |
| `Trigger value must not be empty` | Empty trigger value | Provide a non-empty string |
| `Invalid enum value` | Invalid trigger type or scope | Use one of the allowed enum values |

---

## Related Documentation

- [Solution Developer Guide](./SOLUTION_DEVELOPER_GUIDE.md) -- Full integration guide for solution developers
- [Skill Registration](../packages/backend/docs/SKILL_REGISTRATION.md) -- How skills are registered to the backend database
- [Solution Best Practices](./SOLUTION_BEST_PRACTICES.md) -- General best practices for building solutions
