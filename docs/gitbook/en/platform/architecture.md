# Platform Architecture

## Architecture Overview

KedgeAgentic uses a layered architecture where each layer has clear responsibilities and can scale independently.

```
┌─────────────────────────────────────────────┐
│            Frontend Application Layer        │
│   Solution Frontend · Admin Console          │
│                                              │
├─────────────────────────────────────────────┤
│            API Gateway Layer                 │
│   Auth · Session Management · Message        │
│   Routing · Rate Limiting                    │
├─────────────────────────────────────────────┤
│            Orchestration Layer               │
│   Agent Engine · Skill Router · Solution       │
│   Registry                                   │
├─────────────────────────────────────────────┤
│            Execution Layer                   │
│   AI Agent Processes · Tool Invocation ·     │
│   Scheduled Tasks · File Management          │
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

{% hint style="info" %}
**Internal Platform Component**: AgentEngine is managed by the CCAAS platform. As a Solution developer or platform user, you interact with AI capabilities through APIs and SDKs without needing to configure or manage the underlying engine.
{% endhint %}

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

### Scheduler Engine

The Scheduler Engine enables automated, unattended task execution:

- **Dynamic Schedule Registration** -- Register and manage cron jobs, intervals, and timeouts at runtime via `SchedulerRegistry`
- **Headless Execution** -- Spawn AgentEngine without WebSocket, collecting results in-process
- **Concurrency & Retry** -- Per-task concurrency limits and configurable retry policies
- **Missed Run Recovery** -- On startup, detect and trigger tasks that missed their scheduled time

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
- **(Opt-in)** Describe domain types with the ontology + declare workflows with TriggerDef so the platform WorkflowEngine dispatches them automatically. See the [Ontology & Workflow](../ontology/README.md) chapter.

## Data Flow

A complete user interaction follows this data flow:

```
User Input
  │
  ▼
API Gateway ── Authentication ── Solution Resolution
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
Frontend App ── Render Results ── User Interaction
```

## Deployment Architecture

KedgeAgentic supports flexible deployment options:

| Deployment Mode | Use Case | Description |
|-----------------|----------|-------------|
| **Local Development** | Development and debugging | Single-machine setup with SQLite storage |
| **Single-Node** | Small teams | One-click deployment via Docker Compose |
| **Cluster** | Enterprise production | Kubernetes orchestration with PostgreSQL storage |
| **On-Premises** | Security-sensitive environments | Fully isolated deployment within enterprise networks |
