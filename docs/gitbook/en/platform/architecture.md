# Platform Architecture

## Architecture Overview

LoopAI uses a layered architecture where each layer has clear responsibilities and can scale independently.

```
┌─────────────────────────────────────────────┐
│            Frontend Application Layer        │
│   Web Workspace · Collaborative Editor ·     │
│   Admin Console                              │
├─────────────────────────────────────────────┤
│            API Gateway Layer                 │
│   Auth · Session Management · Message        │
│   Routing · Rate Limiting                    │
├─────────────────────────────────────────────┤
│            Orchestration Layer               │
│   Agent Engine · Skill Router · Tenant       │
│   Registry                                   │
├─────────────────────────────────────────────┤
│            Execution Layer                   │
│   AI Agent Processes · Tool Invocation ·     │
│   File Management                            │
├─────────────────────────────────────────────┤
│            MCP Service Layer                 │
│   Built-in Tools · REST Adapters · Custom    │
│   MCP Servers                                │
├─────────────────────────────────────────────┤
│            Persistence Layer                 │
│   Message Storage · Version Management ·     │
│   File Storage · Audit Logs                  │
└─────────────────────────────────────────────┘
```

## Core Architecture Components

### Agent Engine

The Agent Engine is the platform's core execution engine, responsible for:

- **Session Lifecycle Management** -- Creating, resuming, and terminating AI Agent sessions
- **Process Isolation** -- Each session runs independently without interference
- **Event Streaming** -- Real-time push of AI thinking processes, tool usage, and output results
- **Context Management** -- Maintaining conversation history and workspace state

### Skill Router

The Skill Router provides intelligent task dispatch:

- **Trigger Matching** -- Multi-dimensional matching based on keywords, regex, intent, and context
- **Priority Management** -- Trigger priority ordering
- **Version Control** -- Skills support versioning and release workflows

### MCP Service Layer

The MCP (Model Context Protocol) service layer provides a standardized tool interface:

- **REST Adapters** -- Wrap REST APIs as MCP tools
- **Tool Pool Management** -- Manage tool service lifecycles and health checks
- **Multiple Auth Methods** -- Support for OAuth2, API Key, Bearer Token, and Basic Auth

### Solution Framework

A Solution is a complete application framework for vertical use cases:

```
Solution
├── frontend/     # Frontend application (React/Vue)
├── backend/      # Business backend
├── mcp-server/   # Tool services
├── skills/       # AI Skill definitions
└── solution.json # Configuration file
```

Each Solution can:
- Define dedicated MCP tools
- Write customized Skills
- Build an independent frontend interface
- Leverage all platform capabilities

## Data Flow

A complete user interaction follows this data flow:

```
User Input
  │
  ▼
API Gateway ── Authentication ── Tenant Resolution
  │
  ▼
Skill Router ── Trigger Matching ── Select Skill
  │
  ▼
Agent Engine ── Create/Resume Session ── Inject Context
  │
  ▼
AI Agent Process
  │── Thinking Process ──→ Real-time push to frontend
  │── Tool Invocation  ──→ MCP Server execution
  │── Output Results   ──→ Structured data sync
  │
  ▼
Frontend App ── Render Results ── User Review/Edit
```

## Deployment Architecture

LoopAI supports flexible deployment options:

| Deployment Mode | Use Case | Description |
|-----------------|----------|-------------|
| **Local Development** | Development and debugging | Single-machine setup with SQLite storage |
| **Single-Node** | Small teams | One-click deployment via Docker Compose |
| **Cluster** | Enterprise production | Kubernetes orchestration with PostgreSQL storage |
| **On-Premises** | Security-sensitive environments | Fully isolated deployment within enterprise networks |
