# Creating a Solution - Complete Guide

This guide walks you through creating a new solution on the CCAAS platform from scratch.

---

## Table of Contents

1. [What is a Solution?](#what-is-a-solution)
2. [Prerequisites](#prerequisites)
3. [Solution Structure](#solution-structure)
4. [Step-by-Step Tutorial](#step-by-step-tutorial)
5. [Configuration Files](#configuration-files)
6. [Tenant Setup](#tenant-setup)
7. [MCP Server Integration](#mcp-server-integration)
8. [Skill Integration](#skill-integration)
9. [Frontend Development](#frontend-development)
10. [Testing Your Solution](#testing-your-solution)
11. [Deployment Checklist](#deployment-checklist)
12. [Examples](#examples)

---

## What is a Solution?

A **Solution** is a complete application built on the CCAAS platform that:

- Has its own **tenant** (isolated workspace with API quotas)
- Can include a **custom backend** (NestJS, Express, or any Node.js server)
- Can include a **custom frontend** (React, Vue, or any web framework)
- Can register **MCP servers** (Model Context Protocol tools) for AI capabilities
- Can register **skills** (specialized prompts and workflows)
- Connects to the **CCAAS backend** (port 3001) for AI agent orchestration

**Platform Context**: Users interact with solutions through the platform interface. They do NOT install or configure AgentEngine themselves - CCAAS manages all AgentEngine infrastructure.

---

## Prerequisites

### Required Knowledge

- JavaScript/TypeScript
- Node.js and npm
- Basic understanding of REST APIs
- Git version control

### Required Software

- **Node.js** 18+ (with npm)
- **SQLite** (for development databases)
- **Git**
- Code editor (VS Code recommended)

### CCAAS Platform Setup

Before creating a solution, ensure the CCAAS backend is running:

```bash
cd packages/backend
npm install
npm run start:dev  # Runs on port 3001
```

Verify it's running:
```bash
curl http://localhost:3001/api/v1/chat/health
# Should return: {"status":"ok"}
```

---

## Solution Structure

### Recommended Directory Layout

```
solutions/
└── my-solution/
    ├── solution.json          # Solution configuration (REQUIRED)
    ├── setup.sh               # One-time setup script
    ├── start-dev.sh           # Development startup script
    ├── README.md              # Solution documentation
    │
    ├── backend/               # Custom backend (optional)
    │   ├── package.json
    │   ├── src/
    │   └── data/             # SQLite databases
    │
    ├── frontend/              # Custom frontend (optional)
    │   ├── package.json
    │   ├── src/
    │   └── vite.config.ts    # Or webpack, next.config.js
    │
    ├── mcp-server/            # MCP tools (optional)
    │   ├── package.json
    │   └── src/
    │       ├── index.ts      # MCP server entry point
    │       └── tools/        # Tool implementations
    │
    └── skills/                # Skill definitions (optional)
        ├── analyze.skill.json
        └── summarize.skill.json
```

### Minimum Required Files

For a minimal solution, you only need:

1. **`solution.json`** - Solution metadata and configuration
2. **`setup.sh`** - Setup script that creates the tenant
3. **Frontend OR Backend** - At least one interface for users

---

## Step-by-Step Tutorial

### Step 1: Create Solution Directory

```bash
cd solutions
mkdir my-solution
cd my-solution
```

### Step 2: Create solution.json

This is the **most important file**. It registers your solution with CCAAS.

```json
{
  "id": "my-solution",
  "name": "My Solution",
  "version": "1.0.0",
  "description": "A brief description of what this solution does",
  "author": "Your Name",
  "license": "MIT",

  "tenant": {
    "slug": "my-solution",
    "name": "My Solution",
    "description": "AI-powered solution for [use case]",
    "maxSessions": 100,
    "maxSkills": 50,
    "maxMcpServers": 10
  },

  "ports": {
    "backend": 3010,
    "frontend": 5280
  },

  "mcpServers": {},
  "skills": [],
  "dependencies": []
}
```

**Key Fields:**

- **`id`**: Unique identifier (kebab-case, no spaces)
- **`tenant.slug`**: Must match the tenant slug you'll create (usually same as `id`)
- **`ports`**: Choose unique ports (avoid 3001 = CCAAS, 3005 = quiz-analyzer, etc.)

### Step 3: Create setup.sh

This script handles **one-time setup**, including tenant creation.

```bash
#!/bin/bash

set -e  # Exit on error

echo "=========================================="
echo "My Solution Setup"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Step 1: Create tenant in CCAAS backend
echo ""
echo "Step 1: Setting up CCAAS tenant..."
CCAAS_DB="$SCRIPT_DIR/../../packages/backend/.agent-workspace/data.db"

if [ ! -f "$CCAAS_DB" ]; then
    echo -e "${RED}✗ CCAAS database not found${NC}"
    echo "Please run CCAAS backend first:"
    echo "  cd packages/backend && npm run start:dev"
    exit 1
fi

# Check if tenant exists
TENANT_EXISTS=$(sqlite3 "$CCAAS_DB" "SELECT COUNT(*) FROM tenants WHERE slug = 'my-solution';" 2>/dev/null || echo "0")

if [ "$TENANT_EXISTS" = "0" ]; then
    echo "Creating my-solution tenant..."
    sqlite3 "$CCAAS_DB" "
    INSERT INTO tenants (id, name, slug, description, config, maxSessions, maxSkills, maxMcpServers, plan, apiKey, status, createdAt, updatedAt)
    VALUES (
        lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
        'My Solution',
        'my-solution',
        'AI-powered solution for [use case]',
        '{}',
        100,
        50,
        10,
        'free',
        'sk_' || lower(hex(randomblob(24))),
        'active',
        datetime('now'),
        datetime('now')
    );
    "
    echo -e "${GREEN}✓ Tenant created (slug: my-solution)${NC}"
else
    echo -e "${GREEN}✓ Tenant already exists${NC}"
fi

# Step 2: Install dependencies
echo ""
echo "Step 2: Installing dependencies..."

if [ -d "backend" ]; then
    cd backend
    npm install
    cd ..
    echo -e "${GREEN}✓ Backend dependencies installed${NC}"
fi

if [ -d "frontend" ]; then
    cd frontend
    npm install
    cd ..
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
fi

echo ""
echo -e "${GREEN}=========================================="
echo "✅ Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Run: bash start-dev.sh"
echo "  2. Open: http://localhost:5280"
```

**Make it executable:**
```bash
chmod +x setup.sh
```

### Step 4: Create start-dev.sh

This script starts your services in development mode.

```bash
#!/bin/bash

set -e

echo "🚀 Starting My Solution..."

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    lsof -ti:3010 | xargs kill -9 2>/dev/null || true
    lsof -ti:5280 | xargs kill -9 2>/dev/null || true
    echo "✅ Services stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Clear ports if occupied
lsof -ti:3010 | xargs kill -9 2>/dev/null || true
lsof -ti:5280 | xargs kill -9 2>/dev/null || true

mkdir -p logs

# Start backend
if [ -d "backend" ]; then
    echo "🔧 Starting backend (port 3010)..."
    cd backend
    npm run start:dev > ../logs/backend.log 2>&1 &
    BACKEND_PID=$!
    cd ..

    # Wait for backend
    for i in {1..10}; do
        if lsof -Pi :3010 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "✅ Backend started"
            break
        fi
        sleep 1
    done
fi

# Start frontend
if [ -d "frontend" ]; then
    echo "🎨 Starting frontend (port 5280)..."
    cd frontend
    npm run dev > ../logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    cd ..

    # Wait for frontend
    for i in {1..10}; do
        if lsof -Pi :5280 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "✅ Frontend started"
            break
        fi
        sleep 1
    done
fi

echo ""
echo "✅ All services running!"
echo ""
echo "📍 URLs:"
echo "   Frontend: http://localhost:5280"
echo "   Backend:  http://localhost:3010"
echo ""
echo "Press Ctrl+C to stop"

wait
```

**Make it executable:**
```bash
chmod +x start-dev.sh
```

### Step 5: Create Frontend (React + Vite Example)

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install @ccaas/react-sdk
```

**Update `src/App.tsx`:**

```typescript
import { useAgentConnection, useAgentChat, ChatPanel } from '@ccaas/react-sdk'

const BACKEND_URL = 'http://localhost:3001'  // CCAAS backend
const TENANT_ID = 'my-solution'              // Must match solution.json

function App() {
  const connection = useAgentConnection({
    serverUrl: BACKEND_URL,
    sessionPrefix: 'my',
  })

  const chat = useAgentChat({
    connection,
    tenantId: TENANT_ID,
  })

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h1>My Solution</h1>
      <ChatPanel
        messages={chat.messages}
        isProcessing={chat.isProcessing}
        onSendMessage={chat.sendMessage}
        connected={connection.connected}
      />
    </div>
  )
}

export default App
```

**Update `vite.config.ts`:**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5280,  // Must match solution.json
  },
})
```

### Step 6: Run Setup

```bash
# From solution root
bash setup.sh
```

**Expected Output:**
```
==========================================
My Solution Setup
==========================================

Step 1: Setting up CCAAS tenant...
Creating my-solution tenant...
✓ Tenant created (slug: my-solution)

Step 2: Installing dependencies...
✓ Frontend dependencies installed

==========================================
✅ Setup Complete!
==========================================
```

### Step 7: Start Development

```bash
bash start-dev.sh
```

Open http://localhost:5280 and test!

---

## Configuration Files

### solution.json Reference

```json
{
  "id": "my-solution",
  "name": "My Solution",
  "version": "1.0.0",
  "description": "Solution description",
  "author": "Your Name",
  "license": "MIT",

  "tenant": {
    "slug": "my-solution",           // Unique tenant identifier
    "name": "My Solution",
    "description": "Description",
    "maxSessions": 100,               // Max concurrent sessions
    "maxSkills": 50,                  // Max skills allowed
    "maxMcpServers": 10               // Max MCP servers
  },

  "ports": {
    "backend": 3010,                  // Custom backend port (optional)
    "frontend": 5280,                 // Frontend dev server port
    "mcp": 3011                       // MCP server port (optional)
  },

  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "env": {
        "DATABASE_PATH": "backend/data/my-solution.db"
      },
      "description": "Custom MCP tools for my solution"
    }
  },

  "skills": [
    {
      "path": "skills/analyze.skill.json",
      "enabled": true
    }
  ],

  "dependencies": [
    "@ccaas/react-sdk",              // Frontend SDK
    "@ccaas/common"                   // Shared types
  ]
}
```

---

## Tenant Setup

### What is a Tenant?

A **Tenant** is an isolated workspace in CCAAS that provides:

- **Quota Management**: Max sessions, skills, MCP servers
- **API Key Authentication**: Each tenant has a unique API key
- **Usage Tracking**: Monitor token usage, latency, errors
- **Billing** (future): Associate with payment plans

### Tenant Database Schema

```sql
CREATE TABLE tenants (
  id           VARCHAR PRIMARY KEY,     -- UUID
  name         VARCHAR NOT NULL,        -- Display name
  slug         VARCHAR UNIQUE NOT NULL, -- URL-safe identifier (kebab-case)
  description  TEXT,
  config       TEXT DEFAULT '{}',       -- JSON config
  maxSessions  INTEGER DEFAULT 100,
  maxSkills    INTEGER DEFAULT 50,
  maxMcpServers INTEGER DEFAULT 10,
  plan         VARCHAR DEFAULT 'free',  -- free, pro, enterprise
  billingEmail VARCHAR,
  apiKey       VARCHAR,                  -- Auto-generated (sk_...)
  status       VARCHAR DEFAULT 'active', -- active, suspended, deleted
  createdAt    DATETIME,
  updatedAt    DATETIME
);
```

### Creating a Tenant Programmatically

**In setup.sh:**

```bash
CCAAS_DB="../../packages/backend/.agent-workspace/data.db"

sqlite3 "$CCAAS_DB" "
INSERT INTO tenants (id, name, slug, description, config, maxSessions, maxSkills, maxMcpServers, plan, apiKey, status, createdAt, updatedAt)
VALUES (
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    'My Solution',
    'my-solution',
    'Description here',
    '{}',
    100,
    50,
    10,
    'free',
    'sk_' || lower(hex(randomblob(24))),
    'active',
    datetime('now'),
    datetime('now')
);
"
```

**Via REST API** (future):

```bash
curl -X POST http://localhost:3001/api/v1/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Solution",
    "slug": "my-solution",
    "description": "Description",
    "maxSessions": 100
  }'
```

### Checking Tenant Exists

```bash
TENANT_EXISTS=$(sqlite3 "$CCAAS_DB" \
  "SELECT COUNT(*) FROM tenants WHERE slug = 'my-solution';" \
  2>/dev/null || echo "0")

if [ "$TENANT_EXISTS" = "0" ]; then
    echo "Tenant does not exist, creating..."
else
    echo "Tenant already exists"
fi
```

---

## MCP Server Integration

### What is MCP?

**Model Context Protocol (MCP)** allows you to create custom tools that Claude can use. These tools can:

- Read/write databases
- Call external APIs
- Perform computations
- Access files

### Creating an MCP Server

**1. Create MCP server directory:**

```bash
mkdir -p mcp-server/src
cd mcp-server
npm init -y
npm install @anthropic-ai/sdk zod
```

**2. Create `src/index.ts`:**

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new Server({
  name: 'my-solution-tools',
  version: '1.0.0',
})

// Define tool: get_weather
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'get_weather',
        description: 'Get current weather for a location',
        inputSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City name',
            },
          },
          required: ['location'],
        },
      },
    ],
  }
})

// Implement tool
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'get_weather') {
    const location = args.location as string
    // TODO: Call weather API
    return {
      content: [
        {
          type: 'text',
          text: `Weather in ${location}: Sunny, 25°C`,
        },
      ],
    }
  }

  throw new Error(`Unknown tool: ${name}`)
})

