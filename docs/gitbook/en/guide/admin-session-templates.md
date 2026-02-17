# Session Templates Management

Session Templates allow you to pre-configure agent behavior and reuse configurations across your application without hardcoding in frontend code.

## Overview

**What are Session Templates?**

Session Templates are reusable configurations stored per-tenant that define:
- **System Prompts** — Custom instructions appended to the agent's base prompt
- **Enabled Skills** — Which skills the agent can use
- **MCP Servers** — External tool integrations
- **Model Override** — Override the default AI model for this template
- **Description** — Human-readable label for admin reference

**Benefits:**
- ✅ Centralized configuration — update agent behavior without code deploys
- ✅ Multi-tenant support — each tenant has independent template sets
- ✅ Role-based agent personalities (teacher, student, admin, etc.)
- ✅ A/B testing different prompts
- ✅ Full audit trail for compliance

**Limits:**
- Maximum **50 templates per tenant**
- Template names are **immutable** after creation

## When to Use This

### The Core Problem: Same Agent, Different Users

Most real applications have multiple user roles — and different roles should get different AI capabilities. A manager should see more data than an intern. A teacher should have tools a student shouldn't touch. An admin should be able to do things a regular user cannot.

The naive solution is to pass configuration directly from the frontend:

```typescript
// ❌ Naive approach — frontend decides what the agent can do
const chat = useAgentChat({
  enabledSkillSlugs: user.role === 'teacher' ? ['analyze', 'grade'] : ['hint'],
  appendSystemPrompt: user.role === 'teacher' ? 'You are...' : 'You are...',
})
```

This breaks down in three ways:

1. **Security gap** — The frontend controls what skills and tools the agent has access to. A determined user could pass any skill slug they want. There's no server-side enforcement.
2. **Operational fragility** — Every time you need to change a prompt or add a skill to one role, you have to modify code and redeploy. The AI team can't iterate independently.
3. **Scattered configuration** — Agent behavior is scattered across frontend components instead of managed in one place.

### The Solution: Server-Side Role Configurations

Session Templates move this configuration to the **server side**, managed by admins. The frontend only names which template to use:

```typescript
// ✅ With templates — frontend declares intent, server enforces capability
const chat = useAgentChat({
  sessionTemplate: user.role === 'teacher' ? 'teacher-mode' : 'student-mode',
})
```

The key insight is the **separation of concerns**:

| Responsibility | Who Controls It |
|---|---|
| _What_ the agent can do (skills, MCPs, prompt) | **Admin** — via Session Templates |
| _When_ the agent is invoked and by whom | **Frontend** — via template name |

This means your AI team can update prompts, add skills, or swap models at runtime through the Admin UI — without touching the codebase.

### Example: Math Tutoring Platform

A concrete illustration. Teachers and students both chat with the same AI agent, but need completely different capabilities:

**Teacher** needs full analytical power:
- `curriculum-analyzer` skill — maps questions to the textbook syllabus
- `student-progress` MCP — queries the school's gradebook (private data)
- Tone: detailed, analytical (_"This tests §3.2 linear equations, difficulty 3"_)
- Model: `claude-opus-4-6` for depth

**Student** needs guided practice only:
- `practice-hint` skill — gives step-by-step hints, never reveals the full answer
- No MCP access — gradebook data is off-limits
- Tone: encouraging, Socratic (_"Good try! What if you moved x to the other side?"_)
- Model: `claude-haiku-4-5` for speed and cost

Two templates capture this completely:

| | `teacher-mode` | `student-mode` |
|---|---|---|
| Skills | `curriculum-analyzer`, `practice-hint` | `practice-hint` only |
| MCP Servers | `student-progress` (gradebook) | _(none)_ |
| System Prompt | Analytical, curriculum-aware | Encouraging, Socratic |
| Model | `claude-opus-4-6` | `claude-haiku-4-5` |

When the head teacher says _"always cite the textbook page number"_, an admin edits the `teacher-mode` template in the Admin UI. It takes effect immediately — **no code change, no deployment**. Students are unaffected.

This pattern applies to any domain where roles matter: support agents vs. customers, analysts vs. viewers, admins vs. end-users.

---

## Quick Start

### 1. Access Admin Dashboard

```bash
npm run dev:admin
```

Navigate to: `http://localhost:5175/session-templates`

### 2. Create a Template

Click **"Create Template"** and fill in:

| Field | Example | Notes |
|-------|---------|-------|
| Name | `teacher-assistant` | Lowercase, hyphens/underscores only. Immutable after creation. |
| Description | `Teacher view with full analysis` | Optional, max 500 chars |
| Model Override | `claude-opus-4-6` | Optional — leave blank to use tenant default |
| System Prompt | `You are a teacher assistant...` | Appended at runtime, max 10,000 chars |
| Skill Slugs | `knowledge-matching, analysis` | Comma-separated |
| MCP Servers | `{ "server": { "command": "node", ... } }` | JSON format |

Click **Save**.

### 3. Use Template in Frontend

```typescript
import { useAgentChat } from '@ccaas/react-sdk'

export function TeacherView() {
  const chat = useAgentChat({
    serverUrl: 'http://localhost:3001',
    tenantId: 'your-tenant-id',
    sessionTemplate: 'teacher-assistant', // ← Use your template name
  })

  return (
    <ChatInterface
      messages={chat.messages}
      onSend={chat.sendMessage}
      isProcessing={chat.isProcessing}
    />
  )
}
```

## Admin UI Features

### List Page

View all session templates with:
- Template name and description
- Enabled skills (first 3 shown, "+N more" badge for overflow)
- System prompt indicator (Yes/No badge)
- Edit / Delete actions

Deleting a template shows a confirmation dialog — click **Delete** to confirm.

### Create/Edit Form

**Basic Information Card**
- Template Name (required; immutable after creation)
- Description (optional)
- Model Override (optional — override the AI model for this template)

**Tab: System Prompt**
- Multi-line text area (max 10,000 chars)
- Content is appended to any skill system prompts at runtime

**Tab: Skills**
- Comma-separated skill slugs
- Example: `knowledge-matching, analysis, planning`

**Tab: MCP Servers**
- JSON configuration for MCP tool servers
- Live JSON validation with inline error message

## Template Fields Reference

| Field | Type | Max Length | Description |
|-------|------|-----------|-------------|
| `description` | string | 500 | Human-readable description |
| `appendSystemPrompt` | string | 10,000 | Prompt appended to agent instructions |
| `enabledSkillSlugs` | string[] | — | Skills the agent is allowed to use |
| `mcpServers` | object | — | MCP server configurations (see format below) |
| `model` | string | 128 | Model ID override (e.g. `claude-opus-4-6`) |

### MCP Server Format

```json
{
  "server-name": {
    "command": "node",
    "args": ["server.js"],
    "description": "Optional description"
  }
}
```

## API Endpoints

All endpoints require an API key with `admin` scope.

### List Templates

```http
GET /api/v1/admin/tenants/:tenantId/session-templates
Authorization: Bearer <admin-api-key>
```

**Response:**
```json
{
  "templates": {
    "teacher-assistant": {
      "description": "Teacher view",
      "appendSystemPrompt": "You are an educational analyst...",
      "enabledSkillSlugs": ["knowledge-matching"],
      "model": "claude-opus-4-6"
    }
  },
  "defaultTemplate": "teacher-assistant"
}
```

### Get Single Template

```http
GET /api/v1/admin/tenants/:tenantId/session-templates/:name
Authorization: Bearer <admin-api-key>
```

**Response:**
```json
{
  "name": "teacher-assistant",
  "template": {
    "description": "Teacher view",
    "appendSystemPrompt": "You are an educational analyst..."
  }
}
```

### Create Template

```http
POST /api/v1/admin/tenants/:tenantId/session-templates
Authorization: Bearer <admin-api-key>
Content-Type: application/json

{
  "name": "teacher-assistant",
  "template": {
    "description": "Teacher view",
    "appendSystemPrompt": "You are an educational analyst...",
    "enabledSkillSlugs": ["knowledge-matching", "analysis"],
    "model": "claude-opus-4-6"
  }
}
```

**Error responses:**
- `409 Conflict` — Template name already exists
- `400 Bad Request` — Tenant has reached the 50-template limit

### Update Template

```http
PUT /api/v1/admin/tenants/:tenantId/session-templates/:name
Authorization: Bearer <admin-api-key>
Content-Type: application/json

{
  "template": {
    "description": "Updated description",
    "appendSystemPrompt": "Updated prompt...",
    "enabledSkillSlugs": ["new-skill"]
  }
}
```

### Delete Template

```http
DELETE /api/v1/admin/tenants/:tenantId/session-templates/:name
Authorization: Bearer <admin-api-key>
```

> **Note:** If the deleted template was set as the tenant's `defaultSessionTemplate`, that reference is automatically cleared.

### Preview Template Resolution

Useful for testing how a template merges with explicit frontend parameters before deploying:

```http
POST /api/v1/admin/tenants/:tenantId/session-templates/:name/preview
Authorization: Bearer <admin-api-key>
Content-Type: application/json

{
  "explicitParams": {
    "enabledSkillSlugs": ["override-skill"],
    "appendSystemPrompt": "Additional context"
  }
}
```

