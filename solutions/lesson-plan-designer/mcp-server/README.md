# Lesson Plan Designer MCP Server

This MCP server provides the `write_output` tool that enables Claude to send structured lesson plan data to the frontend form.

## Architecture

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐     ┌──────────────┐
│  LP Frontend    │────▶│  LP Backend         │────▶│  CCAAS Backend  │────▶│ Claude CLI   │
│  (React)        │     │  (Express)          │     │  (NestJS)       │     │              │
│  Port 5280      │◀────│  Port 3002          │◀────│  Port 3001      │◀────│              │
└─────────────────┘     └─────────────────────┘     └─────────────────┘     └──────────────┘
       │                        │                           │                      │
       │ output_update          │ solution.json             │ --mcp-config         │ uses
       │ → Sync buttons         │ mcpServers config         ▼                      ▼
       │                        │                    ┌──────────────┐        ┌──────────────┐
       │                        └───────────────────▶│ MCP Server   │◀───────│ write_output │
       │                                             │ (stdio)      │        │ tool         │
       │                                             └──────────────┘        └──────────────┘
```

## How It Works

1. `solution.json` defines the MCP server configuration
2. LP backend reads `solution.json` and passes `mcpServers` to CCAAS when sending chat messages
3. CCAAS includes the MCP config via `--mcp-config` flag when spawning Claude CLI
4. Claude uses the `write_output` tool to send structured data
5. CCAAS EventMapper transforms `write_output` results into `output_update` events
6. LP backend receives `output_update` and forwards to frontend
7. Frontend displays a "Sync to Form" button for each field

## Automatic Injection

MCP servers are automatically injected via `solution.json` - **no manual registration required**.

The LP backend reads `solution.json` at startup and includes the MCP server configuration in every chat message to CCAAS.

## Installation & Build

```bash
cd solutions/lesson-plan-designer/mcp-server
npm install
npm run build
```

Or use the solution setup script:

```bash
cd solutions/lesson-plan-designer
./setup.sh
```

## Tool: write_output

The `write_output` tool allows Claude to send structured lesson plan content to the frontend.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `field` | string | Yes | The lesson plan field to update |
| `value` | any | Yes | Structured data matching the field schema |
| `preview` | string | Yes | Human-readable summary for the sync button |

### Valid Fields

- `title` - Lesson title (string)
- `subject` - Subject area (string)
- `gradeLevel` - Grade level (string)
- `duration` - Lesson duration (string)
- `objectives` - Learning objectives (array)
- `standards` - Educational standards (array)
- `materials` - Required materials (array)
- `activities` - Teaching activities (array)
- `assessment` - Assessment plan (object)
- `differentiation` - Differentiation strategies (object)

### Example

```json
{
  "field": "objectives",
  "value": [
    {
      "id": "obj-1",
      "description": "学生能够理解核心概念",
      "bloomLevel": "understand",
      "assessmentCriteria": "能用自己的话解释"
    }
  ],
  "preview": "1个教学目标"
}
```

## Configuration

The MCP server is configured in `solution.json`:

```json
{
  "mcpServers": {
    "lesson-plan-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "Lesson Plan Designer MCP tools"
    }
  }
}
```

Paths in `args` are resolved relative to the solution directory.
