# 2. Designing the Domain Model

## What You Will Learn

In this chapter, you will learn how to design the domain model for a KedgeAgentic Solution. Before writing any code, you need to clearly define **what data** your application manages, **how entities relate** to each other, and **which fields** can be synced between the AI Agent and the frontend form.

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

Spending time on domain modeling saves hours of debugging later. In the KedgeAgentic ecosystem, your domain model is the contract between three systems:

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

## The Lesson Plan Designer

Throughout this tutorial, we build the **Lesson Plan Designer** Solution -- an AI-powered tool that helps teachers create, refine, and manage lesson plans. Let us start by listing what a lesson plan designer needs to track.

### Gathering Requirements

A lesson plan designer needs to:

1. Create, read, update, and delete lesson plans
2. Associate each plan with a textbook (subject, grade, publisher, chapter)
3. Track plan status through a lifecycle (draft, published, archived)
4. Store structured content: objectives, teaching methods, student analysis, materials, assessment methods, and main content
5. Link curriculum standards from a reference database
6. Attach generated files (teaching scripts, audio, PPT)
7. Allow the AI Agent to generate and update lesson plan fields via `write_output`

From these requirements, we can identify one core entity -- **LessonPlan** -- along with two supporting types: **CurriculumStandard** and **LessonPlanAttachment**.

## Defining Entities

### Entity: LessonPlan

A lesson plan is the central entity. It has metadata fields (set during creation), content fields (filled by the AI Agent), and audit fields (managed by the system).

**Metadata Fields** -- set when the plan is created:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (UUID) | Auto | Unique identifier |
| `title` | string | Yes | Lesson plan title |
| `subject` | string | Yes | Subject area (e.g. "math") |
| `gradeLevel` | number | Yes | Grade level (1-12) |
| `durationMinutes` | number | Yes | Class duration in minutes |
| `lessonPlanCode` | string | No | External reference code |
| `status` | enum | Auto | `DRAFT`, `PUBLISHED`, `ARCHIVED` |

**Textbook Fields** -- linking the plan to a specific chapter:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `publisher` | string | No | Textbook publisher |
| `volume` | string | No | Volume (e.g. "Volume 1") |
| `chapterId` | number | No | Chapter identifier |
| `chapterTitle` | string | No | Chapter title |

**Content Fields** -- generated or refined by the AI Agent:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `objectives` | string | No | Learning objectives |
| `studentAnalysis` | string | No | Analysis of student readiness |
| `materialsNeeded` | string | No | Required teaching materials |
| `content` | string | No | Main lesson content |
| `assessmentMethods` | string | No | How to assess learning outcomes |
| `teachingMethods` | string | No | Teaching strategies and methods |

**Structured Data Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `curriculumRequirements` | CurriculumStandard[] | No | Linked curriculum standards |
| `extraProperties` | Record<string, string> | No | Extensible key-value pairs |
| `attachments` | LessonPlanAttachment[] | No | Generated file attachments |

**Audit Fields** -- managed by the system:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `createBy` | string | No | Creator identifier |
| `createTime` | string | Auto | Creation timestamp |
| `updateBy` | string | No | Last updater identifier |
| `updateTime` | string | Auto | Last update timestamp |
| `remark` | string | No | General notes |
| `deleted` | number | Auto | Soft delete flag (0 or 1) |

### Supporting Type: CurriculumStandard

Curriculum standards are queried from a reference database via the `get_curriculum_standards` MCP tool and attached to a lesson plan.

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Standard identifier |
| `standardCode` | string | Official standard code |
| `title` | string | Standard title |
| `stage` | string | Education stage |
| `standardType` | string | Type of standard |
| `contentDomain` | string | Content domain |

### Supporting Type: LessonPlanAttachment

