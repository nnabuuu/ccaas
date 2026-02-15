# 2. Designing the Domain Model

## What You Will Learn

In this chapter, you will learn how to design the domain model for a LoopAI Solution. Before writing any code, you need to clearly define **what data** your application manages, **how entities relate** to each other, and **which fields** can be synced between the AI Agent and the frontend form.

By the end of this chapter, you will be able to:

- Identify domain entities from user requirements
- Design database schemas with appropriate field types
- Map entity fields to `write_output` sync fields
- Distinguish between CCAAS platform entities and Solution domain entities
- Apply these patterns to your own Solutions

## Why Design Before You Code

A common mistake when building Solutions is jumping straight into implementation. This leads to:

- **Inconsistent field names** between the MCP Server, Skill instructions, and frontend
- **Missing fields** that surface only during integration
- **Incorrect data types** that cause runtime errors

Spending time on domain modeling saves hours of debugging later. In the LoopAI ecosystem, your domain model is the contract between three systems:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Skill (AI)    │     │   MCP Server     │     │   Frontend      │
│                 │     │                  │     │                 │
│ "Use write_     │────▶│ Validates field   │────▶│ Renders form    │
│  output with    │     │ names and types   │     │ with matching   │
│  field: title"  │     │                  │     │ field names     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    All three must agree on
                    field names and data types
```

## The Task Manager Example

Throughout this tutorial, we build a **Task Manager** Solution. Let us start by listing what a task manager needs to track.

### Gathering Requirements

A minimal task manager needs to:

1. Create, read, update, and delete tasks
2. Organize tasks into projects
3. Track task status (to-do, in progress, done)
4. Set due dates
5. Allow the AI Agent to generate and update tasks via `write_output`

From these requirements, we can identify two core entities: **Project** and **Task**.

## Defining Entities

### Entity: Project

A project is a container for related tasks. It has a name and an optional description.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | Auto | Unique identifier |
| `name` | string | Yes | Project name |
| `description` | string | No | Brief project description |
| `createdAt` | datetime | Auto | Creation timestamp |
| `updatedAt` | datetime | Auto | Last update timestamp |

### Entity: Task

A task is a single unit of work within a project.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | Auto | Unique identifier |
| `projectId` | string (UUID) | Yes | Foreign key to Project |
| `title` | string | Yes | Task title |
| `description` | string | No | Detailed task description |
| `status` | enum | Yes | `todo`, `in_progress`, `done` |
| `dueDate` | date | No | Target completion date |
| `tags` | string[] | No | Categorization labels |
| `createdAt` | datetime | Auto | Creation timestamp |
| `updatedAt` | datetime | Auto | Last update timestamp |

### Entity Relationship Diagram

```
┌──────────────┐         ┌──────────────────────┐
│   Project    │         │        Task          │
├──────────────┤         ├──────────────────────┤
│ id       (PK)│────┐    │ id           (PK)    │
│ name         │    │    │ projectId    (FK)    │◀─┐
│ description  │    └───▶│                      │  │
│ createdAt    │  1 : N  │ title                │  │
│ updatedAt    │         │ description          │  │
└──────────────┘         │ status               │  │
                         │ dueDate              │  │
                         │ tags                 │  │
                         │ createdAt            │  │
                         │ updatedAt            │  │
                         └──────────────────────┘  │
                                                   │
                         One Project has many Tasks─┘
```

## TypeScript Type Definitions

Define your domain types in a shared location so they can be used across the MCP Server, backend, and frontend.

### Types File

```typescript
// types.ts

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
```

### Why `string | null` Instead of Optional

Notice that we use `string | null` for optional fields rather than `string | undefined`. This is intentional:

- **`null`** means "this field exists but has no value" -- it is stored in the database
- **`undefined`** means "this field was not provided" -- it is omitted from the request

When the AI Agent calls `write_output` with `field: "description"` and `value: null`, it explicitly clears the description. This distinction matters for partial updates.

## Database Schema

For the Task Manager, we use SQLite (the same database engine LoopAI uses in development mode).

### SQL Schema

```sql
-- Create Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'done')),
  due_date TEXT,
  tags TEXT DEFAULT '[]',  -- JSON array stored as text
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