// Start server
const transport = new StdioServerTransport()
server.connect(transport)
```

**3. Build and test:**

```bash
npm run build
node dist/index.js
```

**4. Register in solution.json:**

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "Weather tools"
    }
  }
}
```

---

## Skill Integration

### What is a Skill?

A **Skill** is a specialized prompt or workflow that guides the AI agent to perform specific tasks.

### Creating a Skill

**1. Create `skills/analyze.skill.json`:**

```json
{
  "id": "analyze-data",
  "name": "Data Analyzer",
  "description": "Analyzes structured data and generates insights",
  "version": "1.0.0",
  "type": "prompt",

  "triggers": [
    {
      "type": "keyword",
      "value": "analyze this data",
      "priority": 10
    },
    {
      "type": "keyword",
      "value": "数据分析",
      "priority": 10
    }
  ],

  "prompt": "You are a data analysis expert. When given structured data (CSV, JSON, tables), you:\n\n1. Identify key patterns and trends\n2. Calculate relevant statistics\n3. Generate actionable insights\n4. Visualize findings using charts\n5. Provide recommendations\n\nUse the available MCP tools to process and visualize data.",

  "tools": [
    "get_weather",
    "analyze_csv"
  ],

  "config": {
    "temperature": 0.7,
    "max_tokens": 2000
  }
}
```

