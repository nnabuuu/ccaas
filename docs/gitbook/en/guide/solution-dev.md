# Solution Development Guide

## Overview

A Solution is a vertical application built on the LoopAI platform. Each Solution consists of a frontend, backend (optional), MCP Server, and Skills, working together to deliver an end-to-end user experience.

## Architecture

```
User ──→ Solution Frontend
            │
            ▼
      Solution Backend ──→ CCAAS Backend ──→ AI Agent
            │                                  │
            │                                  ▼
            │                            MCP Server
            │                          (Tool Invocations)
            ▼
      Business Data Store
```

**Key Principle**: The Solution backend should leverage the CCAAS backend's capabilities (session management, Skill routing, message persistence) rather than re-implementing them.

## Directory Structure

```
my-solution/
├── solution.json           # Solution configuration (required)
├── setup.sh                # One-click startup script
├── inject-skills.sh        # Skill injection script
│
├── frontend/               # Frontend application
│   ├── package.json
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── hooks/          # Custom hooks (Socket.io, sync, etc.)
│   │   └── types/          # TypeScript types
│   └── ...
│
├── backend/                # Business backend (optional)
│   ├── package.json
│   ├── src/
│   │   ├── sessions/       # Session management (proxying CCAAS)
│   │   └── ...             # Business logic
│   └── ...
│
├── mcp-server/             # MCP tool service
│   ├── package.json
│   ├── src/
│   │   └── index.ts        # Tool definitions and implementation
│   └── ...
│
└── skills/                 # AI Skill definitions
    └── my-skill/
        └── SKILL.md        # Skill Markdown file
```

## solution.json Configuration

```json
{
  "name": "My Solution",
  "slug": "my-solution",
  "version": "1.0.0",
  "description": "Solution description",
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "Tool service description"
    }
  },
  "skills": [
    {
      "name": "Main Skill",
      "slug": "main-skill",
      "description": "Main skill description",
      "type": "prompt",
      "triggers": [
        {
          "type": "keyword",
          "value": "design",
          "priority": 1
        }
      ],
      "allowedTools": ["write_output", "custom_tool"],
      "skillFile": "skills/main-skill/SKILL.md"
    }
  ],
  "ports": {
    "backend": 3002,
    "frontend": 5280
  }
}
```

### Trigger Types

| Type | Description | Example |
|------|-------------|---------|
| `keyword` | Message contains keyword | `"design"`, `"generate"` |
| `pattern` | Regex pattern match | `"(please )?(help me )?design.*lesson plan"` |
| `intent` | Semantic intent recognition | `"create_lesson_plan"` |
| `context` | Context condition match | `"page:lesson-plan-editor"` |

## Socket.io Relay Layer

The Solution backend needs to implement a Socket.io relay layer that forwards frontend events to the CCAAS backend:

```typescript
// Frontend → Solution Backend
socket.on('chat', async (data) => {
  const { message, sessionId } = data

  // Forward to CCAAS
  await axios.post(`${CCAAS_URL}/api/v1/sessions/${sessionId}/completion`, {
    clientId: socket.id,
    message,
    tenantId: TENANT_ID,
    mcpServers: getMcpConfig(),
    enabledSkillSlugs: getEnabledSkills()
  })
})

// CCAAS → Solution Backend → Frontend
ccaasSocket.on('text_delta', (data) => {
  clientSocket.emit('text_delta', data)
})

ccaasSocket.on('output_update', (data) => {
  clientSocket.emit('output_update', data)
})

ccaasSocket.on('agent_status', (data) => {
  clientSocket.emit('agent_status', data)
})
```

## Data Flow in Detail

A complete user interaction follows this sequence:

1. User enters a message in the frontend
2. Frontend sends a `chat` event via Socket.io to the Solution backend
3. Solution backend calls the CCAAS REST API (`/sessions/:id/completion`)
4. CCAAS resolves the tenant, synchronizes Skills, and creates a session
5. CCAAS launches the AI Agent process
6. AI Agent reads Skill instructions and context
7. AI Agent invokes MCP tools (e.g., write\_output)
8. CCAAS pushes events via WebSocket
9. Solution backend relays events to the frontend
10. Frontend renders results in real time
11. User reviews and edits

## One-Click Startup Script

`setup.sh` should include:

```bash
#!/bin/bash

# Ensure CCAAS backend is running
echo "Checking CCAAS backend..."
curl -s http://localhost:3001/api/v1/chat/health > /dev/null || {
  echo "Please start the CCAAS backend first: npm run dev:backend"
  exit 1
}

# Install dependencies
npm install --prefix backend
npm install --prefix frontend
npm install --prefix mcp-server

# Build MCP Server
npm run build --prefix mcp-server

# Inject Skills
./inject-skills.sh

# Start services
npm run dev --prefix backend &
npm run dev --prefix frontend &

echo "Solution startup complete!"
```

## Skill Injection

`inject-skills.sh` is responsible for registering Skills with CCAAS:

```bash
#!/bin/bash
CCAAS_URL="http://localhost:3001"

# Read Skill configuration from solution.json
# Call the CCAAS API to register Skills
curl -X POST "$CCAAS_URL/api/v1/skills" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Skill",
    "slug": "my-skill",
    "description": "Skill description",
    "type": "prompt",
    "content": "'"$(cat skills/my-skill/SKILL.md)"'",
    "triggers": [{"type": "keyword", "value": "keyword"}],
    "allowedTools": ["write_output"]
  }'

# Register MCP Server
curl -X POST "$CCAAS_URL/api/v1/mcp-servers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-tools",
    "url": "http://localhost:3004",
    "description": "Tool service"
  }'
```

## Best Practices

### 1. Leverage CCAAS Capabilities

- Use CCAAS session management instead of implementing your own
- Manage Skills through the CCAAS API instead of directly accessing the database
- Proxy common API calls (e.g., Skill CRUD operations)

### 2. Test Before You Code

```
Before modifying any code:
□ Run npm test to confirm all current tests pass
□ If changing APIs or interfaces, review frontend type definitions and existing tests first

After modifying code:
□ Run related tests immediately -- don't wait until the end
□ Test failure = stop and analyze, don't push forward
```

### 3. Handle output\_update Correctly

```typescript
// output_update uses a nested structure
socket.on('output_update', (event) => {
  // Correct: access event.payload.data
  const { field, value } = event.payload.data

  // Wrong: access event.field directly
  // const { field, value } = event  // ← This is incorrect!
})
```

### 4. Comprehensive Error Handling

```typescript
socket.on('error', (error) => {
  console.error('Session error:', error)
  // Decide whether to retry based on error type
  if (error.recoverable) {
    // Auto-retry
  } else {
    // Notify user
  }
})
```
