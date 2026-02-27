# 1. Understanding Solution Architecture

In this chapter, you will learn what a Solution is, how it fits into the KedgeAgentic platform, and what building blocks make up every Solution. By the end, you will have a clear mental model of the architecture and a concrete understanding of what we are going to build.

## What Problem Does a Solution Solve?

Imagine you are building a lesson plan designer for teachers. Without KedgeAgentic, you would build a standard web app: a React frontend, a Node.js backend, a database. Teachers fill out forms -- selecting textbooks, entering objectives, writing teaching activities -- and the app saves data. This works, but there is no AI assistance.

Now imagine you want to add AI capabilities:

- A teacher selects a textbook chapter and grade level, and the AI generates a complete lesson plan aligned to curriculum standards
- A teacher describes a teaching goal, and the AI suggests objectives, activities, and assessment methods
- A teacher pastes rough notes, and the AI refines them into structured teaching content with proper pedagogical flow

Building this from scratch requires integrating an LLM API, managing prompts, handling streaming responses, syncing AI output to your forms, and adding version control so teachers can undo AI changes. That is a significant amount of infrastructure work that has nothing to do with your business logic.

**A Solution is the answer to this problem.** It is a structured application framework that lets you focus on your domain (lesson plans, textbooks, curriculum standards) while the KedgeAgentic platform handles the AI infrastructure (session management, event streaming, tool invocation, audit trails).

## Platform vs. Solution Responsibilities

The KedgeAgentic platform and your Solution have clearly separated responsibilities:

```
+-----------------------------------------------------------------+
|                    KedgeAgentic Platform (CCAAS)                       |
|                                                                 |
|  +---------------+  +---------------+  +---------------------+ |
|  |   Session      |  |    Skill      |  |   Message           | |
|  |  Management    |  |   Routing     |  |  Persistence        | |
|  +---------------+  +---------------+  +---------------------+ |
|  +---------------+  +---------------+  +---------------------+ |
|  |  AI Agent      |  |   SSE         |  |   Authentication    | |
|  |  Lifecycle     |  |   Events      |  |   & Tenants         | |
|  +---------------+  +---------------+  +---------------------+ |
+-----------------------------------------------------------------+

+-----------------------------------------------------------------+
|                     Your Solution                               |
|                                                                 |
|  +---------------+  +---------------+  +---------------------+ |
|  |   Domain       |  |   Business    |  |    Frontend         | |
|  |   Model        |  |   Logic       |  |    UI               | |
|  +---------------+  +---------------+  +---------------------+ |
|  +---------------+  +---------------+  +---------------------+ |
|  |   MCP Tools    |  |    Skills     |  |   Data              | |
|  | (write_output) |  |  (SKILL.md)   |  |   Storage           | |
|  +---------------+  +---------------+  +---------------------+ |
+-----------------------------------------------------------------+
```

| Responsibility | Who Owns It | Example |
|----------------|-------------|---------|
| Creating and destroying AI Agent sessions | Platform | CCAAS manages agent processes |
| Routing messages to the right Skill | Platform | Keyword/pattern matching |
| Streaming events to the frontend | Platform | SSE events (text\_delta, output\_update) |
| Persisting conversation history | Platform | Message storage |
| Defining what the AI knows and does | Solution | SKILL.md files |
| Providing tools the AI can call | Solution | MCP Server with write\_output |
| Storing business data (lesson plans, textbooks) | Solution | Solution backend + database |
| Rendering the user interface | Solution | React/Vue frontend |

{% hint style="info" %}
**Key Insight**: Your frontend connects **directly** to CCAAS for all AI interactions (chat, streaming, output\_update events). The Solution backend is only responsible for domain data -- storing lesson plans, serving textbook catalogs, managing curriculum standards. This clean separation means your Solution backend has zero AI logic.
{% endhint %}

## The Four Building Blocks

Every KedgeAgentic Solution is composed of four building blocks. Understanding them is the key to designing any Solution:

### 1. Domain Model

The domain model defines your business entities and their relationships. For our Lesson Plan Designer:

