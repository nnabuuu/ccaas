# Bundles (Capability Packages)

A Bundle is a platform-level pluggable capability package that provides out-of-the-box MCP tools and event mappings for Solutions, eliminating the need for redundant implementation.

## Zero Configuration

By default, **all built-in Bundles are automatically enabled** for every Solution. No configuration needed — just build your Solution and all platform capabilities are available.

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

That's it. Your AI Agent automatically has access to `write_output`, `attach_file`, and `read_context` tools.

{% hint style="info" %}
This is **simple mode** (the default). If you need per-template control over which Bundles are active, see [Bundles: Advanced Configuration](bundles-advanced.md).
{% endhint %}

## Built-in Bundles

| Bundle | ID | What it does |
|--------|-----|-------------|
| **Structured Output** | `structured-output` | Maps `write_output` tool results → `output_update` events for frontend forms |
| **File Attachments** | `file-attachments` | Provides `attach_file` tool for AI-generated file attachments |
| **Shared Context** | `shared-context` | Provides `read_context` tool to read frontend-synced page context |

### structured-output

Automatically maps `write_output` tool results to `output_update` events pushed to the frontend form.

- **Tool source**: Your Solution's MCP Server (field schemas are Solution-specific)
- **Bundle provides**: Event trigger mapping only
- **Use cases**: Lesson plan design, form filling, any structured output scenario

### file-attachments

Provides the `attach_file` tool, allowing AI Agents to register files generated during a session as attachments.

- **Tool source**: Platform built-in MCP Server
- **Bundle provides**: MCP Server + event trigger mapping
- **Use cases**: PDF report generation, image export, any file attachment scenario

### shared-context

Provides the `read_context` tool, allowing AI Agents to read frontend-synced page context. Supports `full` and `diff` modes.

- **Tool source**: Platform built-in MCP Server
- **Bundle provides**: MCP Server (read-only, no event triggers)
- **Use cases**: Any scenario where the AI Agent needs awareness of what the user is viewing or editing

## Using file-attachments

### 1. Instruct the Agent in Your Skill

```markdown
# Output Instructions

When the user requests a file export, use the `attach_file` tool:

- filePath: Absolute path to the file to attach
- description: File description (displayed in the frontend)
```

### 2. Handle Attachment Events in the Frontend

`attach_file` results are pushed to the frontend via `output_update` events:

```typescript
import { useAgentChat } from '@kedge-agentic/react-sdk'

const chat = useAgentChat({
  connection,
  solutionId: 'my-solution',
  onOutputUpdate: (update) => {
    if (update.field === 'attachment') {
      addAttachment(update.value)
    }
  },
})
```

## Related Guides

- [write\_output Best Practices](write-output.md) — Detailed structured output usage
- [MCP Server Development](mcp-server.md) — Tool event trigger mechanism
- [Bundles: Advanced Configuration](bundles-advanced.md) — Per-template control, Admin API, troubleshooting
- [solution.json Reference](../reference/solution-json.md) — Complete configuration field reference
