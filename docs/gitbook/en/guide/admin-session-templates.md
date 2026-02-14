# Session Templates Management

Session Templates allow you to pre-configure agent behavior and reuse configurations across your application without hardcoding in frontend code.

## Overview

**What are Session Templates?**

Session Templates are reusable configurations that define:
- **System Prompts** - Custom instructions for the AI agent
- **Enabled Skills** - Which skills the agent can use
- **MCP Servers** - External tool integrations
- **Metadata** - Description and other settings

**Benefits:**
- ✅ Centralized configuration management
- ✅ Multi-tenant support (each tenant has their own templates)
- ✅ No code changes needed to update agent behavior
- ✅ Role-based agent personalities (teacher, student, admin, etc.)
- ✅ A/B testing different prompts

## Quick Start

### 1. Access Admin Dashboard

```bash
# Start admin frontend
npm run dev:admin
```

Navigate to: `http://localhost:5175/session-templates`

### 2. Create a Template

Click **"Create Template"** and fill in:

- **Name**: `teacher-assistant` (lowercase, hyphens only)
- **Description**: `Teacher view with full analysis features`
- **System Prompt**:
  ```
  You are an educational analyst assistant helping teachers.

  Your role:
  - Analyze student work and provide insights
  - Suggest teaching strategies
  - Provide curriculum alignment
  ```
- **Skills**: `knowledge-matching, complete-analysis`

Click **Save**.

### 3. Use Template in Frontend

```typescript
import { useAgentChat } from '@ccaas/react-sdk'

export function TeacherView() {
  const chat = useAgentChat({
    serverUrl: 'http://localhost:3001',
    tenantId: 'your-tenant-id',
    sessionTemplate: 'teacher-assistant', // ← Use your template
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
- Enabled skills (first 3 shown, "+N more")
- System prompt indicator
- Edit/Delete actions

### Create/Edit Form

**Tab 1: Basic Information**
- Template Name (immutable after creation)
- Description (optional)

**Tab 2: System Prompt**
- Multi-line markdown text area
- Appended to skill system prompts at runtime

**Tab 3: Skills**
- Comma-separated skill slugs
- Example: `knowledge-matching, analysis, planning`

**Tab 4: MCP Servers**
- JSON configuration for MCP servers
- Live validation

## API Endpoints

All endpoints require `admin` scope.

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
      "appendSystemPrompt": "You are...",
      "enabledSkillSlugs": ["knowledge-matching"]
    }
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
    "enabledSkillSlugs": ["knowledge-matching", "analysis"]
  }
}
```

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

## Common Use Cases

### Multi-Role Application

Create different templates for different user roles:

```typescript
const templateMap = {
  admin: 'admin-assistant',
  teacher: 'teacher-assistant',
  student: 'student-practice',
}

const chat = useAgentChat({
  tenantId: user.tenantId,
  sessionTemplate: templateMap[user.role],
})
```

### A/B Testing

Test different prompts to see which performs better:

```typescript
const template = user.id % 2 === 0
  ? 'variant-a'
  : 'variant-b'

const chat = useAgentChat({
  sessionTemplate: template,
})
```

### Multi-Tenant SaaS

Each tenant gets their own configured templates:

```typescript
// Each tenant can customize their own templates
const chat = useAgentChat({
  tenantId: user.tenantId,
  sessionTemplate: 'default-assistant',
})
```

## Template Resolution

Templates support parameter merging when you need to override or extend:

```typescript
// Template configuration (from Admin UI):
{
  "appendSystemPrompt": "You are a teacher assistant",
  "enabledSkillSlugs": ["knowledge-matching"]
}

// Frontend explicit params:
useAgentChat({
  sessionTemplate: 'teacher-assistant',
  enabledSkillSlugs: ['custom-skill'], // Overrides template
  appendSystemPrompt: 'Additional context', // Appends to template
})

// Final resolved params sent to backend:
{
  "enabledSkillSlugs": ["custom-skill"], // Explicit wins
  "appendSystemPrompt": "You are a teacher assistant\n\nAdditional context"
}
```

## Best Practices

### ✅ DO

- **Use descriptive names**: `teacher-analysis` not `template1`
- **Document in descriptions**: Help other admins understand the template
- **Test before deploying**: Create a test template first
- **Use role-based templates**: Different templates for different user roles
- **Keep prompts focused**: One clear purpose per template

### ❌ DON'T

- **Use uppercase or spaces**: Name must be `lowercase-with-hyphens`
- **Put secrets in prompts**: They're stored in database
- **Create duplicates**: Edit existing templates instead
- **Change names**: Delete + create to rename (names are immutable)

## Security

### Authentication

All admin endpoints require:
- **API Key**: With `admin` scope
- **Header**: `Authorization: Bearer <api-key>`

### Audit Trail

All template changes are logged:
- `sessionTemplate.create` - Template created
- `sessionTemplate.update` - Template modified (with before/after)
- `sessionTemplate.delete` - Template deleted (with deleted data)

View audit logs in Admin Dashboard → Audit Log.

## Troubleshooting

### Template not appearing in frontend

**Check:**
1. Correct `tenantId` in frontend matches template's tenant
2. Template name is spelled correctly
3. Template exists in database

**Debug:**
```bash
curl -H "Authorization: Bearer <key>" \
  http://localhost:3001/api/v1/admin/tenants/your-tenant/session-templates
```

### Template creation fails

**Error**: "Session template already exists"

**Solution**: Template names must be unique per tenant. Use edit instead or choose different name.

### Skills not working

**Check:**
1. Skill slugs are spelled correctly
2. Skills are registered in the system
3. Skills have been synced from solution backend

## Related Guides

- [Admin API Key Management](admin-api-keys.md) - Creating admin API keys
- [Frontend Integration Guide](frontend.md) - Using react-sdk
- [Skill Writing Guide](skill-writing.md) - Creating custom skills

## Complete Documentation

For detailed API reference, architecture details, and advanced features, see:
- **[Session Templates Admin Documentation](../../features/SESSION_TEMPLATES_ADMIN.md)**
- **[Quick Start Guide](../../quickstart/ADMIN_SESSION_TEMPLATES.md)**