Attachments represent files generated during the lesson planning process (teaching scripts, audio recordings, PPT presentations).

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Attachment identifier |
| `fileId` | string (UUID) | Reference to CCAAS file storage |
| `fileName` | string | Original file name |
| `fileType` | enum | `script`, `audio`, `ppt`, `pdf`, `other` |
| `mimeType` | string | MIME type |
| `size` | number | File size in bytes |
| `downloadUrl` | string | CCAAS download URL |
| `uploadedAt` | string | Upload timestamp |
| `description` | string | Optional description |

### Entity Relationship Diagram

```
┌─────────────────────────────┐
│         LessonPlan          │
├─────────────────────────────┤
│ id                    (PK)  │
│ title                       │
│ subject                     │
│ gradeLevel                  │
│ durationMinutes             │
│ lessonPlanCode              │
│ status                      │
│─────── Textbook ────────────│
│ publisher                   │
│ volume                      │
│ chapterId                   │
│ chapterTitle                │
│─────── Content ─────────────│
│ objectives                  │
│ studentAnalysis             │
│ materialsNeeded             │
│ content                     │
│ assessmentMethods           │
│ teachingMethods             │
│─────── Structured ──────────│
│ curriculumRequirements  [ ] │──▶ CurriculumStandard[]
│ extraProperties         { } │
│ attachments             [ ] │──▶ LessonPlanAttachment[]
│─────── Audit ───────────────│
│ createBy                    │
│ createTime                  │
│ updateBy                    │
│ updateTime                  │
│ remark                      │
│ deleted                     │
└─────────────────────────────┘

┌──────────────────────┐      ┌──────────────────────┐
│ CurriculumStandard   │      │ LessonPlanAttachment  │
├──────────────────────┤      ├──────────────────────┤
│ id                   │      │ id                   │
│ standardCode         │      │ fileId               │
│ title                │      │ fileName             │
│ stage                │      │ fileType             │
│ standardType         │      │ mimeType             │
│ contentDomain        │      │ size                 │
└──────────────────────┘      │ downloadUrl          │
                              │ uploadedAt           │
    Queried from MCP tool     │ description          │
    (get_curriculum_standards)└──────────────────────┘

                               Generated files stored
                               in CCAAS file storage
```

## TypeScript Type Definitions

Define your domain types in a shared location so they can be used across the MCP Server, backend, and frontend.

### Types File

```typescript
// types.ts

export type LessonPlanStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface CurriculumStandard {
  id: number;
  standardCode: string;
  title: string;
  stage: string;
  standardType: string;
  contentDomain: string;
}

export interface LessonPlanAttachment {
  id: string;
  fileId: string;
  fileName: string;
  fileType: 'script' | 'audio' | 'ppt' | 'pdf' | 'other';
  mimeType: string;
  size: number;
  downloadUrl: string;
  uploadedAt: string;
  description?: string;
}

export interface LessonPlan {
  id: string;
  title: string;
  subject: string;
  gradeLevel: number;
  durationMinutes: number;
  lessonPlanCode: string | null;
  status: LessonPlanStatus;

  // Textbook metadata
  publisher: string | null;
  volume: string | null;
  chapterId: number | null;
  chapterTitle: string | null;

  // Curriculum standards (structured array from MCP query)
  curriculumRequirements: CurriculumStandard[];

  // 6 content fields (all plain text)
  objectives: string | null;
  studentAnalysis: string | null;
  materialsNeeded: string | null;
  content: string | null;
  assessmentMethods: string | null;
  teachingMethods: string | null;

  // Extra properties (key-value pairs)
  extraProperties: Record<string, string>;

  // File attachments
  attachments: LessonPlanAttachment[];

  // Audit fields
  createBy: string | null;
  createTime: string;
  updateBy: string | null;
  updateTime: string;
  remark: string | null;
  deleted: number;
}
```

### Why `string | null` Instead of Optional

Notice that we use `string | null` for content fields rather than `string | undefined`. This is intentional:

- **`null`** means "this field exists but has no value" -- it is stored in the database
- **`undefined`** means "this field was not provided" -- it is omitted from the request

When the AI Agent calls `write_output` with `field: "objectives"` and `value: null`, it explicitly clears the objectives. This distinction matters for partial updates.