**Response:**
```json
{
  "template": { ... },
  "resolved": {
    "enabledSkillSlugs": ["override-skill"],
    "appendSystemPrompt": "Template base prompt\n\nAdditional context",
    "mcpServers": {}
  }
}
```

## Template Resolution Rules

When a frontend passes both a `sessionTemplate` and explicit parameters, they merge according to these rules:

| Field | Merge Strategy |
|-------|---------------|
| `enabledSkillSlugs` | **Replace** — explicit value wins entirely |
| `mcpServers` | **Shallow merge** — explicit servers added/override template servers |
| `appendSystemPrompt` | **Append** — explicit content appended after template content |
| `model` | **Replace** — explicit value wins |

```typescript
// Template (from Admin UI):
{
  "appendSystemPrompt": "You are a teacher assistant",
  "enabledSkillSlugs": ["knowledge-matching"],
  "mcpServers": { "server-a": { ... } }
}

// Frontend explicit params:
useAgentChat({
  sessionTemplate: 'teacher-assistant',
  enabledSkillSlugs: ['custom-skill'],       // Replaces template list
  appendSystemPrompt: 'Additional context',  // Appended after template prompt
  // mcpServers not specified → template servers are used
})

// Final resolved params sent to backend:
{
  "enabledSkillSlugs": ["custom-skill"],
  "appendSystemPrompt": "You are a teacher assistant\n\nAdditional context",
  "mcpServers": { "server-a": { ... } }
}
```

## Common Use Cases

### Multi-Role Application

```typescript
const templateMap: Record<string, string> = {
  admin: 'admin-assistant',
  teacher: 'teacher-assistant',
  student: 'student-practice',
}

const chat = useAgentChat({
  tenantId: user.tenantId,
  sessionTemplate: templateMap[user.role],
})
```

### A/B Testing Prompts

```typescript
const template = user.id % 2 === 0 ? 'variant-a' : 'variant-b'

const chat = useAgentChat({ sessionTemplate: template })
```

### Multi-Tenant SaaS

```typescript
// Each tenant manages their own templates through the Admin UI.
// Frontend just references the template name:
const chat = useAgentChat({
  tenantId: user.tenantId,
  sessionTemplate: 'default-assistant',
})
```

## Best Practices

### ✅ DO

- **Use descriptive names**: `teacher-analysis` not `template1`
- **Document in descriptions**: Help other admins understand the template's purpose
- **Test with Preview API**: Verify merging behavior before deploying
- **Use role-based templates**: Different templates for different user roles
- **Keep prompts focused**: One clear purpose per template

### ❌ DON'T

- **Use uppercase or spaces**: Name must match `[a-z0-9][a-z0-9_-]*`
- **Put secrets in prompts**: They are stored in the database (not encrypted)
- **Create duplicates**: Edit existing templates instead
- **Rename templates**: Delete + recreate to rename (names are immutable)
- **Exceed 50 templates**: Plan your template hierarchy to stay within the limit

## Security

### Authentication

All admin endpoints require:
- API Key with `admin` scope
- Header: `Authorization: Bearer <api-key>`

### Audit Trail

Every template change is logged automatically:

| Action | Logged Data |
|--------|-------------|
| `sessionTemplate.create` | Template name + full template config |
| `sessionTemplate.update` | Template name + before/after values |
| `sessionTemplate.delete` | Template name + deleted template config |

View audit logs: **Admin Dashboard → Audit Log**

## Troubleshooting

### Template not appearing in frontend

**Check:**
1. `tenantId` in frontend matches the tenant that owns the template
2. Template name is spelled exactly (case-sensitive)
3. Template exists — verify via API:

```bash
curl -H "Authorization: Bearer <key>" \
  http://localhost:3001/api/v1/admin/tenants/<tenantId>/session-templates
```

### Template creation returns 409

**Error**: `Session template already exists`

**Solution**: Template names must be unique per tenant. Use Edit to update the existing template, or choose a different name.

### Template creation returns 400 (limit reached)

**Error**: `Tenant has reached the maximum of 50 session templates`

**Solution**: Delete unused templates or consolidate configurations.

### Skills not applying

**Check:**
1. Skill slugs are spelled correctly (exact match required)
2. Skills are registered and active in the system
3. Skills have been synced from the solution backend

## Related Guides

- [Admin API Key Management](admin-api-keys.md) — Creating admin API keys
- [Frontend Integration Guide](frontend.md) — Using `@ccaas/react-sdk`
- [Skill Writing Guide](skill-writing.md) — Creating custom skills
