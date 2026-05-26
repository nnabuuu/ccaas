# MCP Server Setup and Testing Guide

This guide covers setting up, testing, and debugging Model Context Protocol (MCP) servers for your CCAAS solutions.

## Table of Contents

- [Overview](#overview)
- [What is MCP?](#what-is-mcp)
- [MCP in CCAAS Architecture](#mcp-in-ccaas-architecture)
- [Setting Up MCP Server](#setting-up-mcp-server)
- [Testing with MCP Inspector](#testing-with-mcp-inspector)
- [Registering MCP Servers](#registering-mcp-servers)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Overview

**Model Context Protocol (MCP)** enables AI assistants to connect to external data sources and tools. In CCAAS, MCP servers provide domain-specific tools that skills can use to accomplish tasks.

**When to read this guide:**
- ✅ You're creating a new solution with custom tools
- ✅ Your AI needs to access external APIs or databases
- ✅ You want to test MCP tools before integrating with skills
- ✅ You're debugging tool execution issues

---

## What is MCP?

### Definition

**MCP (Model Context Protocol)** is a standard protocol that allows:
- **AI assistants** to discover and invoke external tools
- **Tool providers** to expose capabilities in a standardized way
- **Secure communication** between AI and external systems

### Key Concepts

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│     AI      │◄───MCP──│ MCP Server  │◄────────│  External   │
│  Assistant  │         │   (Tools)   │         │  Resources  │
└─────────────┘         └─────────────┘         └─────────────┘
     ↑                         ↑                        ↑
     │                         │                        │
   Skills              Custom Business Logic    Database, APIs
```

**Components:**

1. **Tools**: Functions the AI can call (e.g., `search_database`, `send_email`)
2. **Resources**: Data sources the AI can read (e.g., file systems, databases)
3. **Prompts**: Reusable prompt templates
4. **Sampling**: AI completion requests to other models

---

## MCP in CCAAS Architecture

### Data Flow

```
User Message
    ↓
CCAAS Backend (loads skills with solutionId)
    ↓
AI Agent (analyzes message, selects skill)
    ↓
Skill (defines allowedTools)
    ↓
MCP Server (provides tool implementations)
    ↓
External Resource (database, API, file system)
    ↓
MCP Server (returns result)
    ↓
AI Agent (processes result, generates response)
    ↓
Frontend (displays result via output_update events)
```

### Example: Quiz-Analyzer

**User**: "请帮我分析这道题目: 1+1=?"

**Flow**:
1. CCAAS loads `three-column-analysis` skill (solutionId: quiz-analyzer)
2. AI sees `allowedTools: ["parse_quiz_content", "search_knowledge_points", ...]`
3. AI calls `parse_quiz_content` via MCP
4. MCP server parses quiz and returns structured data
5. AI calls `search_knowledge_points` to find relevant topics
6. AI generates analysis and calls `write_output` to update frontend

---

## Setting Up MCP Server

### Step 1: Create MCP Server Directory

```bash
cd solutions/your-solution
mkdir -p mcp-server/src
cd mcp-server
npm init -y
```

### Step 2: Install Dependencies

```bash
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node tsx
```

### Step 3: Create Server Implementation

**File**: `mcp-server/src/index.ts`

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Tool schemas
const SearchDatabaseSchema = z.object({
  query: z.string().describe('Search query'),
  limit: z.number().optional().describe('Max results to return'),
});

// Create server
const server = new Server(
  {
    name: 'your-solution-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_database',
        description: 'Search the database for records',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
            limit: {
              type: 'number',
              description: 'Max results to return',
            },
          },
          required: ['query'],
        },
      },
      // Add more tools here...
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'search_database': {
      const validated = SearchDatabaseSchema.parse(args);

      // Implement your business logic
      const results = await searchYourDatabase(validated.query, validated.limit);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});

// Business logic
async function searchYourDatabase(query: string, limit?: number) {
  // Your implementation here
  return {
    results: [],
    total: 0,
  };
}
```

### Step 4: Configure Build Scripts

**File**: `mcp-server/package.json`

```json
{
  "name": "@your-solution/mcp-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  }
}
```

**File**: `mcp-server/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

### Step 5: Register in solution.json

**File**: `solutions/your-solution/solution.json`

```json
{
  "name": "Your Solution",
  "slug": "your-solution",
  "mcpServers": {
    "your-solution-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "Custom tools for your solution",
      "type": "stdio",
      "env": {
        "MCP_PORT": "3006",
        "DATABASE_PATH": "../data/your-solution.db"
      }
    }
  },
  "skills": [
    {
      "name": "Your Skill",
      "slug": "your-skill",
      "allowedTools": [
        "search_database",
        "another_tool"
      ]
    }
  ]
}
```

---

## Testing with MCP Inspector

### What is MCP Inspector?

**MCP Inspector** is an interactive debugging tool that provides:
- ✅ Visual interface for testing MCP servers
- ✅ Tool discovery and documentation viewing
- ✅ Interactive tool invocation with parameter input
- ✅ Response inspection and error debugging
- ✅ Connection health monitoring

### When to Use MCP Inspector

**Before Integration:**
- ✅ Test tool implementations independently
- ✅ Verify input/output schemas
- ✅ Debug tool logic before AI integration
- ✅ Validate error handling

**During Development:**
- ✅ Test new tools as you build them
- ✅ Experiment with different parameters
- ✅ Verify tool responses match expectations

**Troubleshooting:**
- ✅ Debug tool execution failures
- ✅ Inspect error messages
- ✅ Verify MCP server connectivity

### Starting MCP Inspector

**Option 1: Via Claude Code**

MCP Inspector may automatically open when:
- Starting a solution with MCP servers configured
- Claude Code detects MCP server in solution.json
- Debugging MCP-related issues

**Option 2: Manual Launch**

```bash
# Install MCP Inspector (if not installed)
npm install -g @modelcontextprotocol/inspector

# Start your MCP server
cd solutions/your-solution/mcp-server
npm run dev

# In another terminal, start Inspector
mcp-inspector
```

**Option 3: npx (no installation)**

```bash
npx @modelcontextprotocol/inspector
```

### Using MCP Inspector

#### Step 1: Connect to MCP Server

1. **Launch Inspector** - Opens in browser (usually http://localhost:5173)
2. **Configure Connection**:
   ```
   Transport: stdio
   Command: node
   Args: ["./solutions/your-solution/mcp-server/dist/index.js"]
   ```
3. **Click "Connect"**
4. **Verify Status**: Should show "Connected ✓"

#### Step 2: Explore Available Tools

**Tools Tab** shows all tools provided by your MCP server:

```
✅ search_database
   Description: Search the database for records
   Parameters:
   - query (string, required): Search query
   - limit (number, optional): Max results to return

✅ parse_quiz_content
   Description: Parse quiz content into structured format
   Parameters:
   - content (string, required): Quiz text content
```

#### Step 3: Test Tool Invocation

1. **Select Tool**: Click on `search_database`
2. **Enter Parameters**:
   ```json
   {
     "query": "math equations",
     "limit": 5
   }
   ```
3. **Click "Run Tool"**
4. **View Response**:
   ```json
   {
     "results": [
       { "id": "1", "title": "Linear Equations" },
       { "id": "2", "title": "Quadratic Equations" }
     ],
     "total": 2
   }
   ```

#### Step 4: Verify Error Handling

**Test with Invalid Input:**
```json
{
  "query": ""  // Empty query - should trigger validation error
}
```

**Expected Error Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Query cannot be empty"
  }
}
```

### Inspector UI Overview

```
┌─────────────────────────────────────────────────────────┐
│ MCP Inspector v0.20.0                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ Connection ───────────────────────────────────┐    │
│  │ Status: Connected ✓                            │    │
│  │ Server: your-solution-mcp-server v1.0.0        │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─ Tools ────────────────────────────────────────┐    │
│  │                                                 │    │
│  │ [▶] search_database                            │    │
│  │     Search the database for records            │    │
│  │                                                 │    │
│  │ [▶] parse_quiz_content                         │    │
│  │     Parse quiz content into structured format  │    │
│  │                                                 │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─ Request ──────────────────────────────────────┐    │
│  │ Tool: search_database                          │    │
│  │ Parameters:                                     │    │
│  │ {                                               │    │
│  │   "query": "math equations",                   │    │
│  │   "limit": 5                                   │    │
│  │ }                                               │    │
│  │                            [Run Tool]           │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─ Response ─────────────────────────────────────┐    │
│  │ Status: 200 OK                                 │    │
│  │ Duration: 45ms                                 │    │
│  │                                                 │    │
│  │ {                                               │    │
│  │   "results": [                                 │    │
│  │     { "id": "1", "title": "Linear Equations" } │    │
│  │   ],                                           │    │
│  │   "total": 1                                   │    │
│  │ }                                               │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Registering MCP Servers

### Overview

After building and testing your MCP server, you need to register it with CCAAS backend so it can be used during AI sessions.

### Step 1: Ensure MCP Server is Built

```bash
cd solutions/your-solution/mcp-server
npm run build

# Verify dist/ directory exists
ls dist/index.js  # Should exist
```

### Step 2: Verify solution.json Configuration

**File**: `solutions/your-solution/solution.json`

```json
{
  "mcpServers": {
    "your-solution-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "type": "stdio",
      "env": {
        "NODE_ENV": "production",
        "DATABASE_PATH": "../data/your-solution.db"
      }
    }
  }
}
```

### Step 3: Create MCP Server Registration Script

**File**: `solutions/your-solution/register-mcp-servers.sh`

```bash
#!/bin/bash
# Register MCP servers to CCAAS backend

set -e

SOLUTION_NAME="your-solution"
CCAAS_BACKEND_URL="${CCAAS_BACKEND_URL:-http://localhost:3001}"
API_KEY="${CCAAS_API_KEY}"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: CCAAS_API_KEY environment variable not set"
  echo "   Run: export CCAAS_API_KEY=sk-your-key"
  exit 1
fi

echo "🔧 Registering MCP servers for $SOLUTION_NAME..."

# Read solution.json
SOLUTION_JSON=$(cat solution.json)

# Extract MCP servers
echo "$SOLUTION_JSON" | jq -c '.mcpServers | to_entries[]' | while read -r mcp_entry; do
  SERVER_NAME=$(echo "$mcp_entry" | jq -r '.key')
  SERVER_CONFIG=$(echo "$mcp_entry" | jq '.value')

  echo "  📦 Registering: $SERVER_NAME"

  # Register to CCAAS
  curl -X POST "$CCAAS_BACKEND_URL/api/v1/mcp-servers" \
    -H "Content-Type: application/json" \
    -H "X-Api-Key: $API_KEY" \
    -H "X-Solution-Id: $SOLUTION_NAME" \
    -d "{
      \"name\": \"$SERVER_NAME\",
      \"command\": $(echo "$SERVER_CONFIG" | jq '.command'),
      \"args\": $(echo "$SERVER_CONFIG" | jq '.args'),
      \"env\": $(echo "$SERVER_CONFIG" | jq '.env // {}'),
      \"description\": $(echo "$SERVER_CONFIG" | jq '.description // "Custom MCP server"')
    }" \
    -s | jq '.'

  echo "  ✅ Registered: $SERVER_NAME"
done

echo ""
echo "✨ MCP server registration complete!"
```

**Make it executable:**
```bash
chmod +x register-mcp-servers.sh
```

### Step 4: Run Registration

```bash
cd solutions/your-solution

# Set API key (from skill registration step)
export CCAAS_API_KEY=sk-your-bootstrap-key

# Register MCP servers
./register-mcp-servers.sh
```

**Expected Output:**
```
🔧 Registering MCP servers for your-solution...
  📦 Registering: your-solution-tools
  {
    "id": "mcp-server-uuid",
    "name": "your-solution-tools",
    "command": "node",
    "status": "active"
  }
  ✅ Registered: your-solution-tools

✨ MCP server registration complete!
```

### Step 5: Verify Registration

```bash
# Via API
curl -H "X-Api-Key: $CCAAS_API_KEY" \
  "http://localhost:3001/api/v1/mcp-servers?solutionId=your-solution"

# Expected: List of registered MCP servers
```

---

## Troubleshooting

### Issue: MCP Inspector Shows "Connection Failed"

**Symptoms:**
```
❌ Connection Failed
Error: Could not connect to MCP server
```

**Possible Causes & Solutions:**

1. **MCP Server Not Running**
   ```bash
   # Check if process is running
   ps aux | grep "mcp-server"

   # Start if not running
   cd solutions/your-solution/mcp-server
   npm run dev
   ```

2. **Wrong Connection Parameters**
   ```
   ✅ Correct:
   Command: node
   Args: ["./solutions/your-solution/mcp-server/dist/index.js"]

   ❌ Wrong:
   Args: ["mcp-server/dist/index.js"]  # Missing ./solutions prefix
   ```

3. **Build Not Complete**
   ```bash
   # Rebuild MCP server
   cd solutions/your-solution/mcp-server
   npm run build
   ls dist/index.js  # Verify exists
   ```

### Issue: Tool Returns Error "Unknown tool"

**Symptoms:**
```json
{
  "error": "Unknown tool: search_database"
}
```

**Solution:**

1. **Check ListToolsRequestHandler**:
   ```typescript
   // Make sure tool is listed
   server.setRequestHandler(ListToolsRequestSchema, async () => {
     return {
       tools: [
         {
           name: 'search_database',  // ✅ Must match exactly
           // ...
         }
       ]
     };
   });
   ```

2. **Check CallToolRequestHandler**:
   ```typescript
   server.setRequestHandler(CallToolRequestSchema, async (request) => {
     const { name } = request.params;

     switch (name) {
       case 'search_database':  // ✅ Must match exactly
         // Implementation
     }
   });
   ```

### Issue: MCP Server Not Loading in CCAAS Session

**Symptoms:**
- AI says "Tool not available"
- Backend logs show "MCP server not found"

**Solution:**

1. **Verify MCP Server Registration**:
   ```bash
   curl "http://localhost:3001/api/v1/mcp-servers?solutionId=your-solution"
   ```

2. **Check Skill Configuration**:
   ```json
   {
     "skills": [{
       "allowedTools": [
         "search_database"  // ✅ Must match tool name
       ]
     }]
   }
   ```

3. **Restart CCAAS Backend**:
   ```bash
   cd packages/backend
   npm run start:dev
   ```

### Issue: Tool Validation Errors

**Symptoms:**
```json
{
  "error": "Validation failed: query is required"
}
```

**Solution:**

1. **Check Zod Schema**:
   ```typescript
   const SearchSchema = z.object({
     query: z.string(),  // ✅ Make optional if needed
   });

   // Or allow optional:
   const SearchSchema = z.object({
     query: z.string().optional(),
   });
   ```

2. **Provide Default Values**:
   ```typescript
   const validated = SearchSchema.parse(args);
   const query = validated.query || '';  // Default to empty string
   ```

### Issue: MCP Server Process Crashes

**Symptoms:**
- Inspector shows "Disconnected"
- Backend logs show "MCP server exited"

**Debug Steps:**

1. **Check Server Logs**:
   ```bash
   cd solutions/your-solution/mcp-server
   npm run dev  # Run in foreground to see errors
   ```

2. **Add Error Handling**:
   ```typescript
   server.setRequestHandler(CallToolRequestSchema, async (request) => {
     try {
       // Your logic
     } catch (error) {
       console.error('Tool execution error:', error);
       throw error;  // Re-throw for client
     }
   });
   ```

3. **Check Resource Limits**:
   ```bash
   # Check memory usage
   top -pid $(pgrep -f "mcp-server")

   # Check file descriptors
   lsof -p $(pgrep -f "mcp-server") | wc -l
   ```

---

## Best Practices

### Development Workflow

```
1. Define Tools
   ↓
2. Implement Business Logic
   ↓
3. Test with MCP Inspector ✅
   ↓
4. Register to CCAAS
   ↓
5. Register Skills (with allowedTools)
   ↓
6. Test End-to-End
   ↓
7. Deploy
```

### Tool Design Guidelines

**✅ DO:**
- Use descriptive tool names (`search_knowledge_points` not `search`)
- Provide detailed descriptions
- Validate all inputs with Zod
- Return structured JSON
- Handle errors gracefully
- Log important operations

**❌ DON'T:**
- Use generic names (`do_thing`, `execute`)
- Skip input validation
- Return raw error messages to AI
- Perform side effects without confirmation
- Block on long-running operations

### Example: Well-Designed Tool

```typescript
const SearchKnowledgePointsSchema = z.object({
  query: z.string()
    .min(1, 'Query must not be empty')
    .describe('Search query for knowledge points'),
  subjectId: z.string()
    .optional()
    .describe('Filter by subject ID'),
  limit: z.number()
    .min(1)
    .max(100)
    .default(10)
    .describe('Maximum results to return (1-100)'),
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_knowledge_points',
        description: 'Search for knowledge points by query and optional subject filter. Returns matching knowledge points with confidence scores.',
        inputSchema: zodToJsonSchema(SearchKnowledgePointsSchema),
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'search_knowledge_points') {
    try {
      const params = SearchKnowledgePointsSchema.parse(request.params.arguments);

      // Business logic
      const results = await searchKnowledgePoints(
        params.query,
        params.subjectId,
        params.limit
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            results,
            total: results.length,
            query: params.query,
          }, null, 2),
        }],
      };
    } catch (error) {
      console.error('search_knowledge_points error:', error);

      if (error instanceof z.ZodError) {
        throw new Error(`Validation failed: ${error.message}`);
      }

      throw new Error(`Search failed: ${error.message}`);
    }
  }
});
```

### Testing Checklist

**Before Integration:**
- [ ] All tools listed in MCP Inspector
- [ ] Tool descriptions are clear and accurate
- [ ] Input schemas match implementation
- [ ] Valid inputs return expected results
- [ ] Invalid inputs return helpful error messages
- [ ] Edge cases handled (empty query, missing parameters, etc.)
- [ ] Performance is acceptable (< 1s for simple queries)

**After Integration:**
- [ ] Skills reference correct tool names in `allowedTools`
- [ ] AI successfully calls tools during sessions
- [ ] Tool results are properly formatted for AI consumption
- [ ] Error messages are actionable for users
- [ ] Logs provide debugging information

---

## Related Documentation

- [Skill Registration](./SKILL_REGISTRATION.md) - Register skills that use MCP tools
- [Authentication & Authorization](./AUTHENTICATION_AND_AUTHORIZATION.md) - API key setup
- [Error Handling](./ERROR_HANDLING.md) - Standardized error responses

---

## Additional Resources

**Official MCP Documentation:**
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)

**CCAAS Examples:**
- `solutions/quiz-analyzer/mcp-server` - Complete MCP server example
- `solutions/lesson-plan-designer/mcp-server` - Another working example

---

**Last Updated**: 2026-02-16
**Version**: 1.0.0
**Maintainer**: CCAAS Team