**2. Register in solution.json:**

```json
{
  "skills": [
    {
      "path": "skills/analyze.skill.json",
      "enabled": true
    }
  ]
}
```

**3. Sync skills to CCAAS:**

```bash
# In setup.sh, add skill sync logic
# Or use the CCAAS API:
curl -X POST http://localhost:3001/api/v1/skills \
  -H "Content-Type: application/json" \
  -d @skills/analyze.skill.json
```

---

## Frontend Development

### Using @ccaas/react-sdk

**Installation:**

```bash
npm install @ccaas/react-sdk
```

**Basic Setup:**

```typescript
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  ChatPanel,
} from '@ccaas/react-sdk'

function App() {
  // 1. Establish WebSocket connection
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'my',
  })

  // 2. Initialize chat
  const chat = useAgentChat({
    connection,
    tenantId: 'my-solution',  // IMPORTANT: Must match your tenant slug
  })

  // 3. Track agent status (thinking, tools, tokens)
  const status = useAgentStatus({ connection })

  return (
    <div>
      <h1>My Solution</h1>

      {/* Pre-built chat UI */}
      <ChatPanel
        messages={chat.messages}
        isProcessing={chat.isProcessing}
        onSendMessage={chat.sendMessage}
        connected={connection.connected}
        activeTools={status.activeTools}
        isThinking={status.isThinking}
        thinkingContent={status.thinkingContent}
      />

      {/* Token usage display */}
      <div>
        Tokens: {status.tokenUsage.totalTokens} |
        Cost: ${status.tokenUsage.totalCost.toFixed(4)}
      </div>
    </div>
  )
}
```