### Field Categories

The LessonPlan entity has a clear separation of concerns:

| Category | Examples | Set By | When |
|----------|----------|--------|------|
| Metadata | `title`, `subject`, `gradeLevel` | User (via form) | At creation |
| Textbook | `publisher`, `volume`, `chapterId` | User (via cascading selector) | At creation |
| Content | `objectives`, `content`, `teachingMethods` | AI Agent (via `write_output`) | During editing |
| Structured | `curriculumRequirements`, `attachments` | AI Agent or system | During editing |
| Audit | `createTime`, `updateTime`, `deleted` | System | Automatically |

This separation tells you immediately which fields are sync fields and which are not.

## Database Schema

For the Lesson Plan Designer, we use SQLite with better-sqlite3 (the same approach KedgeAgentic recommends for development).

### SQL Schema

```sql
CREATE TABLE IF NOT EXISTS lesson_plans (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT DEFAULT '',
  grade_level INTEGER DEFAULT 1,
  duration_minutes INTEGER DEFAULT 45,
  lesson_plan_code TEXT DEFAULT NULL,
  status TEXT DEFAULT 'DRAFT',

  -- Textbook metadata
  publisher TEXT DEFAULT NULL,
  volume TEXT DEFAULT NULL,
  chapter_id INTEGER DEFAULT NULL,
  chapter_title TEXT DEFAULT NULL,

  -- Content fields and structured data (JSON stored as TEXT)
  curriculum_requirements TEXT DEFAULT NULL,
  objectives TEXT DEFAULT NULL,
  student_analysis TEXT DEFAULT NULL,
  materials_needed TEXT DEFAULT NULL,
  content TEXT DEFAULT NULL,
  assessment_methods TEXT DEFAULT NULL,
  teaching_methods TEXT DEFAULT NULL,

  -- Extensible properties (JSON stored as TEXT)
  extra_properties TEXT DEFAULT NULL,

  -- File attachments (JSON array stored as TEXT)
  attachments TEXT DEFAULT NULL,

  -- Audit fields
  create_by TEXT DEFAULT NULL,
  create_time TEXT NOT NULL,
  update_by TEXT DEFAULT NULL,
  update_time TEXT NOT NULL,
  remark TEXT DEFAULT NULL,
  deleted INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_lesson_plans_status
  ON lesson_plans(status);
```

### Column Naming Convention

Notice the difference between TypeScript (camelCase) and SQL (snake_case):

| TypeScript | SQL Column | Notes |
|-----------|------------|-------|
| `gradeLevel` | `grade_level` | Integer field |
| `durationMinutes` | `duration_minutes` | Integer field |
| `lessonPlanCode` | `lesson_plan_code` | Nullable string |
| `chapterId` | `chapter_id` | Foreign reference |
| `chapterTitle` | `chapter_title` | String field |
| `curriculumRequirements` | `curriculum_requirements` | JSON array as TEXT |
| `studentAnalysis` | `student_analysis` | Plain text |
| `materialsNeeded` | `materials_needed` | Plain text |
| `assessmentMethods` | `assessment_methods` | Plain text |
| `teachingMethods` | `teaching_methods` | Plain text |
| `extraProperties` | `extra_properties` | JSON object as TEXT |
| `createTime` | `create_time` | Timestamp |
| `updateTime` | `update_time` | Timestamp |

You will need a mapping layer to convert between these formats. The backend uses a `rowToLessonPlan()` function and a `fieldToColumn` mapping for this purpose. We will implement this in Chapter 6.

### Storing Complex Types in SQLite

Three fields store JSON data as TEXT columns:

| Field | Stored As | Example Value |
|-------|-----------|---------------|
| `curriculumRequirements` | JSON array | `[{"id":1,"standardCode":"MA-3-1",...}]` |
| `extraProperties` | JSON object | `{"key1":"value1","key2":"value2"}` |
| `attachments` | JSON array | `[{"id":"uuid","fileName":"script.md",...}]` |

