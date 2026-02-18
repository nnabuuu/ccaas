# Platform Overview

KedgeAgentic is an **Agentic services platform** that turns business descriptions into production-grade AI services. Developers define Skills and connect MCP tools; the platform manages the rest.

## What KedgeAgentic Is

KedgeAgentic is **not** an AI model or a model wrapper. It is a **Skills + MCP execution platform** that provides:

- **Skill Routing** -- Business logic described in Skills is intelligently matched and executed by the right Agent for each request
- **MCP Tool Orchestration** -- Tools and data sources connected via MCP are available to every Agent session without per-session configuration
- **Session Management** -- Agent Engine lifecycle, session persistence, and context continuity are handled by the platform
- **Multi-Tenant Infrastructure** -- Isolated, production-grade execution for every tenant and solution

## Platform Components

KedgeAgentic consists of the following core components:

| Component | Responsibility |
|-----------|----------------|
| **Agent Engine** | AI Agent execution engine that manages session lifecycles |
| **Skill System** | Skill routing and management with keyword, pattern, and intent matching |
| **MCP Server** | Tool service layer providing external tools callable by AI Agents |
| **Solution Framework** | A complete application framework for vertical use cases |
| **Vue SDK** | Frontend integration SDK with reactive state management |
| **Admin Console** | Administration dashboard with tenant management and analytics |

## Technical Advantages

1. **Session Management** -- Complete session persistence with context recovery, so every conversation builds on previous interactions
2. **Skill Routing** -- Trigger-based intelligent routing with keyword, regex, intent, and context matching
3. **MCP Integration** -- Standardized tool protocol with REST API adapters and custom tool development
4. **Real-Time Streaming** -- SSE-based event streams with live display of thinking processes, tool usage, and output generation
5. **Multi-Tenant Architecture** -- Tenant-level resource isolation and quota management
6. **Message Persistence** -- Complete conversation history storage with session recovery support
