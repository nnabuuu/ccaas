# MCP REST Migration Guide

## Background

The KedgeAgentic platform uses a REST adapter to communicate with MCP Servers. If your MCP Server uses stdio mode (based on `@modelcontextprotocol/sdk`), you will need to migrate it to REST API mode.

## Migration Steps

### 1. Modify mcp-server/src/index.ts

**Before migration** (stdio mode):

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = new McpServer({ name: 'my-tools', version: '1.0.0' })

server.tool('write_output', '...', schema, handler)

const transport = new StdioServerTransport()
await server.connect(transport)
```

**After migration** (REST mode):

```typescript
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.post('/tools/write_output', (req, res) => {
  const { field, value, operation = 'set' } = req.body
  res.json({
    data: { field, value, operation },
    status: 'success'
  })
})

// Other tool endpoints...

const PORT = process.env.PORT || 3004
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`)
})
```

### 2. Update package.json

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0"
  }
}
```

Remove dependencies that are no longer needed:

```bash
npm uninstall @modelcontextprotocol/sdk
```

### 3. Update inject-skills.sh

Add MCP Server registration:

```bash
#!/bin/bash
CCAAS_URL="http://localhost:3001"

# Register MCP Server
curl -X POST "$CCAAS_URL/api/v1/mcp-servers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-tools",
    "url": "http://localhost:3004",
    "description": "My Solution Tools"
  }'
```

### 4. Update setup.sh

Add MCP Server startup:

```bash
#!/bin/bash

# Build MCP Server
echo "Building MCP Server..."
npm run build --prefix mcp-server

# Start MCP Server
echo "Starting MCP Server..."
node mcp-server/dist/index.js &
MCP_PID=$!
echo "MCP Server PID: $MCP_PID"

# Wait for MCP Server to be ready
sleep 2
curl -s http://localhost:3004/health || {
  echo "MCP Server failed to start"
  exit 1
}
```

### 5. Update solution.json

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
            { "name": "field", "type": "string", "required": true, "in": "body" },
            { "name": "value", "type": "string", "required": true, "in": "body" },
            { "name": "operation", "type": "string", "required": false, "in": "body" }
          ]
        }
      ]
    }
  }
}
```

## Port Assignments

| Solution | MCP Server Port |
|----------|----------------|
| problem-explainer | 3004 |
| lesson-plan-designer | 3005 |
| New Solutions | 3006+ |

## Verification Steps

### 1. Build

```bash
cd mcp-server && npm run build
```

### 2. Start and Test

```bash
# Start MCP Server
node dist/index.js

# Health check
curl http://localhost:3004/health

# Test a tool
curl -X POST http://localhost:3004/tools/write_output \
  -H "Content-Type: application/json" \
  -d '{"field": "title", "value": "Test"}'
```

### 3. Inject and Verify

```bash
# Inject into CCAAS
./inject-skills.sh

# Confirm registration was successful
curl http://localhost:3001/api/v1/mcp-servers
```

### 4. End-to-End Testing

Start the complete Solution, send a message to trigger the AI to call write\_output, and confirm that the frontend receives the output\_update event.

## Troubleshooting

### Tools Not Visible

- Confirm the MCP Server is running and passes the health check
- Confirm it has been registered with CCAAS
- Confirm the endpoint definitions in solution.json are correct

### Tool Calls Failing

- Check the MCP Server logs
- Confirm the endpoint paths and parameter formats are correct
- Test the endpoint directly with curl

### write\_output Not Displaying

- Confirm the Skill's `allowedTools` includes `write_output`
- Confirm the frontend is listening for `output_update` events
- Check the nested structure parsing (`event.payload.data`)
