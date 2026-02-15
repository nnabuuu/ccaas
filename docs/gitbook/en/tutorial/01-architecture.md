# 1. Understanding Solution Architecture

In this chapter, you will learn what a Solution is, how it fits into the LoopAI platform, and what building blocks make up every Solution. By the end, you will have a clear mental model of the architecture and a concrete understanding of what we are going to build.

## What Problem Does a Solution Solve?

Imagine you are building a task management application. Without LoopAI, you would build a standard web app: a React frontend, a Node.js backend, a database. Users fill out forms, click buttons, and the app saves data. This works, but there is no AI assistance.

Now imagine you want to add AI capabilities:

- A user pastes meeting notes, and the AI creates tasks from them automatically
- A user describes a project, and the AI suggests a breakdown of milestones and tasks
- A user types a vague description, and the AI refines it into a clear, actionable task

Building this from scratch requires integrating an LLM API, managing prompts, handling streaming responses, syncing AI output to your forms, and adding version control so users can undo AI changes. That is a significant amount of infrastructure work that has nothing to do with your business logic.

**A Solution is the answer to this problem.** It is a structured application framework that lets you focus on your domain (tasks, projects, users) while the LoopAI platform handles the AI infrastructure (session management, event streaming, tool invocation, audit trails).

## Platform vs. Solution Responsibilities

The LoopAI platform and your Solution have clearly separated responsibilities:

```
┌────────────────────────────────────────────────────────────────┐
│                    LoopAI Platform (CCAAS)                      │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   Session     │  │    Skill     │  │   Message            │ │
│  │  Management   │  │   Routing    │  │  Persistence         │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  AI Agent     │  │   WebSocket  │  │   Authentication     │ │
│  │  Lifecycle    │  │   Relay      │  │   & Tenants          │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                     Your Solution                              │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   Domain      │  │   Business   │  │    Frontend          │ │
│  │   Model       │  │   Logic      │  │    UI                │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   MCP Tools   │  │    Skills    │  │   Data               │ │
│  │  (write_output)│  │  (SKILL.md) │  │   Storage            │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

| Responsibility | Who Owns It | Example |
|----------------|-------------|---------|
| Creating and destroying AI Agent sessions | Platform | CCAAS manages agent processes |
| Routing messages to the right Skill | Platform | Keyword/pattern matching |
| Streaming events to the frontend | Platform | WebSocket relay |
| Persisting conversation history | Platform | Message storage |
| Defining what the AI knows and does | Solution | SKILL.md files |
| Providing tools the AI can call | Solution | MCP Server with write\_output |
| Storing business data (tasks, projects) | Solution | Solution backend + database |
| Rendering the user interface | Solution | React/Vue frontend |

{% hint style="info" %}
**Key Insight**: Your Solution never talks to the AI Agent directly. All communication goes through the CCAAS platform, which acts as a relay. This separation is what makes the platform AI-engine agnostic -- you can swap the underlying AI model without changing your Solution code.
{% endhint %}

## The Four Building Blocks

Every LoopAI Solution is composed of four building blocks. Understanding them is the key to designing any Solution:

### 1. Domain Model

The domain model defines your business entities and their relationships. For our Task Manager:

- **Task**: title, description, status, priority, assignee
- **Project**: name, description, tasks
- **User**: name, email, role

The domain model drives everything else: the database schema, the API endpoints, the form fields, and the AI output format.

### 2. User Journeys

A user journey describes a sequence of steps that a user takes to accomplish a goal, and where the AI can assist. For example:

```
User Journey: "Create tasks from meeting notes"

1. User pastes meeting notes into the chat
2. AI analyzes the notes and identifies action items
3. AI creates tasks using write_output (one per action item)
4. Tasks appear in the form for user review
5. User edits titles, adjusts priorities, assigns team members
6. User clicks "Save All" to persist the tasks
```

Identifying user journeys helps you decide which Skills and MCP tools to build.

### 3. Data Flow

Data flow describes how information moves between the frontend, backend, and AI Agent. In LoopAI, data flows through WebSocket events:

```
User types message
    │
    ▼
Frontend ──chat event──► Solution Backend ──REST API──► CCAAS
                                                          │
                                                    AI Agent Process
                                                          │
CCAAS ──output_update──► Solution Backend ──event──► Frontend
                                                          │
                                                    Form updates
                                                    with AI data