### Column Naming Convention

Notice the difference between TypeScript (camelCase) and SQL (snake_case):

| TypeScript | SQL Column | Notes |
|-----------|------------|-------|
| `projectId` | `project_id` | Foreign key |
| `createdAt` | `created_at` | Timestamp |
| `dueDate` | `due_date` | Date field |
| `tags` | `tags` | JSON array as TEXT |

You will need a mapping layer to convert between these formats. We will implement this in Chapter 6.

## Mapping Fields to write_output

The most critical part of domain modeling for a LoopAI Solution is deciding which fields the AI Agent can update. These are your **sync fields**.

### Defining Sync Fields

```typescript
// Sync field definitions -- these map to write_output field names
export const SYNC_FIELDS = [
  'title',
  'description',
  'status',
  'dueDate',
  'tags',
] as const;

export type SyncField = typeof SYNC_FIELDS[number];
```

### Why Not Sync Every Field?

Some fields should **not** be synced via `write_output`:

| Field | Synced? | Reason |
|-------|---------|--------|
| `title` | Yes | AI generates task titles |
| `description` | Yes | AI generates descriptions |
| `status` | Yes | AI can update task status |
| `dueDate` | Yes | AI can suggest due dates |
| `tags` | Yes | AI can suggest tags |
| `id` | **No** | System-generated, immutable |
| `projectId` | **No** | Set during creation, not changed via form |
| `createdAt` | **No** | System-generated timestamp |
| `updatedAt` | **No** | System-generated timestamp |

### The Sync Field Contract

The sync field list is a contract that must be consistent across three places:

**1. Skill Instructions (SKILL.md)**

```markdown
## Output Format

Use the write_output tool to update task fields one at a time:

- field: "title" -> Task title (string)
- field: "description" -> Task description (string)
- field: "status" -> One of: "todo", "in_progress", "done"
- field: "dueDate" -> ISO date string, e.g. "2026-03-15"
- field: "tags" -> Array of strings, e.g. ["urgent", "frontend"]
```

**2. MCP Server Validation**

```typescript
const VALID_FIELDS = ['title', 'description', 'status', 'dueDate', 'tags'];

server.tool('write_output', schema, async (params) => {
  if (!VALID_FIELDS.includes(params.field)) {
    return { error: `Invalid field: ${params.field}` };
  }
  // process the field update...
});
```

**3. Frontend Form Handler**

```typescript
socket.on('output_update', (event) => {
  const { field, value } = event.payload.data;

  switch (field) {
    case 'title':
      setTitle(value as string);
      break;
    case 'description':
      setDescription(value as string);
      break;
    case 'status':
      setStatus(value as TaskStatus);
      break;
    case 'dueDate':
      setDueDate(value as string | null);
      break;
    case 'tags':
      setTags(value as string[]);
      break;
  }
});
```

{% hint style="warning" %}
**If these three are out of sync, things break silently.** The AI Agent might call `write_output` with a field name the MCP Server does not recognize, or the frontend might not handle a field the AI sends. Always keep the sync field list as a single source of truth.
{% endhint %}

## CCAAS Entities vs. Solution Entities

A key architectural principle in LoopAI is the separation between **platform entities** and **domain entities**.

### Platform Entities (managed by CCAAS)

These are infrastructure-level entities that CCAAS manages for you:

| Entity | Purpose | Your Role |
|--------|---------|-----------|
| `Session` | Chat session lifecycle | Use via API |
| `Skill` | AI behavior definition | Define in `solution.json` |
| `Message` | Chat history | Read-only access |
| `ApiKey` | Authentication | Configure once |
| `Tenant` | Multi-tenancy isolation | One per Solution |

### Domain Entities (managed by your Solution)

These are business-specific entities that live in your Solution backend:

| Entity | Purpose | Your Role |
|--------|---------|-----------|
| `Project` | Task organization | Full CRUD ownership |
| `Task` | Work items | Full CRUD ownership |

### Where Each Lives

