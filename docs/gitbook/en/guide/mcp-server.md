# MCP Server Development

## What is an MCP Server

An MCP (Model Context Protocol) Server provides external tools to the AI Agent. During task execution, the AI Agent can invoke tools exposed by the MCP Server to perform specific operations such as searching data, calling external APIs, or generating files.

## Two Implementation Approaches

| Approach | Description | Use Case |
|----------|-------------|----------|
| **REST API** | HTTP endpoints called via the LoopAI REST adapter | Recommended -- easy to debug and deploy |
| **stdio** | Communication via standard input/output | Uses `@modelcontextprotocol/sdk` |

{% hint style="info" %}
The LoopAI platform recommends the REST API approach for easier independent deployment, health checks, and logging.
{% endhint %}

## REST API Approach (Recommended)

### Project Structure

```
mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts       # Tool definitions and Express server
└── dist/              # Compiled output
```

### Basic Template

```typescript
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// write_output tool
app.post('/tools/write_output', (req, res) => {
  const { field, value, operation = 'set' } = req.body

  res.json({
    data: { field, value, operation },
    status: 'success'
  })
})

// Custom tool example
app.post('/tools/search_data', (req, res) => {
  const { query } = req.body

  // Business logic
  const results = performSearch(query)

  res.json({
    data: results,
    status: 'success'
  })
})

const PORT = process.env.PORT || 3004
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`)
})
```

### REST Adapter Endpoint Definition

When registering an MCP Server with CCAAS, you need to define the endpoint format:

```typescript
interface McpEndpoint {
  name: string          // Tool name
  description: string   // Tool description (read by the AI)
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string          // Endpoint path
  parameters: {
    name: string
    type: string
    description: string
    required: boolean
    in: 'body' | 'query' | 'path'
  }[]
}
```

### REST Adapter Configuration in solution.json

```json
{
  "mcpServers": {
    "my-tools": {
      "type": "rest-adapter",
      "url": "http://localhost:3004",
      "endpoints": [
        {
          "name": "write_output",
          "description": "Output structured data to the frontend",
          "method": "POST",
          "path": "/tools/write_output",
          "parameters": [
            {
              "name": "field",
              "type": "string",
              "description": "Name of the field to update",
              "required": true,
              "in": "body"
            },
            {
              "name": "value",
              "type": "string",
              "description": "Field value",
              "required": true,
              "in": "body"
            }
          ]
        }
      ]
    }
  }
}
```

## stdio Approach

If you need to use `@modelcontextprotocol/sdk`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({
  name: 'my-tools',
  version: '1.0.0'
})

// Register tools
server.tool(
  'write_output',
  'Output structured data to frontend',
  {
    field: z.string().describe('Field name to update'),
    value: z.string().describe('Field value')
  },
  async ({ field, value }) => {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ field, value, status: 'success' })
      }]
    }
  }
)

// Start server
const transport = new StdioServerTransport()
await server.connect(transport)
```

{% hint style="warning" %}
stdio-based MCP Servers must be migrated to the REST API approach before they can be used on the LoopAI platform. See the [MCP REST Migration Guide](../reference/migration.md).
{% endhint %}

## write\_output Tool

`write_output` is the most important MCP tool, used to synchronize AI-generated structured data to frontend forms.

### Basic Usage

When the AI Agent calls write\_output, it passes a field name and value:

```json
{
  "field": "title",
  "value": "Calculating Triangle Area",
  "operation": "set"
}
```

### Operation Types

| Operation | Description |
|-----------|-------------|
| `set` | Overwrite the field value (default) |
| `append` | Append to the existing value |
| `merge` | Merge objects |

For detailed usage, see [write\_output Best Practices](write-output.md).

## Authentication Configuration

The REST adapter supports multiple authentication methods:

```json
{
  "auth": {
    "type": "api-key",
    "header": "X-API-Key",
    "value": "${MY_API_KEY}"
  }
}
```

Supported authentication types:
- **api-key** -- Pass an API key via a custom header
- **bearer** -- Bearer token authentication
- **basic** -- HTTP Basic Auth
- **oauth2** -- OAuth2 authentication flow

## Debugging Tips

1. **Health check** -- First verify that the MCP Server's `/health` endpoint responds correctly
2. **Standalone testing** -- Use curl to call tool endpoints directly and verify the response format
3. **Check logs** -- MCP Server logs are your primary resource for troubleshooting
4. **Verify registration** -- Confirm that the MCP Server is correctly registered via the CCAAS API

```bash
# Health check
curl http://localhost:3004/health

# Test tool invocation
curl -X POST http://localhost:3004/tools/write_output \
  -H "Content-Type: application/json" \
  -d '{"field": "title", "value": "Test Title"}'

# Verify registration
curl http://localhost:3001/api/v1/mcp-servers
```
