# Platform Overview

KedgeAgentic is an enterprise-grade Human-in-the-Loop AI collaboration platform that provides a unified, real-time collaborative workspace for AI Agents and human operators.

## What KedgeAgentic Is

KedgeAgentic is **not** an AI model or a model wrapper. It is a **collaboration and integration platform** that provides:

- **Version Control** -- Every change (whether by AI or human) automatically creates a version with a complete audit trail
- **Human-AI Collaboration** -- AI output is synced to the web workspace in real time, where humans can review, edit, and refine it
- **Legacy System Integration** -- Connect to legacy systems without requiring modern APIs
- **AI Flexibility** -- A pluggable AI backend architecture with no vendor lock-in

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

1. **Multi-Tenant Architecture** -- Tenant-level resource isolation and quota management
2. **Real-Time Streaming** -- WebSocket-based event streams with live display of thinking processes, tool usage, and output generation
3. **Skill Routing** -- Trigger-based intelligent routing with keyword, regex, intent, and context matching
4. **MCP Integration** -- Standardized tool protocol with REST API adapters and custom tool development
5. **Message Persistence** -- Complete conversation history storage with session recovery support