- **LessonPlan**: title, subject, gradeLevel, objectives, content, teachingMethods, assessmentMethods
- **Textbook**: subject, grade, publisher, volume, chapters (hierarchical)
- **CurriculumStandard**: standardCode, title, stage, contentDomain

The domain model drives everything else: the database schema, the API endpoints, the form fields, and the AI output format.

### 2. User Journeys

A user journey describes a sequence of steps that a user takes to accomplish a goal, and where the AI can assist. For example:

```
User Journey: "Design a lesson plan from a textbook chapter"

1. Teacher selects subject, grade, publisher, volume, and chapter
2. Teacher creates a new lesson plan linked to the selected chapter
3. Teacher types "Help me design this lesson plan" in the chat
4. AI reads the textbook context and curriculum standards
5. AI generates objectives, activities, and assessments using write_output
6. Content appears in the form for teacher review
7. Teacher edits objectives, adjusts activities, refines assessments
8. Teacher clicks "Save" to persist the lesson plan
```

Identifying user journeys helps you decide which Skills and MCP tools to build.

### 3. Data Flow

Data flow describes how information moves between the frontend, the platform, and the Solution backend. In KedgeAgentic, the frontend has **two connections**:

```
                  +-------------------+
                  |     Frontend      |
                  +-------------------+
                   /                \
        SSE (AI chat)         REST API (domain data)
                 /                    \
    +------------+              +------------------+
    |   CCAAS    |              | Solution Backend |
    | (port 3001)|              |   (port 3002)    |
    +------------+              +------------------+
         |                            |
    AI Agent Process             Database (SQLite)
         |                     (lesson plans, textbooks)
    write_output
         |
    output_update event
         |
    Frontend form updates
```

Understanding this data flow is critical:

- **Frontend to CCAAS** (SSE): Chat messages, streaming responses, output\_update events. The frontend connects directly using `useAgentConnection({ serverUrl: 'http://localhost:3001' })`.
- **Frontend to Solution Backend** (REST API): CRUD operations for lesson plans, textbook catalog queries, curriculum standards lookup. These are standard HTTP calls proxied by Vite in development.

The AI Agent does not write to your database directly. Instead, it calls `write_output` (an MCP tool), which triggers an `output_update` event that reaches your frontend via CCAAS. Your frontend then renders the data for teacher review. Only when the teacher clicks "Save" does the data get persisted to your Solution backend.

### 4. Form Protocol (output\_update)

The form protocol defines how AI-generated data maps to your frontend form fields. Each field that can receive AI data is called a **SyncField**:

```typescript
// The AI calls write_output with:
{ field: "objectives", value: "1. Students will understand...", operation: "set" }

// CCAAS delivers this as an output_update event via SSE:
onOutputUpdate: (update) => {
  // update.field = "objectives"
  // update.value = "1. Students will understand..."
  addPendingUpdate({
    field: update.field,
    value: update.value,
    preview: update.preview,
  })
}
```

Designing the form protocol means deciding:
- Which fields can the AI write to? (In our case: objectives, content, teachingMethods, assessmentMethods, materialsNeeded, studentAnalysis, and more)
- What data type does each field expect? (Strings for text, arrays for curriculum standards)
- How does the frontend handle `set`, `append`, and `merge` operations?

## Our Lesson Plan Designer: The Big Picture

Now that you understand the four building blocks, here is how they come together for our Lesson Plan Designer Solution:

```
+------------------------------------------------------+
|            Lesson Plan Designer Solution              |
|                                                      |
|  Domain Model:                                       |
|    LessonPlan (title, subject, gradeLevel,           |
|      objectives, content, teachingMethods,           |
|      assessmentMethods, curriculumRequirements)      |
|    Textbook (subject, grade, publisher, chapters)    |
|    CurriculumStandard (code, title, domain)          |
|                                                      |
|  User Journeys:                                      |
|    - Design lesson plan from textbook chapter        |
|    - Generate teaching script from lesson plan       |
|    - Create assessment aligned to curriculum         |
|                                                      |
|  Data Flow:                                          |
|    Chat -> CCAAS -> AI Agent -> write_output          |
|    -> output_update -> Frontend Form -> Review        |
|    -> Save -> Solution Backend -> Database            |
|                                                      |
|  Form Protocol:                                      |
|    SyncFields: objectives, content,                  |
|    teachingMethods, assessmentMethods,               |
|    materialsNeeded, studentAnalysis,                 |
|    curriculumRequirements, extraProperties           |
|    Operations: set (text fields),                    |
|    set (structured data like curriculum arrays)      |
+------------------------------------------------------+
```