```
CCAAS Backend (port 3001)          Solution Backend (port 3002)
┌─────────────────────┐            ┌─────────────────────┐
│ sessions             │            │ projects             │
│ skills               │            │ tasks                │
│ messages             │            │ (your domain data)   │
│ api_keys             │            │                     │
│ tenants              │            │                     │
└─────────────────────┘            └─────────────────────┘
     Platform DB                        Solution DB
```

{% hint style="danger" %}
**Never put domain entities in the CCAAS backend.** This was a real architectural violation in an earlier version of the platform -- a lesson-plan module was accidentally left in the core backend, duplicating code that belonged in the Solution. See the Architecture Principles section in the project guidelines for the full story.
{% endhint %}

## Real-World Example: Lesson Plan Designer

To see how these patterns work at scale, consider the Lesson Plan Designer Solution that ships with the platform. Its domain model is significantly more complex:

### Lesson Plan Entity (Simplified)

```typescript
interface LessonPlan {
  id: string;
  title: string;
  subject: string;
  gradeLevel: number;
  durationMinutes: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

  // Content fields (all synced via write_output)
  objectives: string | null;
  content: string | null;
  teachingMethods: string | null;
  materialsNeeded: string | null;
  assessmentMethods: string | null;
  studentAnalysis: string | null;

  // Structured data
  curriculumRequirements: CurriculumStandard[];
  extraProperties: Record<string, string>;
  attachments: LessonPlanAttachment[];
}
```

### Key Observations

1. **15 sync fields** -- much more than our Task Manager's 5, but the pattern is the same
2. **Nested types** -- `CurriculumStandard[]` and `LessonPlanAttachment[]` show that sync field values can be complex objects, not just primitives
3. **Metadata vs. content** -- fields like `subject` and `gradeLevel` are set during creation, while content fields like `objectives` are filled by the AI Agent
4. **Status lifecycle** -- DRAFT -> PUBLISHED -> ARCHIVED mirrors our todo -> in_progress -> done

## Checkpoint

Before moving to the next chapter, verify that you can answer these questions:

- [ ] What are the two domain entities in the Task Manager?
- [ ] Which fields are sync fields and which are not? Why?
- [ ] Where does the Project table live -- in the CCAAS database or the Solution database?
- [ ] What happens if the Skill instructions reference a field name that the MCP Server does not recognize?
- [ ] Why do we use `string | null` instead of optional fields for database-backed properties?

## Exercise: Add a Priority Field

Extend the Task entity with a `priority` field:

1. **Choose the data type.** Should priority be a number (1-5), an enum (`low`, `medium`, `high`), or something else?
2. **Update the TypeScript interface** to include the new field.
3. **Update the SQL schema** with the new column and any constraints.
4. **Decide whether it is a sync field.** Should the AI Agent be able to set task priority?
5. **If yes, update all three locations:** Skill instructions, MCP Server validation, and frontend handler.

<details>
<summary>Suggested Solution</summary>

```typescript
// 1. Choose enum for readability
export type TaskPriority = 'low' | 'medium' | 'high';

// 2. Update interface
export interface Task {
  // ... existing fields
  priority: TaskPriority;
}

// 3. SQL column
// priority TEXT NOT NULL DEFAULT 'medium'
//   CHECK (priority IN ('low', 'medium', 'high'))

// 4. Yes, add to sync fields
export const SYNC_FIELDS = [
  'title', 'description', 'status',
  'dueDate', 'tags', 'priority',
] as const;

// 5. Update Skill instructions:
// - field: "priority" -> One of: "low", "medium", "high"
```

</details>

## Summary

In this chapter you learned how to:

- **Identify entities** from user requirements (Project, Task)
- **Define field types** with appropriate constraints and nullability
- **Design the database schema** mapping camelCase to snake_case
- **Select sync fields** that the AI Agent can update via `write_output`
- **Maintain consistency** across Skill instructions, MCP Server, and frontend
- **Separate platform entities** (Session, Skill) from domain entities (Project, Task)

In the next chapter, we will map out the **user journeys** -- the step-by-step workflows that users follow when interacting with the Task Manager through the AI Agent.

---

**Next:** [3. Mapping User Journeys](03-user-journeys.md)
**Previous:** [1. Understanding Solution Architecture](01-architecture.md)