```

Understanding this data flow is critical. The AI Agent does not write to your database directly. Instead, it calls `write_output` (an MCP tool), which triggers an `output_update` event that reaches your frontend. Your frontend then renders the data for user review. Only when the user clicks "Save" does the data get persisted to your backend.

### 4. Form Protocol (output\_update)

The form protocol defines how AI-generated data maps to your frontend form fields. Each field that can receive AI data is called a **SyncField**:

```typescript
// The AI calls write_output with:
{ field: "title", value: "Review Q3 metrics", operation: "set" }

// This triggers an output_update event that your frontend handles:
socket.on('output_update', (event) => {
  const { field, value } = event.payload.data
  // field = "title", value = "Review Q3 metrics"
  // Update the form field
})
```

Designing the form protocol means deciding:
- Which fields can the AI write to?
- What data type does each field expect?
- How does the frontend handle `set`, `append`, and `merge` operations?

## Our Task Manager: The Big Picture

Now that you understand the four building blocks, here is how they come together for our Task Manager Solution:

```
┌─────────────────────────────────────────────────────┐
│                 Task Manager Solution                │
│                                                     │
│  Domain Model:                                      │
│    Task (title, description, status, priority)      │
│    Project (name, description)                      │
│                                                     │
│  User Journeys:                                     │
│    - Create a single task with AI assistance         │
│    - Bulk-create tasks from meeting notes            │
│    - Get AI suggestions for task breakdown           │
│                                                     │
│  Data Flow:                                         │
│    Chat → CCAAS → AI Agent → write_output           │
│    → output_update → Frontend Form → User Review    │
│    → Save → Solution Backend → Database             │
│                                                     │
│  Form Protocol:                                     │
│    SyncFields: title, description, status,          │
│    priority, assignee, dueDate                      │
│    Operations: set (single fields),                 │
│    append (task list)                               │
└─────────────────────────────────────────────────────┘
```

## Solution Directory Structure

Every Solution follows a standard directory layout:

```
task-manager-tutorial/
├── solution.json           # Solution configuration
├── setup.sh                # One-click startup script
├── inject-skills.sh        # Skill registration script
│
├── frontend/               # React application
│   ├── package.json
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── hooks/          # Custom React hooks
│   │   └── types/          # TypeScript type definitions
│   └── ...
│
├── backend/                # Business backend (NestJS)
│   ├── package.json
│   ├── src/
│   │   ├── tasks/          # Task entity, controller, service
│   │   ├── projects/       # Project entity, controller, service
│   │   └── ...
│   └── ...
│
├── mcp-server/             # MCP tool service
│   ├── package.json
│   ├── src/
│   │   └── index.ts        # write_output + custom tools
│   └── ...
│
└── skills/                 # AI Skill definitions
    ├── task-creator/
    │   └── SKILL.md        # Task creation skill
    └── bulk-importer/
        └── SKILL.md        # Bulk import from notes
```

Let us walk through each component:

### solution.json

The central configuration file that tells the platform about your Solution:

```json
{
  "name": "Task Manager",
  "slug": "task-manager",
  "version": "1.0.0",
  "description": "AI-assisted task management application",
  "mcpServers": {
    "task-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"]
    }
  },
  "skills": [
    {
      "name": "Task Creator",
      "slug": "task-creator",
      "type": "prompt",
      "triggers": [
        { "type": "keyword", "value": "task", "priority": 1 }
      ],
      "allowedTools": ["write_output"],
      "skillFile": "skills/task-creator/SKILL.md"
    }
  ],
  "ports": {
    "backend": 3010,
    "frontend": 5280
  }
}
```

### Frontend

A React application that renders forms and handles `output_update` events from the AI. It connects to the Solution backend via Socket.io.

### Backend

A NestJS application that stores business data (tasks, projects) and relays WebSocket events between the frontend and CCAAS.

### MCP Server

A lightweight service that implements the tools available to the AI Agent. The most important tool is `write_output`, which lets the AI write structured data to your forms.

### Skills

Markdown files that define the AI Agent's behavior: its role, knowledge, workflow, and output format. Each Skill targets a specific user journey.

## How a Request Flows Through the System

To make this concrete, let us trace a single request through the entire system:

**Scenario**: A user types "Create a task: Review Q3 metrics by Friday" in the chat.

```
Step 1: User sends message via chat input
        Frontend → Socket.io → Solution Backend

