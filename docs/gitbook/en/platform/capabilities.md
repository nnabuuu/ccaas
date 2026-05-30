# Core Capabilities

## AI Task Execution

The KedgeAgentic Agent Engine provides natural-language-driven task execution:

- **Natural Language Input** -- Users describe task requirements in natural language, with file attachment support
- **Real-Time Streaming** -- AI thinking processes, tool usage, and output results are pushed to the frontend in real time
- **Visual Execution Status** -- Live display of the AI's current action (thinking, searching, executing, generating)
- **Task Cancellation** -- Interrupt running tasks at any time
- **Interactive Prompting** -- Agent can pause and ask structured questions; user answers via UI cards or custom wizards
- **Session Recovery** -- Automatically restore session state after reconnection

## Skill System

Skills are the core abstraction in KedgeAgentic, defining how an AI Agent behaves in a specific context.

### Skill Types

| Type | Description | Use Case |
|------|-------------|----------|
| **Prompt** | Instruction-based Skill that defines roles and behavioral guidelines | Most scenarios |
| **Workflow** | Multi-step workflow Skill | Complex processes |
| **Sub-agent** | Sub-Agent Skill with independently configurable models | Specialized subtasks |
| **Tool-config** | Tool configuration Skill | Tool orchestration |

### Intelligent Routing

The Skill Router supports four trigger types to automatically dispatch user requests to the most suitable Skill:

- **Keyword Matching** -- Triggers when the message contains specified keywords
- **Regex Matching** -- Triggers when the message matches a regex pattern
- **Intent Recognition** -- Semantic understanding-based intent matching
- **Context Matching** -- Triggers based on current page, form state, or other contextual factors

## MCP Tool Integration

MCP (Model Context Protocol) provides a standardized tool interface that enables AI Agents to call external services.

### Built-in Tools

- **write\_output** -- Structured output tool that syncs AI-generated content to frontend forms
- **File Operations** -- Read and write files within the workspace

### REST Adapters

Wrap existing REST APIs as MCP tools without modifying the original services:

- Support for GET/POST/PUT/DELETE methods
- Flexible parameter mapping
- Multiple auth methods (OAuth2, API Key, Bearer Token, Basic Auth)
- Built-in health checks and retry mechanisms

### Custom Tool Development

Developers can create custom MCP Servers to provide domain-specific tools.

## Real-Time Collaboration

### Structured Output Sync

AI Agents generate structured data via the `write_output` tool, syncing it to frontend forms in real time:

- **Incremental Updates** -- Supports set, append, and merge operations
- **Progress Tracking** -- Real-time display of generation progress
- **Field-Level Sync** -- Data synchronization at the individual form field level

### SSE Event Stream

The platform pushes a rich set of real-time events via SSE:

| Event | Description |
|-------|-------------|
| `text_delta` | AI text streaming output |
| `output_update` | Structured data update |
| `agent_status` | Agent status change (idle, thinking, executing, completed) |
| `tool_activity` | Tool usage activity (start, in-progress, end); also carries AskUserQuestion payloads for interactive prompting |
| `todo_update` | Task list update |
| `token_usage` | Token usage statistics |

## Scheduled Task Execution

KedgeAgentic supports background task scheduling for automated, unattended AI operations:

- **Cron Scheduling** -- Run tasks on cron schedules (e.g., daily at 4 AM)
- **Interval Scheduling** -- Execute tasks at fixed intervals (e.g., every 60 seconds)
- **One-Time Scheduling** -- Schedule a single execution at a specific date/time
- **Headless Execution** -- Tasks run in the background without an active real-time connection
- **Concurrency Control** -- Configurable maximum concurrent executions per task
- **Retry Logic** -- Automatic retries with configurable delay on failure
- **Execution History** -- Full audit trail of all executions with results, token usage, and duration
- **Real-Time Notifications** -- SSE events pushed to the `scheduler:{solutionId}` room
- **Missed Run Detection** -- On server restart, automatically triggers tasks that missed their schedule

### Use Cases

| Scenario | Schedule Type | Example |
|----------|--------------|---------|
| Daily content aggregation | Cron | `0 4 * * *` (4 AM daily) |
| Periodic monitoring | Interval | Every 5 minutes |
| One-time report generation | Once | Specific date/time |
| Automated email summaries | Cron | `0 9 * * 1` (Monday 9 AM) |

## Context Layer

@ reference system that lets chat users mention business entities inline.

- **Decorator-driven** — `@Referenceable` on controllers + `@Tracked` on service methods
- **7 REST endpoints** — Entity types, suggest, browse, search, resolve, activity, shortcuts
- **Tool-based architecture** — Agent fetches entity data on-demand via MCP tools, not pre-injected
- **Redis-backed recommend engine** — Activity tracking with 5 core actions + extensible custom actions via `ActivityActionConfig`
- **Relation tree** — Auto-inferred from ORM `@ManyToOne` metadata; supports drill-down navigation
- **Frontend** — `<AtPicker />` component with recents, search, drill-down, breadcrumb, and keyboard navigation

## Ontology & Workflow (advanced, opt-in)

A declarative domain-type layer + trigger layer. Solutions describe business with ObjectType / Action / ManifestDef; the platform's WorkflowEngine dispatches automatically. Introduced in Phase 5; live-lesson is the first complete consumer.

- **Typed domain model** — `ObjectTypeDef` / `ActionDef` / `ManifestDef` + Zod schema; one definition reusable from browser, CLI, Node
- **Declarative triggers** — `TriggerDef` in three kinds (event / state-change / object-set-change); engine dispatches the matched ActionDef
- **Cross-process events** — `@kedge-agentic/workflow-client` pushes events to the platform WorkflowEngine over HTTP, with an outbox + retry + dedup
- **Tenant isolation** — Indicator catalog and dashboard data keyed by `(solutionId, sessionId)` tuple
- **Observation pipeline** — Canonical `observations` table + 5 types (lifecycle / exercise / progress / indicator_hit / student_status)

See the [Ontology & Workflow](../ontology/README.md) section for the full chapter.

## Multi-Solution Management

- **Solution Isolation** -- Each solution has independent configuration, Skills, and data
- **API Key Authentication** -- Fine-grained permission control based on Scopes
- **Quota Management** -- Maximum sessions, daily token limits, and available model restrictions
- **Usage Analytics** -- Token usage statistics, session analytics, and cost tracking

## Message Persistence

- **Complete Conversation History** -- All user messages and AI responses are persisted
- **Session Recovery** -- Support for session reconnection and history restoration
- **File Association** -- AI-generated files are automatically linked to sessions
- **Export Support** -- Conversation history export