## Solution Directory Structure

Every Solution follows a standard directory layout:

```
lesson-plan-designer/
|-- solution.json           # Solution configuration
|-- setup.sh                # One-click startup script
|-- inject-skills.sh        # Skill registration script
|
|-- frontend/               # React application
|   |-- package.json
|   |-- src/
|   |   |-- components/     # UI components (ChatPanel, FormSection, etc.)
|   |   |-- hooks/          # Custom React hooks (useLessonPlanSession, useTextbook)
|   |   |-- types/          # TypeScript type definitions (LessonPlan, SyncField)
|   |   +-- utils/          # Utilities (API client, output update parser)
|   +-- ...
|
|-- backend/                # Business backend (NestJS)
|   |-- package.json
|   |-- src/
|   |   |-- lesson-plans/   # LessonPlan entity, controller, service
|   |   |-- textbook/       # Textbook catalog API
|   |   |-- curriculum-standards/  # Curriculum standards data
|   |   +-- files/          # File attachment management
|   +-- ...
|
|-- mcp-server/             # MCP tool service
|   |-- package.json
|   |-- src/
|   |   +-- index.ts        # write_output + custom tools
|   +-- ...
|
+-- skills/                 # AI Skill definitions
    |-- lesson-plan-designer/
    |   +-- SKILL.md         # Main lesson plan design skill
    |-- teaching-script-generator/
    |   +-- SKILL.md         # Teaching script generation
    +-- notebooklm/
        +-- SKILL.md         # Audio/document generation
```

Let us walk through each component:

### solution.json

The central configuration file that tells the platform about your Solution:

```json
{
  "name": "Lesson Plan Designer",
  "slug": "lesson-plan-designer",
  "version": "1.0.0",
  "description": "AI-assisted lesson plan design tool",
  "backend": {
    "port": 3002,
    "ccaasUrl": "http://localhost:3001"
  },
  "mcpServers": {
    "lesson-plan-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "type": "stdio"
    }
  },
  "skills": [
    {
      "name": "Lesson Plan Designer",
      "slug": "lesson-plan-designer",
      "skillFile": "skills/lesson-plan-designer/SKILL.md",
      "triggers": [
        { "type": "keyword", "value": "lesson", "priority": 10 },
        { "type": "keyword", "value": "objectives", "priority": 8 }
      ],
      "allowedTools": ["write_output"]
    }
  ]
}
```

### Frontend

A React application that renders forms and handles `output_update` events from the AI. It connects **directly to CCAAS** via SSE for chat and AI streaming, and to the Solution backend via REST API for domain data (textbooks, lesson plans).

### Backend

A NestJS application that stores business data (lesson plans, textbook catalogs, curriculum standards) and serves REST APIs. It has **no AI logic** -- all AI interaction flows through CCAAS.

### MCP Server

A lightweight service that implements the tools available to the AI Agent. The most important tool is `write_output`, which lets the AI write structured data to your forms.

### Skills

Markdown files that define the AI Agent's behavior: its role, knowledge, workflow, and output format. Each Skill targets a specific user journey. The Lesson Plan Designer has multiple skills including the main designer, a teaching script generator, and an audio/document generator.

## How a Request Flows Through the System

To make this concrete, let us trace a single request through the entire system:

**Scenario**: A teacher has selected "Grade 3 Math, Chapter 2: Multi-digit Multiplication" and types "Help me design this lesson plan" in the chat.