The backend parses these with `JSON.parse()` when reading and serializes with `JSON.stringify()` when writing. Error handling ensures that malformed JSON defaults to empty arrays or objects.

## Mapping Fields to write_output

The most critical part of domain modeling for a KedgeAgentic Solution is deciding which fields the AI Agent can update. These are your **sync fields**.

### Defining Sync Fields

```typescript
// Sync field definitions -- these map to write_output field names
export const SYNC_FIELDS = [
  'title',
  'subject',
  'gradeLevel',
  'durationMinutes',
  'lessonPlanCode',
  'objectives',
  'content',
  'teachingMethods',
  'materialsNeeded',
  'assessmentMethods',
  'curriculumRequirements',
  'studentAnalysis',
  'extraProperties',
  'status',
  'attachments',
] as const;

export type SyncField = typeof SYNC_FIELDS[number];
```

The Lesson Plan Designer has **15 sync fields** -- significantly more than a simple application, but the pattern remains the same.

### Why Not Sync Every Field?

Some fields should **not** be synced via `write_output`:

| Field | Synced? | Reason |
|-------|---------|--------|
| `title` | Yes | AI can generate or refine titles |
| `objectives` | Yes | AI generates learning objectives |
| `content` | Yes | AI generates lesson content |
| `teachingMethods` | Yes | AI suggests teaching strategies |
| `materialsNeeded` | Yes | AI lists required materials |
| `assessmentMethods` | Yes | AI designs assessment plans |
| `studentAnalysis` | Yes | AI analyzes student readiness |
| `curriculumRequirements` | Yes | AI links relevant standards |
| `status` | Yes | AI can mark plan as complete |
| `attachments` | Yes | System adds generated files |
| `id` | **No** | System-generated, immutable |
| `publisher` | **No** | Set during creation via form selector |
| `volume` | **No** | Set during creation via form selector |
| `chapterId` | **No** | Set during creation via form selector |
| `chapterTitle` | **No** | Set during creation via form selector |
| `createBy` | **No** | System-generated audit field |
| `createTime` | **No** | System-generated timestamp |
| `updateTime` | **No** | System-generated timestamp |
| `deleted` | **No** | System-managed soft delete flag |

Note: textbook fields (`publisher`, `volume`, `chapterId`, `chapterTitle`) are set through a cascading selector in the "Create Lesson Plan" dialog, not through the AI Agent. This is a design choice -- the user picks the textbook context, then the AI generates content within that context.

### The Sync Field Contract

The sync field list is a contract that must be consistent across three places:

**1. Skill Instructions (SKILL.md)**

```markdown
## Output Format

Use the write_output tool to update lesson plan fields:

- field: "title" -> Lesson plan title (string)
- field: "objectives" -> Learning objectives (string, plain text)
- field: "content" -> Main lesson content (string, plain text)
- field: "teachingMethods" -> Teaching strategies (string, plain text)
- field: "materialsNeeded" -> Required materials (string, plain text)
- field: "assessmentMethods" -> Assessment plan (string, plain text)
- field: "studentAnalysis" -> Student readiness analysis (string, plain text)
- field: "curriculumRequirements" -> Array of CurriculumStandard objects
- field: "extraProperties" -> Key-value pairs, e.g. {"key": "value"}
- field: "status" -> One of: "DRAFT", "PUBLISHED", "ARCHIVED"
```

**2. MCP Server Validation (schemas.ts)**

```typescript
import { z } from 'zod';

export const FieldSchemas = {
  title: z.string().min(1),
  subject: z.string().min(1),
  gradeLevel: z.number().int().min(1).max(12),
  durationMinutes: z.number().int().min(1).max(600),
  lessonPlanCode: z.string(),
  objectives: z.string(),
  content: z.string(),
  teachingMethods: z.string(),
  materialsNeeded: z.string(),
  assessmentMethods: z.string(),
  curriculumRequirements: z.array(CurriculumStandardSchema),
  studentAnalysis: z.string(),
  extraProperties: z.record(z.string(), z.string()),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  attachments: z.array(LessonPlanAttachmentSchema),
} as const;
```

