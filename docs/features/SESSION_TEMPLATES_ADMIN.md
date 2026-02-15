# Session Templates Admin Management

**Status**: ✅ Complete (Phase 2 Sprint 1)
**Date**: 2026-02-14
**Version**: Admin Phase 2

## Overview

The Session Templates Admin Management feature provides a web-based UI for managing Session Templates through the Admin Dashboard. This complements the existing frontend-only template resolution (via `solution.json`) by adding CRUD operations for templates stored in the tenant configuration.

## Features

### Template Management
- **List Templates** - View all session templates for a tenant
- **Create Template** - Create new templates with guided form
- **Edit Template** - Modify existing templates
- **Delete Template** - Remove templates
- **Preview Template** - Preview parameter resolution (API only)

### Template Configuration
- **System Prompt** - Append custom system prompts to agent conversations
- **Skills** - Enable specific skill slugs
- **MCP Servers** - Configure MCP server connections
- **Description** - Human-readable template description

## Architecture

### Data Flow

```
Admin UI (React)
    ↓ HTTP
Admin API (NestJS)
    ↓ TypeORM
Tenant.config.sessionTemplates
    ↓ Runtime
Frontend (react-sdk)
    ↓ WebSocket
Core Backend → AgentEngine
```

### Storage

Templates are stored in the `tenants` table, `config` JSONB column:

```json
{
  "config": {
    "sessionTemplates": {
      "teacher-analysis": {
        "description": "Teacher view - full analysis features",
        "appendSystemPrompt": "You are an educational analyst...",
        "enabledSkillSlugs": ["knowledge-matching", "complete-analysis"],
        "mcpServers": { ... }
      }
    }
  }
}
```

## Admin UI

### Location

**URL**: `http://localhost:5175/session-templates`

**Navigation**: Admin Dashboard → Session Templates (sidebar)

### List Page

**Features**:
- DataTable with sorting/filtering
- Template name, description, enabled skills
- System prompt indicator (Yes/No badge)
- Actions: Edit, Delete

**Columns**:
- Template Name
- Description
- Skills (first 3 shown, "+N more" badge)
- System Prompt (boolean badge)
- Actions (Edit/Delete buttons)

### Create/Edit Form

**Layout**: Tabbed interface with 3 sections

**Tab 1: Basic Information**
- Template Name (slug format: `teacher-analysis`)
  - Validation: `^[a-z0-9][a-z0-9_-]*$`
  - Immutable after creation
- Description (optional)

**Tab 2: System Prompt**
- Append System Prompt (textarea)
  - Merged with skill system prompt at runtime
  - Supports multi-line markdown

**Tab 3: Skills**
- Enabled Skill Slugs (comma-separated input)
  - Example: `knowledge-matching, complete-analysis`
  - Converted to array on save

**Tab 4: MCP Servers**
- MCP Servers (JSON editor)
  - Full MCP server configuration
  - Validated as JSON on change

**Actions**:
- Save - Create/update template
- Cancel - Return to list

## API Endpoints

Base path: `/api/v1/admin/tenants/:tenantId/session-templates`

### List Templates

```http
GET /api/v1/admin/tenants/:tenantId/session-templates
```

**Response**:
```json
{
  "templates": {
    "teacher-analysis": { ... },
    "student-practice": { ... }
  },
  "defaultTemplate": "teacher-analysis"
}
```

### Get Template

```http
GET /api/v1/admin/tenants/:tenantId/session-templates/:name
```

**Response**:
```json
{
  "name": "teacher-analysis",
  "template": {
    "description": "Teacher view",
    "appendSystemPrompt": "You are...",
    "enabledSkillSlugs": ["skill-1"]
  }
}
```

### Create Template

```http
POST /api/v1/admin/tenants/:tenantId/session-templates
Content-Type: application/json
```

**Request**:
```json
{
  "name": "teacher-analysis",
  "template": {
    "description": "Teacher view - full analysis features",
    "appendSystemPrompt": "You are an educational analyst...",
    "enabledSkillSlugs": ["knowledge-matching"],
    "mcpServers": { ... }
  }
}
```

**Response**: `201 Created`
```json
{
  "name": "teacher-analysis",
  "template": { ... }
}
```

**Validation**:
- Name must match pattern: `^[a-z0-9][a-z0-9_-]*$`
- Template must be valid SessionTemplate object
- Name must not already exist (409 Conflict)

**Audit Log**: Creates `sessionTemplate.create` entry

### Update Template

```http
PUT /api/v1/admin/tenants/:tenantId/session-templates/:name
Content-Type: application/json
```

**Request**:
```json
{
  "template": {
    "description": "Updated description",
    "appendSystemPrompt": "Updated prompt...",
    "enabledSkillSlugs": ["new-skill"]
  }
}
```

**Response**: `200 OK`
```json
{
  "name": "teacher-analysis",
  "template": { ... }
}
```

**Note**: Name cannot be changed (use Delete + Create to rename)

**Audit Log**: Creates `sessionTemplate.update` entry with before/after values