### Custom Chat UI

```typescript
function CustomChat() {
  const connection = useAgentConnection({ ... })
  const chat = useAgentChat({ connection, tenantId: 'my-solution' })

  return (
    <div className="chat-container">
      <div className="messages">
        {chat.messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <strong>{msg.role}:</strong>
            <p>{msg.content}</p>
          </div>
        ))}
      </div>

      <form onSubmit={(e) => {
        e.preventDefault()
        const input = e.target.message.value
        chat.sendMessage(input)
        e.target.reset()
      }}>
        <input name="message" placeholder="Type a message..." />
        <button type="submit" disabled={chat.isProcessing}>
          Send
        </button>
      </form>
    </div>
  )
}
```

### Using @ccaas/common Types

```typescript
import type { Session, Message, TokenUsage } from '@ccaas/common'

interface MyComponentProps {
  session: Session
  messages: Message[]
  usage: TokenUsage
}
```

---

## Testing Your Solution

### Manual Testing Checklist

- [ ] **Tenant Creation**: Verify tenant exists in database
- [ ] **WebSocket Connection**: Check browser console for connection success
- [ ] **Send Message**: Test basic chat functionality
- [ ] **Tool Execution**: If using MCP, verify tools are called
- [ ] **Skill Activation**: Test skill triggers
- [ ] **Error Handling**: Test with invalid inputs
- [ ] **Token Tracking**: Verify token usage updates