```
Step 1: Teacher sends message via chat input
        Frontend -> SSE -> CCAAS (port 3001)

Step 2: CCAAS receives the message with page context
        The message includes the current lesson plan form state
        (subject, grade, chapter, existing content)

Step 3: CCAAS matches the Skill
        "lesson" keyword matches -> Lesson Plan Designer Skill selected

Step 4: CCAAS launches AI Agent with Skill instructions
        AI reads SKILL.md and understands its role as a lesson designer

Step 5: AI Agent calls write_output multiple times
        { field: "objectives", value: "1. Understand multi-digit..." }
        { field: "content", value: "Introduction (5 min): Review..." }
        { field: "teachingMethods", value: "Guided practice..." }
        { field: "assessmentMethods", value: "Exit ticket..." }

Step 6: CCAAS delivers each call as an output_update event
        Pushes via SSE directly to Frontend

Step 7: Frontend receives output_update events
        Sync buttons appear next to each form field

Step 8: Teacher reviews the generated content
        Clicks "Sync" on objectives, edits teaching methods, discards assessment

Step 9: Teacher clicks "Save"
        Frontend sends PUT request to Solution Backend (port 3002)
        POST /api/lesson-plans/{id} -> Saves to database

Step 10: Lesson plan is persisted with full audit trail
```

{% hint style="success" %}
**Notice**: The AI never writes directly to the database. It proposes data via `write_output`, the teacher reviews it, and only then does it get saved. This is the propose-review-apply pattern at the core of every KedgeAgentic Solution.
{% endhint %}

## Comparing with a Traditional Web App

If you have built traditional web applications, this comparison will help you understand what KedgeAgentic adds:

| Aspect | Traditional Web App | KedgeAgentic Solution |
|--------|--------------------|--------------------|
| User input | Forms + buttons | Forms + buttons + **chat** |
| Data entry | Manual only | Manual + **AI-assisted** |
| Backend | REST API + database | REST API + database + **CCAAS for AI** |
| AI integration | Custom LLM API calls | **Managed by platform** |
| Output handling | Direct DB write | **output\_update -> review -> save** |
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
   No. The AI Agent calls write_output, which triggers an output_update event. The data flows to the frontend, where the teacher reviews it. Only when the teacher clicks "Save" does the data get persisted.
   </details>

3. **How does the frontend connect to CCAAS and the Solution backend?**
   <details>
   <summary>Answer</summary>
   The frontend has two separate connections. It connects directly to CCAAS (port 3001) via SSE for all AI interactions -- chat messages, streaming, and output_update events. It connects to the Solution backend (port 3002) via REST API for domain data -- lesson plan CRUD, textbook catalog queries, and curriculum standards.
   </details>

4. **Why is the design phase (Chapters 1-3) important before coding?**
   <details>
   <summary>Answer</summary>
   The domain model determines your database schema and API endpoints. User journeys determine which Skills and MCP tools you need. Data flow determines how your frontend handles events. Skipping design leads to rework.
   </details>

## Common Pitfalls

{% hint style="danger" %}
**Pitfall 1: Putting business logic in CCAAS.** CCAAS manages AI sessions and event delivery. Your business entities (LessonPlan, Textbook) and business rules belong in your Solution backend, not in CCAAS.
{% endhint %}

{% hint style="danger" %}
**Pitfall 2: Skipping the output\_update protocol.** Some developers try to have the AI write to the database directly via custom MCP tools. This bypasses the propose-review-apply step and removes the teacher's ability to edit before saving.
{% endhint %}

{% hint style="danger" %}
**Pitfall 3: Building a Solution without defining user journeys first.** Without clear journeys, you do not know which Skills to write, what tools to build, or how the AI should behave. This leads to a chatbot that can talk but cannot actually help design lesson plans.
{% endhint %}

## Checkpoint

Before proceeding to Chapter 2, make sure you can answer:

- [ ] I understand what a Solution is and how it differs from a traditional web app
- [ ] I can name the four building blocks: Domain Model, User Journeys, Data Flow, Form Protocol
- [ ] I understand that the frontend connects directly to CCAAS for AI, and to the Solution backend for domain data
- [ ] I understand the propose-review-apply pattern: AI proposes, teacher reviews, then saves
- [ ] I know the standard directory structure of a Solution

## Next Step

With the architecture clear, it is time to design our domain model. Proceed to [Chapter 2: Designing the Domain Model](02-domain-model.md).