### Delete Template

```http
DELETE /api/v1/admin/tenants/:tenantId/session-templates/:name
```

**Response**: `200 OK`
```json
{
  "message": "Session template \"teacher-analysis\" deleted"
}
```

**Audit Log**: Creates `sessionTemplate.delete` entry with deleted template data

### Preview Template

```http
POST /api/v1/admin/tenants/:tenantId/session-templates/:name/preview
Content-Type: application/json
```

**Request**:
```json
{
  "explicitParams": {
    "enabledSkillSlugs": ["override-skill"],
    "appendSystemPrompt": "Additional prompt"
  }
}
```

**Response**: `200 OK`
```json
{
  "template": {
    "description": "Teacher view",
    "appendSystemPrompt": "You are...",
    "enabledSkillSlugs": ["knowledge-matching"]
  },
  "resolved": {
    "enabledSkillSlugs": ["override-skill"],
    "mcpServers": { ... },
    "appendSystemPrompt": "You are...\n\nAdditional prompt"
  }
}
```

**Use Case**: Preview how explicit parameters merge with template defaults

## Frontend Integration

### Using Templates from Admin UI

Templates created via Admin UI are stored in `tenant.config.sessionTemplates` and can be used immediately by frontends:

```typescript
// Frontend code (no changes needed)
import { useAgentChat } from '@ccaas/react-sdk'

const chat = useAgentChat({
  serverUrl: 'http://localhost:3001',
  tenantId: 'my-tenant',
  sessionTemplate: 'teacher-analysis', // ← Template created via Admin UI
})
```

### Parameter Resolution

Templates support parameter merging:

```typescript
// Template (from Admin UI):
{
  "appendSystemPrompt": "You are a teacher assistant",
  "enabledSkillSlugs": ["knowledge-matching"]
}

// Frontend explicit params:
useAgentChat({
  sessionTemplate: 'teacher-analysis',
  enabledSkillSlugs: ['custom-skill'], // Overrides template
  appendSystemPrompt: 'Additional context', // Appends to template
})

// Final resolved params:
{
  "enabledSkillSlugs": ["custom-skill"], // Explicit wins
  "appendSystemPrompt": "You are a teacher assistant\n\nAdditional context"
}
```

## Security

### Authentication

All endpoints require:
- **Scope**: `admin`
- **Header**: `Authorization: Bearer <api-key>`

### Validation

**Backend validation**:
- Template name pattern validation
- SessionTemplate schema validation (via class-validator)
- Tenant existence check
- Duplicate name prevention

**Frontend validation**:
- Zod schema validation on form submit
- Real-time JSON validation for MCP servers
- Skill slug format validation

### Audit Trail

All mutations (create/update/delete) are logged to `admin_audit_logs` table:

```sql
INSERT INTO admin_audit_logs (
  admin_id,
  action,
  target_type,
  target_id,
  tenant_id,
  metadata
) VALUES (
  'api-key-123',
  'sessionTemplate.create',
  'tenant',
  'my-tenant',
  'my-tenant',
  '{"templateName": "teacher-analysis", "template": {...}}'
);
```

## Data Provider Integration

The Admin UI uses Refine's data provider pattern:

```typescript
// packages/admin-next/src/providers/data-provider.ts
export const dataProvider: DataProvider = {
  getList: async ({ resource, meta }) => {
    if (resource === 'session-templates') {
      const tenantId = meta?.tenantId || 'current'
      const { data } = await apiClient.get(
        `/admin/tenants/${tenantId}/session-templates`
      )

      // Transform { templates: {} } to array
      return {
        data: Object.entries(data.templates || {}).map(([name, template]) => ({
          name,
          template,
        })),
        total: Object.keys(data.templates || {}).length,
      }
    }
  },

  create: async ({ resource, variables, meta }) => {
    if (resource === 'session-templates') {
      const tenantId = meta?.tenantId || 'current'
      const { data } = await apiClient.post(
        `/admin/tenants/${tenantId}/session-templates`,
        variables
      )
      return { data }
    }
  },

  // update, deleteOne, getOne...
}
```

## Known Limitations

### Not Implemented in Phase 2 Sprint 1

1. **Default Template Selection**
   - UI for setting `tenant.config.defaultSessionTemplate`
   - Status: Deferred to future sprint

2. **Template Inheritance**
   - `extends` field support for template composition
   - Status: Deferred to future sprint

3. **Skill Validation**
   - Startup validation that skill slugs exist
   - Status: Deferred to future sprint

4. **Real-time Preview**
   - Live preview of resolved parameters in form
   - Status: Deferred to future sprint

5. **Bulk Operations**
   - Import/export templates as JSON
   - Status: Deferred to future sprint

### Current Constraints

- **Storage**: Templates stored in `tenant.config` JSONB column (not separate table)
- **Tenant Scope**: Templates are tenant-specific (no global templates)
- **Name Immutability**: Template name cannot be changed after creation (delete + recreate to rename)

## Migration from solution.json

Existing templates in `solution.json` can be migrated to Admin UI:

**Before** (`solution.json`):
```json
{
  "sessionTemplates": {
    "teacher-analysis": {
      "description": "Teacher view",
      "appendSystemPrompt": "You are...",
      "enabledSkillSlugs": ["knowledge-matching"]
    }
  }
}
```

**After** (Admin UI):
1. Navigate to Session Templates page
2. Click "Create Template"
3. Fill in form with same values
4. Save

**Note**: Templates in `solution.json` still work (frontend resolution) but won't appear in Admin UI.

## Testing

### Manual Testing Checklist

**Create Template**:
- [ ] Navigate to `/session-templates`
- [ ] Click "Create Template"
- [ ] Fill in valid template name (e.g., `test-template`)
- [ ] Add description
- [ ] Add system prompt in "System Prompt" tab
- [ ] Add skill slugs in "Skills" tab (e.g., `skill-1, skill-2`)
- [ ] Add MCP config in "MCP Servers" tab (valid JSON)
- [ ] Click "Save"
- [ ] Verify template appears in list

**Edit Template**:
- [ ] Click "Edit" on existing template
- [ ] Modify description
- [ ] Modify system prompt
- [ ] Click "Save"
- [ ] Verify changes in list

**Delete Template**:
- [ ] Click "Delete" on template
- [ ] Confirm deletion
- [ ] Verify template removed from list

**Validation**:
- [ ] Try creating template with invalid name (should fail)
- [ ] Try creating duplicate template (should fail with 409)
- [ ] Try invalid JSON in MCP tab (should show error)

### API Testing

```bash
# List templates
curl -H "Authorization: Bearer <api-key>" \
  http://localhost:3001/api/v1/admin/tenants/default/session-templates

# Create template
curl -X POST \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-template",
    "template": {
      "description": "Test template",
      "appendSystemPrompt": "You are a test assistant",
      "enabledSkillSlugs": ["test-skill"]
    }
  }' \
  http://localhost:3001/api/v1/admin/tenants/default/session-templates

# Get template
curl -H "Authorization: Bearer <api-key>" \
  http://localhost:3001/api/v1/admin/tenants/default/session-templates/test-template

# Update template
curl -X PUT \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "template": {
      "description": "Updated test template",
      "appendSystemPrompt": "You are an updated test assistant",
      "enabledSkillSlugs": ["test-skill", "another-skill"]
    }
  }' \
  http://localhost:3001/api/v1/admin/tenants/default/session-templates/test-template

# Delete template
curl -X DELETE \
  -H "Authorization: Bearer <api-key>" \
  http://localhost:3001/api/v1/admin/tenants/default/session-templates/test-template

# Preview template
curl -X POST \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "explicitParams": {
      "enabledSkillSlugs": ["override-skill"]
    }
  }' \
  http://localhost:3001/api/v1/admin/tenants/default/session-templates/test-template/preview
```

## Troubleshooting

### Template not appearing in list

**Symptom**: Created template doesn't show in Admin UI list

**Causes**:
1. Wrong tenant selected in UI
2. Database not updated
3. Data provider not transforming response correctly

**Debug**:
```bash
# Check database
sqlite3 .agent-workspace/data.db "SELECT id, config FROM tenants WHERE id='your-tenant';"

# Check API response
curl -H "Authorization: Bearer <key>" \
  http://localhost:3001/api/v1/admin/tenants/your-tenant/session-templates | jq .
```

### Template creation fails with 409 Conflict

**Symptom**: "Session template already exists" error

**Cause**: Template with same name already exists

**Solution**: Use different name or delete existing template first

### Frontend can't use template

**Symptom**: Frontend `useAgentChat({ sessionTemplate: 'my-template' })` doesn't work

**Causes**:
1. Wrong `tenantId` in frontend
2. Template created in different tenant
3. react-sdk version doesn't support templates

**Debug**:
```typescript
// Verify template resolution
const chat = useAgentChat({
  tenantId: 'your-tenant', // Must match template's tenant
  sessionTemplate: 'my-template',
})

console.log('Template resolved:', chat.resolvedParams)
```

## Related Documentation

- **[Session Templates Phase 2 Complete](../SESSION_TEMPLATE_PHASE2_COMPLETE.md)** - Core backend implementation
- **[AUTHENTICATION_AND_AUTHORIZATION.md](../../packages/backend/docs/AUTHENTICATION_AND_AUTHORIZATION.md)** - Admin API authentication
- **[Admin API Keys Guide](../gitbook/en/guide/admin-api-keys.md)** - Creating admin API keys

## Future Enhancements

### Phase 3 (Planned)
- Default template selection UI
- Template inheritance (`extends` field)
- Skill slug validation against database
- Template usage analytics

### Phase 4 (Planned)
- Import/export templates as JSON
- Template versioning
- Template cloning
- Global templates (cross-tenant)
- Template preview with live parameter resolution

## Support

**Issues**: Report bugs at https://github.com/anthropics/claude-code/issues

**Questions**: See `/help` command in CLI or contact support
