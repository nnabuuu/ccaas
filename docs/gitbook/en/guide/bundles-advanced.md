# Bundles: Advanced Configuration

This page covers advanced Bundle configuration for Solutions that need per-template control over which capabilities are active. For most Solutions, the default [simple mode](bundles.md) (zero configuration) is sufficient.

## When to Use Advanced Mode

Use `mode: "advanced"` when:

- **Different roles need different capabilities** — e.g., "teacher" mode needs `structured-output` but not `file-attachments`, while "export" mode needs both
- **You want to minimize MCP Server overhead** — only enable what each session template actually uses
- **You're building a multi-template Solution** with specialized behavior per template

## Enabling Advanced Mode

Set `mode: "advanced"` in your `solution.json` and declare `bundles` in each session template:

```json
{
  "schemaVersion": "3.0",
  "mode": "advanced",
  "tenant": {
    "name": "Lesson Plan Designer",
    "slug": "lesson-plan-designer"
  },
  "sessionTemplates": {
    "teacher": {
      "description": "Teacher lesson planning mode",
      "enabledSkills": ["lesson-plan-designer"],
      "bundles": ["structured-output"]
    },
    "export": {
      "description": "Export mode (with file attachments)",
      "enabledSkills": ["lesson-plan-designer"],
      "bundles": ["structured-output", "file-attachments", "shared-context"]
    }
  },
  "mcpServers": {
    "lesson-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"]
    }
  }
}
```

## Two-Layer Configuration

In advanced mode, Bundles are controlled through two configuration layers:

```
┌──────────────────────────────┐
│  Solution Level                 │
│  config.enabledBundles       │  ← Total set of bundles enabled for this solution
│  ["structured-output",       │
│   "file-attachments",        │
│   "shared-context"]          │
└─────────────┬────────────────┘
              │ subset
┌─────────────▼────────────────┐
│  Session Template Level       │
│  template.bundles            │  ← Bundles activated for a specific template
│  ["structured-output"]       │
└──────────────────────────────┘
```

**Rules:**
- Session Template `bundles` must be a **subset** of Solution `enabledBundles`
- If a Session Template doesn't specify `bundles`, all Solution `enabledBundles` are used
- Bundles not in Solution `enabledBundles` are silently ignored with a warning log

{% hint style="info" %}
**How are Solution `enabledBundles` populated?** In advanced mode, bundles declared in `sessionTemplates.bundles` are automatically synced to the Solution's `enabledBundles` when the Solution loads. You can also manage them via the Admin API (see below).
{% endhint %}

## Simple vs Advanced Comparison

| Aspect | Simple (default) | Advanced |
|--------|-----------------|----------|
| Configuration | None needed | `mode: "advanced"` + per-template `bundles` |
| Bundle activation | All built-in Bundles auto-enabled | Only declared Bundles enabled |
| MCP server dedup | Auto-filters bundle-provided servers from `mcpServers` | No filtering — you manage manually |
| Best for | Most Solutions | Multi-template Solutions with role-based capabilities |

## Admin API

Admin endpoints for viewing and managing Bundle configuration. All endpoints require an API Key with `admin` scope.

### List All Available Bundles

```http
GET /api/v1/admin/bundles
Authorization: Bearer <admin-api-key>
```

**Response:**
```json
{
  "bundles": [
    {
      "id": "structured-output",
      "name": "Structured Output",
      "description": "Sync AI-generated structured data to frontend forms via write_output tool.",
      "toolEventTriggers": [
        { "toolName": "write_output", "eventType": "output_update" }
      ]
    },
    {
      "id": "file-attachments",
      "name": "File Attachments",
      "description": "Attach session-generated files as output via attach_file tool.",
      "mcpServer": { "command": "node", "args": ["..."] },
      "toolEventTriggers": [
        { "toolName": "attach_file", "eventType": "output_update" }
      ]
    },
    {
      "id": "shared-context",
      "name": "Shared Context",
      "description": "Read frontend-synced page context via read_context tool.",
      "mcpServer": { "command": "node", "args": ["..."] },
      "toolEventTriggers": []
    }
  ]
}
```

### Get Solution Enabled Bundles

```http
GET /api/v1/admin/solutions/:solutionId/bundles
Authorization: Bearer <admin-api-key>
```

### Update Solution Bundle Configuration

```http
PATCH /api/v1/admin/solutions/:solutionId/bundles
Authorization: Bearer <admin-api-key>
Content-Type: application/json

{
  "enabledBundles": ["structured-output", "file-attachments", "shared-context"]
}
```

{% hint style="warning" %}
After updating, newly created sessions will use the new configuration. Existing sessions are not affected.
{% endhint %}

## Best Practices

### ✅ Do

- **Start with simple mode** — Only switch to advanced mode when you genuinely need per-template control
- **Enable selectively in advanced mode** — Only enable Bundles each template actually needs
- **Control precisely in Session Templates** — Different roles may need different Bundle combinations

### ❌ Don't

- **Over-configure** — If all templates need the same Bundles, use simple mode instead
- **Re-implement in MCP Server** — Event mappings already handled by Bundles don't need manual `toolEventTriggers`
- **Ignore the subset rule** — Bundles referenced in a Session Template but not enabled at Solution level are silently ignored

## Troubleshooting

### write_output doesn't trigger output_update events

1. Verify the Solution has `structured-output` Bundle enabled:
   ```bash
   curl -H "Authorization: Bearer <key>" \
     http://localhost:3001/api/v1/admin/solutions/<solutionId>/bundles
   ```
2. If using advanced mode with Session Templates, verify the template's `bundles` includes `structured-output`
3. Verify the `write_output` tool return format is correct in your MCP Server (`data` must be inside `content[].text` JSON)

### attach_file tool is not available

1. Verify the Solution has `file-attachments` Bundle enabled
2. Verify the `attach-file-server` build artifacts exist: `packages/mcp/attach-file-server/dist/index.js`
3. Check that the `CORE_MCP_DIR` environment variable correctly points to the MCP server directory

### read_context tool is not available

1. Verify the Solution has `shared-context` Bundle enabled
2. Verify the `shared-context-server` build artifacts exist: `packages/mcp/shared-context-server/dist/index.js`
3. In simple mode, ensure you haven't manually declared a `shared-context-server` in `mcpServers` with a different path

### Bundle configuration in Session Template is ignored

Check the backend logs for warnings like:
```
Bundle "xxx" referenced in template but not enabled at tenant level — skipping
```
This means the Bundle is not enabled at the Solution level. Enable it via the Admin API's `enabledBundles` endpoint.

### How to see which Bundles are active for a session

The backend outputs a debug log when creating a session:
```
Resolved 3 active bundle(s): structured-output, file-attachments, shared-context
```
Set the backend log level to `debug` to see detailed Bundle resolution.

## Related Guides

- [Bundles Overview](bundles.md) — Built-in Bundles and simple mode
- [Session Templates Management](admin-session-templates.md) — Session Template configuration
- [solution.json Reference](../reference/solution-json.md) — Complete configuration field reference