### Automated Testing

**Frontend (Vitest + React Testing Library):**

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders chat interface', () => {
    render(<App />)
    expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
  })

  it('sends a message', async () => {
    render(<App />)
    const input = screen.getByPlaceholderText(/type a message/i)
    const button = screen.getByText(/send/i)

    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.click(button)

    // Assert message appears
    expect(await screen.findByText('Hello')).toBeInTheDocument()
  })
})
```

**Backend (Jest):**

```typescript
import request from 'supertest'
import { app } from './app'

describe('GET /health', () => {
  it('returns status ok', async () => {
    const response = await request(app).get('/health')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
  })
})
```

### Integration Testing

**Test WebSocket Connection:**

```typescript
import { io } from 'socket.io-client'

const socket = io('http://localhost:3001')

socket.on('connect', () => {
  console.log('✅ Connected to CCAAS')
  socket.emit('chat', { message: 'Hello', tenantId: 'my-solution' })
})

socket.on('text_delta', (data) => {
  console.log('Received:', data.content)
})
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Update `solution.json` version
- [ ] Write deployment documentation
- [ ] Test on clean environment (Docker recommended)
- [ ] Check environment variable requirements
- [ ] Verify all dependencies are in `package.json`

### Database

- [ ] Create database migration scripts
- [ ] Test migrations on copy of production data
- [ ] Document rollback procedures
- [ ] Set up automated backups

### Environment Variables

**Create `.env.example`:**

```bash
# CCAAS Connection
CCAAS_BACKEND_URL=http://localhost:3001
TENANT_ID=my-solution

# Solution Ports
BACKEND_PORT=3010
FRONTEND_PORT=5280

# Database
DATABASE_PATH=./data/my-solution.db

# API Keys (if needed)
EXTERNAL_API_KEY=your-key-here
```