**3. Frontend Form Handler**

```typescript
// Using SDK (recommended)
import { useAgentConnection, useAgentChat } from '@kedge-agentic/react-sdk'

const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',
  solutionId: 'lesson-plan-designer',
})

const { messages, sendMessage } = useAgentChat({
  connection,
  solutionId: 'lesson-plan-designer',
  onOutputUpdate: (update) => {
    // The SDK normalizes raw events into a flat OutputUpdate
    const { field, value } = update;

    switch (field) {
      case 'objectives':
        setObjectives(value as string);
        break;
      case 'content':
        setContent(value as string);
        break;
      case 'teachingMethods':
        setTeachingMethods(value as string);
        break;
      case 'materialsNeeded':
        setMaterialsNeeded(value as string);
        break;
      case 'assessmentMethods':
        setAssessmentMethods(value as string);
        break;
      case 'studentAnalysis':
        setStudentAnalysis(value as string);
        break;
      case 'curriculumRequirements':
        setCurriculumRequirements(value as CurriculumStandard[]);
        break;
      // ... remaining fields
    }
  }
});
```

{% hint style="warning" %}
**If these three are out of sync, things break silently.** The AI Agent might call `write_output` with a field name the MCP Server does not recognize, or the frontend might not handle a field the AI sends. Always keep the sync field list as a single source of truth.
{% endhint %}

## CCAAS Entities vs. Solution Entities

A key architectural principle in KedgeAgentic is the separation between **platform entities** and **domain entities**.

### Platform Entities (managed by CCAAS)

These are infrastructure-level entities that CCAAS manages for you:

| Entity | Purpose | Your Role |
|--------|---------|-----------|
| `Session` | Chat session lifecycle | Use via API |
| `Skill` | AI behavior definition | Define in `solution.json` |
| `Message` | Chat history | Read-only access |
| `ApiKey` | Authentication | Configure once |
| `Solution` | Multi-tenancy isolation | One per Solution |

### Domain Entities (managed by your Solution)

These are business-specific entities that live in your Solution backend:

| Entity | Purpose | Your Role |
|--------|---------|-----------|
| `LessonPlan` | Lesson plan data | Full CRUD ownership |
| `CurriculumStandard` | Reference data | Query via MCP tool |
| `LessonPlanAttachment` | Generated files | Managed with lesson plan |

### Where Each Lives

```
CCAAS Backend (port 3001)          Solution Backend (port 3002)
┌─────────────────────┐            ┌─────────────────────┐
│ sessions             │            │ lesson_plans         │
│ skills               │            │ agent_files          │
│ messages             │            │ chat_messages        │
│ api_keys             │            │ (your domain data)   │
│ tenants              │            │                     │
└─────────────────────┘            └─────────────────────┘
     Platform DB                        Solution DB
```

{% hint style="danger" %}
**Never put domain entities in the CCAAS backend.** This was a real architectural violation in an earlier version of the platform -- a lesson-plan module was accidentally left in the core backend, duplicating code that belonged in the Solution. See the Architecture Principles section in the project guidelines for the full story.
{% endhint %}

## The Field-to-Column Mapping Pattern

Because TypeScript uses camelCase and SQL uses snake_case, the backend needs an explicit mapping. In the Lesson Plan Designer, the `patchField()` method in the service uses this pattern:

```typescript
const fieldToColumn: Record<SyncField, string> = {
  title: 'title',
  subject: 'subject',
  gradeLevel: 'grade_level',
  durationMinutes: 'duration_minutes',
  lessonPlanCode: 'lesson_plan_code',
  objectives: 'objectives',
  content: 'content',
  teachingMethods: 'teaching_methods',
  materialsNeeded: 'materials_needed',
  assessmentMethods: 'assessment_methods',
  curriculumRequirements: 'curriculum_requirements',
  studentAnalysis: 'student_analysis',
  extraProperties: 'extra_properties',
  status: 'status',
  attachments: 'attachments',
};
```

