# Developer Guide Overview

This chapter is intended for developers and provides a complete technical guide for building applications on the KedgeAgentic platform.

## Chapter Navigation

| Chapter | Content | Reading Order |
|---------|---------|---------------|
| [Solution Development Guide](solution-dev.md) | Complete development workflow for Solutions | Step 1 |
| [Skill Writing Guide](skill-writing.md) | How to write AI Skills | Step 2 |
| [MCP Server Development](mcp-server.md) | How to develop MCP tool services | Step 3 |
| [write\_output Best Practices](write-output.md) | Proper usage of structured output | Read alongside MCP |
| [Frontend Integration Guide](frontend.md) | How to integrate the frontend SDK | Step 4 |

## Development Workflow Overview

A typical workflow for building a KedgeAgentic Solution:

```
1. Plan the Solution structure
   └── Define target use case, required tools, and frontend interaction patterns

2. Write solution.json
   └── Configure MCP Servers, Skills, and ports

3. Develop the MCP Server
   └── Implement write_output and custom tools

4. Write Skills
   └── Define AI Agent roles, knowledge, and workflows

5. Build the frontend
   └── Integrate the SDK, handle event streams, and build the UI

6. End-to-end testing
   └── Validate the complete data flow from end to end
```

## Core Concepts at a Glance

### Solution

A complete application targeting a specific vertical use case, consisting of frontend, backend, MCP tools, and AI Skills.

### Skill

Defines how an AI Agent behaves in a given scenario, including its role, knowledge scope, tool permissions, and output format.

### MCP Server

Provides callable external tools to the AI Agent, communicating through the standardized MCP protocol.

### write\_output

An MCP tool used to synchronize AI-generated structured data to frontend forms.

### Event Stream

Real-time events produced during AI Agent execution (text, status, tool activity, output updates, etc.), pushed to the frontend via SSE.