### Production Setup

**1. Use environment-specific configs:**

```typescript
const BACKEND_URL = process.env.VITE_CCAAS_BACKEND_URL || 'http://localhost:3001'
const TENANT_ID = process.env.VITE_TENANT_ID || 'my-solution'
```

**2. Build for production:**

```bash
# Frontend
cd frontend
npm run build  # Creates dist/

# Backend (if using TypeScript)
cd backend
npm run build  # Creates dist/
```

**3. Serve production build:**

```bash
# Frontend (using nginx or serve)
npx serve -s frontend/dist -p 5280

# Backend
cd backend
NODE_ENV=production node dist/index.js
```

### Docker Deployment (Recommended)

**Create `Dockerfile`:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm install
RUN cd frontend && npm install
RUN cd backend && npm install

# Copy source
COPY . .

# Build
RUN cd frontend && npm run build
RUN cd backend && npm run build

# Expose ports
EXPOSE 3010 5280

# Start services
CMD ["bash", "start-dev.sh"]
```

**Create `docker-compose.yml`:**

```yaml
version: '3.8'

services:
  my-solution:
    build: .
    ports:
      - "3010:3010"
      - "5280:5280"
    environment:
      - CCAAS_BACKEND_URL=http://ccaas-backend:3001
      - TENANT_ID=my-solution
    depends_on:
      - ccaas-backend
    volumes:
      - ./data:/app/data

  ccaas-backend:
    image: ccaas/backend:latest
    ports:
      - "3001:3001"
    volumes:
      - ccaas-data:/app/.agent-workspace

volumes:
  ccaas-data:
```

---

## Examples

### Example 1: Simple Chat Application

**Minimal solution with just frontend + CCAAS:**

```
my-chat/
├── solution.json
├── setup.sh
├── start-dev.sh
└── frontend/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        └── main.tsx
```

### Example 2: Data Analysis Tool

**With custom backend, MCP server, and skills:**

```
data-analyzer/
├── solution.json
├── setup.sh
├── start-dev.sh
├── backend/          # Express server for data storage
├── frontend/         # React UI
├── mcp-server/       # Custom analysis tools
└── skills/
    ├── analyze.skill.json
    └── visualize.skill.json
```

### Example 3: Quiz Analyzer (Real Example)

See `solutions/quiz-analyzer/` for a complete production example with:

- Custom NestJS backend (port 3005)
- React + Vite frontend (port 5282)
- MCP server with 5 custom tools
- SQLite database with 8 tables
- Excel import scripts
- Comprehensive setup and start scripts

---

## Common Issues

### Issue: "Tenant not found"

**Cause**: Tenant wasn't created in CCAAS database

**Fix**: Add tenant creation to `setup.sh`:

```bash
sqlite3 "$CCAAS_DB" "INSERT INTO tenants ..."
```

### Issue: "WebSocket connection failed"

**Cause**: CCAAS backend not running or wrong URL

**Fix**: Verify CCAAS is running on port 3001:

```bash
lsof -i :3001
curl http://localhost:3001/api/v1/chat/health
```

### Issue: "Port already in use"

**Cause**: Previous instance still running

**Fix**: Clear ports in `start-dev.sh`:

```bash
lsof -ti:YOUR_PORT | xargs kill -9 2>/dev/null || true
```

### Issue: "MCP server not registered"

**Cause**: `solution.json` not synced to CCAAS

**Fix**: Restart CCAAS backend or manually register MCP server

---

## Next Steps

1. **Create your first solution** using this guide
2. **Study existing solutions** in `solutions/` directory
3. **Read the CCAAS Architecture docs** for advanced patterns
4. **Join the community** to share your solution

## Resources

- [CCAAS Backend Documentation](../packages/backend/CLAUDE.md)
- [@ccaas/react-sdk Documentation](../packages/react-sdk/README.md)
- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [Example Solutions](../../solutions/)

---

**Questions?** Open an issue or reach out to the CCAAS team!