This mapping is used by the `patchField()` method, which handles individual field updates from `write_output`. Fields that store JSON data (`extraProperties`, `curriculumRequirements`, `attachments`) are serialized with `JSON.stringify()` before writing.

## Checkpoint

Before moving to the next chapter, verify that you can answer these questions:

- [ ] What is the core domain entity in the Lesson Plan Designer?
- [ ] How many sync fields does it have, and what are they?
- [ ] Which fields are set during creation and which are filled by the AI Agent?
- [ ] Where does the `lesson_plans` table live -- in the CCAAS database or the Solution database?
- [ ] What happens if the Skill instructions reference a field name that the MCP Server does not recognize?
- [ ] Why do textbook fields (`publisher`, `volume`, etc.) exist on the LessonPlan but are not sync fields?
- [ ] How are complex types like `CurriculumStandard[]` stored in SQLite?

## Exercise: Add a Difficulty Level Field

Extend the LessonPlan entity with a `difficultyLevel` field that indicates the lesson's difficulty:

1. **Choose the data type.** Should difficulty be a number (1-5), an enum (`basic`, `intermediate`, `advanced`), or something else?
2. **Update the TypeScript interface** to include the new field.
3. **Update the SQL schema** with the new column and any constraints.
4. **Decide whether it is a sync field.** Should the AI Agent be able to set the difficulty level?
5. **If yes, update all three locations:** Skill instructions, MCP Server validation (Zod schema), and frontend handler.

<details>
<summary>Suggested Solution</summary>

```typescript
// 1. Choose enum for readability
export type DifficultyLevel = 'basic' | 'intermediate' | 'advanced';

// 2. Update interface
export interface LessonPlan {
  // ... existing fields
  difficultyLevel: DifficultyLevel;
}

// 3. SQL column
// difficulty_level TEXT NOT NULL DEFAULT 'intermediate'
//   CHECK (difficulty_level IN ('basic', 'intermediate', 'advanced'))

// 4. Yes, add to sync fields -- the AI can assess difficulty
//    based on content complexity and grade level
export const SYNC_FIELDS = [
  'title', 'subject', 'gradeLevel', 'durationMinutes',
  'lessonPlanCode', 'objectives', 'content', 'teachingMethods',
  'materialsNeeded', 'assessmentMethods', 'curriculumRequirements',
  'studentAnalysis', 'extraProperties', 'status', 'attachments',
  'difficultyLevel',  // new
] as const;

// 5. Zod schema:
// difficultyLevel: z.enum(['basic', 'intermediate', 'advanced'])
//
// Skill instructions:
// - field: "difficultyLevel" -> One of: "basic", "intermediate", "advanced"
//
// fieldToColumn mapping:
// difficultyLevel: 'difficulty_level'
```

</details>

## Summary

In this chapter you learned how to:

- **Identify entities** from user requirements (LessonPlan, CurriculumStandard, LessonPlanAttachment)
- **Categorize fields** into metadata, textbook, content, structured, and audit groups
- **Define field types** with appropriate constraints and nullability
- **Design the database schema** mapping camelCase to snake_case, including JSON storage for complex types
- **Select sync fields** that the AI Agent can update via `write_output` (15 fields in the Lesson Plan Designer)
- **Maintain consistency** across Skill instructions, MCP Server validation (Zod schemas), and frontend handlers
- **Separate platform entities** (Session, Skill) from domain entities (LessonPlan)
- **Map fields to columns** with an explicit `fieldToColumn` record for the `patchField()` method

In the next chapter, we will map out the **user journeys** -- the step-by-step workflows that users follow when interacting with the Lesson Plan Designer through the AI Agent.

---

**Next:** [3. Mapping User Journeys](03-user-journeys.md)
**Previous:** [1. Understanding Solution Architecture](01-architecture.md)