Step 2: Solution Backend forwards to CCAAS
        POST /api/v1/sessions/{id}/completion
        Body: { message: "Create a task: Review Q3 metrics by Friday" }

Step 3: CCAAS matches the Skill
        "task" keyword matches → Task Creator Skill selected

Step 4: CCAAS launches AI Agent with Skill instructions
        AI reads SKILL.md and understands its role

Step 5: AI Agent calls write_output
        { field: "title", value: "Review Q3 metrics" }
        { field: "dueDate", value: "2026-02-21" }
        { field: "status", value: "TODO" }

Step 6: CCAAS wraps each call as an output_update event
        Pushes via WebSocket → Solution Backend → Frontend

Step 7: Frontend receives output_update events
        Form fields update in real time as the user watches

Step 8: User reviews the form
        Edits the title, changes priority, clicks "Save"

Step 9: Frontend sends save request to Solution Backend
        POST /api/tasks → Saves to database

Step 10: Task is persisted with full audit trail
```

{% hint style="success" %}
**Notice**: The AI never writes directly to the database. It proposes data via `write_output`, the user reviews it, and only then does it get saved. This is the Human-in-the-Loop pattern at the core of every LoopAI Solution.
{% endhint %}

## Comparing with a Traditional Web App

If you have built traditional web applications, this comparison will help you understand what LoopAI adds:

| Aspect | Traditional Web App | LoopAI Solution |
|--------|--------------------|--------------------|
| User input | Forms + buttons | Forms + buttons + **chat** |
| Data entry | Manual only | Manual + **AI-assisted** |
| Backend | REST API + database | REST API + database + **CCAAS relay** |
| AI integration | Custom LLM API calls | **Managed by platform** |
| Output handling | Direct DB write | **output\_update → review → save** |
| Version control | Manual (if any) | **Automatic** audit trail |
| Prompt management | Ad-hoc strings | **Structured Skills** (SKILL.md) |

## Exercise

Before moving on, answer these questions to check your understanding:

1. **What are the four building blocks of a Solution?**
   <details>
   <summary>Answer</summary>
   Domain Model, User Journeys, Data Flow, and Form Protocol (output_update).
   </details>

2. **Does the AI Agent write directly to the Solution database?**
   <details>
   <summary>Answer</summary>
   No. The AI Agent calls write_output, which triggers an output_update event. The data flows to the frontend, where the user reviews it. Only when the user clicks "Save" does the data get persisted.
   </details>

3. **What role does CCAAS play between the frontend and the AI Agent?**
   <details>
   <summary>Answer</summary>
   CCAAS acts as a relay. It manages sessions, routes messages to the correct Skill, launches the AI Agent process, and streams events (text_delta, output_update) back to the frontend via WebSocket.
   </details>

4. **Why is the design phase (Chapters 1-3) important before coding?**
   <details>
   <summary>Answer</summary>
   The domain model determines your database schema and API endpoints. User journeys determine which Skills and MCP tools you need. Data flow determines how your frontend handles events. Skipping design leads to rework.
   </details>

## Common Pitfalls

{% hint style="danger" %}
**Pitfall 1: Putting business logic in CCAAS.** CCAAS is a relay and routing layer. Your business entities (Task, Project) and business rules belong in your Solution backend, not in CCAAS.
{% endhint %}

{% hint style="danger" %}
**Pitfall 2: Skipping the output\_update protocol.** Some developers try to have the AI write to the database directly via custom MCP tools. This bypasses the Human-in-the-Loop review step and removes the user's ability to edit before saving.
{% endhint %}

{% hint style="danger" %}
**Pitfall 3: Building a Solution without defining user journeys first.** Without clear journeys, you do not know which Skills to write, what tools to build, or how the AI should behave. This leads to a chatbot that can talk but cannot actually help.
{% endhint %}

## Checkpoint

Before proceeding to Chapter 2, make sure you can answer:

- [ ] I understand what a Solution is and how it differs from a traditional web app
- [ ] I can name the four building blocks: Domain Model, User Journeys, Data Flow, Form Protocol
- [ ] I understand that CCAAS is a relay, not a business logic layer
- [ ] I understand the Human-in-the-Loop pattern: AI proposes, user reviews, then saves
- [ ] I know the standard directory structure of a Solution

## Next Step

With the architecture clear, it is time to design our domain model. Proceed to [Chapter 2: Designing the Domain Model](02-domain-model.md).
