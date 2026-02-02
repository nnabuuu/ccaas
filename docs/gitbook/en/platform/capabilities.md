# Core Capabilities

## AI Task Execution

The LoopAI Agent Engine provides natural-language-driven task execution:

- **Natural Language Input** -- Users describe task requirements in natural language, with file attachment support
- **Real-Time Streaming** -- AI thinking processes, tool usage, and output results are pushed to the frontend in real time
- **Visual Execution Status** -- Live display of the AI's current action (thinking, searching, executing, generating)
- **Task Cancellation** -- Interrupt running tasks at any time
- **Session Recovery** -- Automatically restore session state after reconnection

## Skill System

Skills are the core abstraction in LoopAI, defining how an AI Agent behaves in a specific context.

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

### WebSocket Event Stream

The platform pushes a rich set of real-time events via WebSocket:

| Event | Description |
|-------|-------------|
| `text_delta` | AI text streaming output |
| `output_update` | Structured data update |
| `agent_status` | Agent status change (idle, thinking, executing, completed) |
| `tool_activity` | Tool usage activity (start, in-progress, end) |
| `todo_update` | Task list update |
| `token_usage` | Token usage statistics |

## Scheduled Task Execution

LoopAI supports background task scheduling for automated, unattended AI operations:

- **Cron Scheduling** -- Run tasks on cron schedules (e.g., daily at 4 AM)
- **Interval Scheduling** -- Execute tasks at fixed intervals (e.g., every 60 seconds)
- **One-Time Scheduling** -- Schedule a single execution at a specific date/time
- **Headless Execution** -- Tasks run Claude Code CLI without an active WebSocket connection
- **Concurrency Control** -- Configurable maximum concurrent executions per task
- **Retry Logic** -- Automatic retries with configurable delay on failure
- **Execution History** -- Full audit trail of all executions with results, token usage, and duration
- **Real-Time Notifications** -- Socket.io events pushed to the `scheduler:{tenantId}` room
- **Missed Run Detection** -- On server restart, automatically triggers tasks that missed their schedule

### Use Cases

| Scenario | Schedule Type | Example |
|----------|--------------|---------|
| Daily content aggregation | Cron | `0 4 * * *` (4 AM daily) |
| Periodic monitoring | Interval | Every 5 minutes |
| One-time report generation | Once | Specific date/time |
| Automated email summaries | Cron | `0 9 * * 1` (Monday 9 AM) |

## Multi-Tenant Management

- **Tenant Isolation** -- Each tenant has independent configuration, Skills, and data
- **API Key Authentication** -- Fine-grained permission control based on Scopes
- **Quota Management** -- Maximum sessions, daily token limits, and available model restrictions
- **Usage Analytics** -- Token usage statistics, session analytics, and cost tracking

## Message Persistence

- **Complete Conversation History** -- All user messages and AI responses are persisted
- **Session Recovery** -- Support for session reconnection and history restoration
- **File Association** -- AI-generated files are automatically linked to sessions
- **Export Support** -- Conversation history export
