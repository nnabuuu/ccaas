# 6.4 Skills

## What You Will Build

In this section, you will write the Skill definitions for the Lesson Plan Designer. Skills are Markdown files that act as the AI Agent's instruction manual -- they define what the Agent knows, what tools it can use, and how it should respond to user requests.

By the end of this section, you will have:

- A **Lesson Plan Designer** Skill for polishing lesson plans and generating materials
- A **Teaching Script Generator** Skill for converting lesson plans into teacher scripts
- A **NotebookLM** Skill for generating audio and PDF slide decks
- All Skills registered in `solution.json` with the v3.0 `{ slug, name }` format
- An understanding of how Skills, MCP tools, and sync fields connect

## What Is a Skill?

A Skill is a Markdown file (`SKILL.md`) that serves as the AI Agent's system prompt for a specific task. When a user sends a message, CCAAS matches it against Skill triggers and injects the matching Skill's content into the Agent's context.

```
User message: "帮我优化教学目标"
                │
                ▼
CCAAS Skill Router:
  - Matches trigger: "教学目标" → lesson-plan-designer Skill
                │
                ▼
AI Agent receives:
  - System prompt: SKILL.md content
  - Available tools: write_output, read_context, attach_file
  - User message: "帮我优化教学目标"
                │
                ▼
AI Agent calls read_context() to get current form state,
then calls write_output(field="objectives", value="...")
```

## Skill File Structure

A Lesson Plan Designer Skill file has these main sections:

```markdown
# Skill Name

## Role Definition
Who the AI Agent is and what it does.

## Theoretical Framework
Domain knowledge and pedagogical theory the Agent applies.

## Workflow
Step-by-step process the Agent follows.

## Output Format
How to use write_output / attach_file and what fields are available.

## Constraints
Explicit boundaries and mandatory steps (e.g., read_context first).
```

The key difference from a generic Skill is the **mandatory context-reading step** -- lesson plan Skills must call `read_context` before responding, so the Agent knows what the user has already filled in the form.

## Step 1: Write the Lesson Plan Designer Skill

Create `skills/lesson-plan-designer/SKILL.md`:

This is the primary Skill. It handles lesson plan polishing, objective optimization, assessment design, and multi-format output generation (scripts, audio, PPT). It is grounded in Professor Cui Yunhuo's curriculum design theory.

```markdown
# Lesson Plan Polish Expert

> **Mandatory: Before replying to any user message, you must first call
> the `read_context` tool to understand the current lesson plan state.
> Do not ask the user for information already present in the form.**

## When to Use

When you need to:
- Optimize an existing lesson plan
- Check alignment with curriculum standards
- Improve learning objective statements
- Design more effective assessment tasks

## Theoretical Framework

This Skill is based on Professor Cui Yunhuo's curriculum and instruction
design theory from East China Normal University. Core principles:

### 1. Backward Design (Three Stages)
- Stage 1: Identify desired results (big ideas, core competencies)
- Stage 2: Determine acceptable evidence (performance tasks)
- Stage 3: Plan learning experiences and instruction

### 2. Learning Objective Notation (ABCD Method)
- A - Audience: The student
- B - Behavior: Observable action verb (analyze, compare, create...)
- C - Condition: Under what circumstances
- D - Degree: To what standard

### 3. Performance Assessment (GRASPS Framework)
- Goal, Role, Audience, Situation, Product, Standards

## Context Reading (Mandatory)

Call `read_context()` before every response. The returned structure:

{
  "pageType": "lesson-plan-editor",
  "pageData": {
    "currentForm": {
      "title": "...",
      "subject": "...",
      "gradeLevel": 3,
      "objectives": "...",
      "content": "...",
      "assessmentMethods": "...",
      ...
    }
  }
}

Use `mode: "diff"` on subsequent calls to save tokens.

## Output Format

Use write_output to update lesson plan fields:
- field: "objectives" → string (ABCD-format learning objectives)
- field: "content" → string (teaching process / learning activities)
- field: "assessmentMethods" → string (assessment design)
- field: "extraProperties" → object (additional key-value data)

## Multi-Format Output

| Command | Action |
|---------|--------|
| "优化教案" | Optimize with Cui Yunhuo's theory |
| "生成讲稿" | Generate teaching script |
| "生成音频" | Generate script + audio via NotebookLM |
| "生成PPT" | Generate PDF slides via NotebookLM |
| "全套材料" | Full pipeline: script + audio + slides |
```

### Key Design Decisions in This Skill

**1. Mandatory `read_context` before every response.** The Agent must know what the user has already entered in the form. This prevents the Agent from asking redundant questions and enables targeted suggestions.

**2. Pedagogical theory as domain knowledge.** Rather than a generic assistant, this Skill encodes a specific theoretical framework (backward design, ABCD objectives). This makes the Agent a domain expert rather than a general chatbot.

**3. Multi-format output orchestration.** The primary Skill can trigger other Skills (teaching script, NotebookLM) through the `Skill` tool, acting as an orchestrator for the "full materials" workflow.

**4. `read_context` diff mode.** After the first full context read, subsequent calls use `mode: "diff"` to return only changed fields, reducing token usage by 90-95%.

## Step 2: Write the Teaching Script Generator Skill

Create `skills/teaching-script-generator/SKILL.md`:

This Skill converts a structured lesson plan into a conversational teaching script -- the kind of spoken guide a teacher would follow during class.

```markdown
# Teaching Script Generator

> **Mandatory: Before replying, read `.context/lesson-plan.json`
> to understand the current lesson plan. Do not ask the user for
> information already in the form.**

## When to Use

When you need to:
- Convert a lesson plan into a teacher's spoken script
- Generate classroom dialogue suggestions
- Create a complete teaching guide with transitions

## Script vs. Lesson Plan

| Feature | Lesson Plan | Teaching Script |
|---------|-------------|-----------------|
| Style | Formal, procedural | Conversational, spoken |
| Audience | Reviewers, peers | The teacher personally |
| Content | Objectives, activities | Teacher dialogue, transitions |

## Mandatory Pre-Step

Read the lesson plan context:

Read(".context/lesson-plan.json")

Required fields: title, subject, gradeLevel, objectives, content
Optional but recommended: studentAnalysis, assessmentMethods

## Script Structure (9 sections)

1. Basic Information (subject, grade, duration)
2. Opening Remarks (suggested greeting and context)
3. Objective Explanation (oral version of objectives)
4. Key Points Analysis (what is hard, why, how to address)
5. Teaching Process (per-phase teacher dialogue scripts)
6. Assessment Guidance (observation points, key questions)
7. Classroom Management (time control, contingency plans)
8. Course Summary (closing remarks)
9. Reflection Prompts (post-class self-evaluation)

## Dual Output

After generating, sync both text and file:

1. write_output({ field: "extraProperties",
   value: { "讲稿": scriptContent },
   preview: "Teaching script (2500 words)" })

2. Write the file: Write({ file_path: "教学讲稿.md", content: ... })

3. attach_file({ filePath: "教学讲稿.md",
   fileType: "script",
   description: "Teaching script - 9-section guide" })
```

### Key Design Decisions

**1. Dual output pattern (text + file).** The script is synced to `extraProperties` for inline viewing in the form *and* saved as a downloadable `.md` file via `attach_file`. Users get both in-app viewing and offline access.

**2. Nine-section template.** The fixed structure ensures consistency across all generated scripts. Each section maps to a specific teaching need (opening, transitions, questioning strategies, contingency plans).

**3. Context file vs. `read_context` tool.** This Skill reads `.context/lesson-plan.json` directly using the `Read` tool, while the primary Skill uses the `read_context` MCP tool. Both approaches work -- the context file is written by the platform whenever the form state changes.

## Step 3: Write the NotebookLM Skill

Create `skills/notebooklm/SKILL.md`:

This Skill integrates with Google NotebookLM to generate audio podcasts and PDF slide decks from lesson plan content. It is typically called as a chained Skill from the primary Lesson Plan Designer Skill.

```markdown
# NotebookLM Automation

Automate Google NotebookLM: create notebooks, add sources,
generate artifacts (podcasts, slides), and download results.

## When This Skill Activates

- Explicit: User says "/notebooklm" or "use notebooklm"
- Intent: "Create a podcast about [topic]",
  "Generate slides from my research"

## Core Workflow

1. notebooklm create "Title"        → Create notebook
2. notebooklm source add <file>     → Add lesson plan as source
3. notebooklm source wait <id>      → Wait for processing
4. notebooklm generate audio "..."  → Generate podcast
5. notebooklm artifact wait <id>    → Wait for generation
6. notebooklm download audio ./out  → Download result

## Lesson Plan Integration

CRITICAL: After downloading any artifact, ALWAYS call attach_file:

attach_file({
  filePath: "教学讲解音频.mp3",
  fileType: "audio",
  description: "Teaching audio - 8 min Chinese narration"
})

## Language Matching

Match the user's language in all NotebookLM instructions:
- Chinese user → "用中文讲解关键概念"
- English user → "Explain key concepts in English"
```

### Key Design Decisions

**1. Subagent pattern for long operations.** Audio generation takes 5-15 minutes. The Skill spawns a background subagent using the `Task` tool to wait and download, keeping the main conversation unblocked.

**2. Mandatory `attach_file` after download.** Every downloaded artifact must be attached to the lesson plan via `attach_file`. This ensures files appear in the lesson plan's attachment section.

**3. Language-aware instructions.** NotebookLM generates content in the language of its instructions. The Skill detects the user's language and passes matching instructions to ensure correct output language.

## Step 4: Write the Lesson Plan PPTX Skill

Create `skills/lesson-plan-pptx/SKILL.md`:

This Skill generates PDF slide decks from lesson plans using NotebookLM's slide-deck feature. Despite the "PPTX" name, it produces PDF format for universal compatibility.

```markdown
# Lesson Plan PPTX - Slide Generator

Unified slide generation: whether the user says "generate PPT",
"create slides", or "make PDF", this Skill uses NotebookLM
to produce PDF-format teaching slides.

## Triggers (from SKILL.md frontmatter)

triggers:
  - type: keyword
    value: "生成PPT"
    priority: 100
  - type: keyword
    value: "生成幻灯片"
    priority: 95
  - type: keyword
    value: "创建课件"
    priority: 90
  - type: intent
    value: "将教案转化为幻灯片或演示文稿"
    priority: 80

## Workflow

1. Read lesson plan from `.context/lesson-plan.json`
2. Validate required fields (title, objectives, content)
3. Format as Markdown and save temp file
4. Create NotebookLM notebook, add source
5. Generate slide-deck with localized instructions
6. Spawn subagent to wait, download, and attach_file

## Output

- Format: PDF (not .pptx)
- Pages: 10-15 (auto-determined by NotebookLM)
- Generation time: 5-15 minutes (background)
- Auto-attached via attach_file after completion
```

## Step 5: Register Skills in solution.json

Add all Skills to `solution.json`. Here is the actual configuration from the Lesson Plan Designer:

```json
{
  "skills": [
    { "slug": "lesson-plan-designer", "name": "lesson-plan-designer" },
    { "slug": "teaching-script-generator", "name": "teaching-script-generator" },
    { "slug": "lesson-plan-pptx", "name": "lesson-plan-pptx" },
    { "slug": "notebooklm", "name": "notebooklm" }
  ]
}
```

{% hint style="info" %}
**v3.0 schema simplification.** In the v3.0 solution.json format, Skills are registered with just `slug` and `name`. Trigger configuration, `allowedTools`, and other Skill settings are defined in the SKILL.md frontmatter or configured through the admin dashboard. This keeps `solution.json` focused on declaring *which* Skills exist, while the Skill files themselves define *how* they work.
{% endhint %}

### Trigger Configuration

In the v3.0 format, triggers are configured in the SKILL.md frontmatter rather than in `solution.json`. The trigger system uses two main properties:

| Field | Description |
|-------|-------------|
| `type` | `keyword` matches exact words; `intent` uses semantic matching |
| `value` | The keyword or intent description to match |
| `priority` | Higher number = higher priority when multiple Skills match |

**How triggers work:**

1. User sends: "帮我优化教学目标" (Help me optimize learning objectives)
2. CCAAS scans the message against all Skill triggers defined in their SKILL.md frontmatter
3. "教学目标" matches the Lesson Plan Designer Skill (priority 8)
4. CCAAS injects the Lesson Plan Designer SKILL.md into the AI Agent context

**When multiple Skills match:**

If the user says "生成PPT", both the Lesson Plan Designer (priority 9 for "生成PPT") and the Lesson Plan PPTX Skill (priority 100 for "生成PPT") match. CCAAS selects the trigger with the highest priority, so the PPTX Skill handles it. This shows how specialized Skills can override general ones through priority.

### Trigger Types

The Lesson Plan Designer uses two trigger types:

| Type | How It Works | Example |
|------|-------------|---------|
| `keyword` | Exact substring match in user message | `"生成PPT"` matches "请帮我生成PPT" |
| `intent` | Semantic similarity matching | `"将教案转化为幻灯片"` matches "我想把教案做成课件" |

Keyword triggers are fast and deterministic. Intent triggers are more flexible but require semantic matching, which adds latency.

### Skill-to-Skill Invocation

In the v3.0 format, the `chainedSkills` section in `solution.json` has been removed. Instead, Skills invoke other Skills through the `Skill` tool:

```typescript
// Inside a SKILL.md instruction:
// "When the user requests full materials, invoke the NotebookLM Skill
// using the Skill tool to generate audio and slides."
```

This approach is simpler and more explicit -- the orchestration logic lives in the Skill instructions rather than in configuration.

## How Skills, MCP Tools, and Frontend Connect

Here is the complete picture using the Lesson Plan Designer's actual field names:

```
┌─────────────────────────────────────────────────────┐
│                    SKILL.md                         │
│                                                     │
│  "Use write_output with field='objectives'"         │
│  "Use attach_file for generated audio/PDF"          │
│  "Call read_context before every response"          │
│                                                     │
│  Tells the AI Agent WHAT to do                      │
└──────────────────────┬──────────────────────────────┘
                       │ AI Agent follows
                       │ these instructions
                       ▼
┌─────────────────────────────────────────────────────┐
│                  MCP Server                         │
│                                                     │
│  SYNC_FIELDS = [                                    │
│    'title', 'subject', 'gradeLevel',                │
│    'objectives', 'content',                         │
│    'assessmentMethods', 'extraProperties',          │
│    'attachments', ...                               │
│  ]                                                  │
│                                                     │
│  Tools: write_output, attach_file,                  │
│         read_context, get_curriculum_standards      │
│                                                     │
│  Validates and routes the data                      │
└──────────────────────┬──────────────────────────────┘
                       │ CCAAS wraps into
                       │ output_update event
                       ▼
┌─────────────────────────────────────────────────────┐
│                   Frontend                          │
│                                                     │
│  switch (field) {                                   │
│    case 'objectives': setObjectives(value); break;  │
│    case 'content': setContent(value); break;        │
│    case 'attachments': addAttachment(value); break; │
│  }                                                  │
│                                                     │
│  Renders the data in the lesson plan form           │
└─────────────────────────────────────────────────────┘
```

{% hint style="danger" %}
**The field names must be identical across all three.** If the Skill says `"title"`, the MCP Server must validate `"title"`, and the frontend must handle `"title"`. Use the `SYNC_FIELDS` array in `mcp-server/src/types.ts` as the single source of truth.
{% endhint %}

### The Complete SYNC_FIELDS List

These are the actual sync fields defined in `mcp-server/src/types.ts`:

```typescript
export const SYNC_FIELDS = [
  'title',              // Lesson title
  'subject',            // Subject (math, chinese, etc.)
  'gradeLevel',         // Grade level (1-12)
  'durationMinutes',    // Class duration in minutes
  'lessonPlanCode',     // Lesson plan identifier
  'objectives',         // Learning objectives (ABCD format)
  'content',            // Teaching process / learning activities
  'teachingMethods',    // Teaching methodology
  'materialsNeeded',    // Required materials
  'assessmentMethods',  // Assessment design
  'curriculumRequirements', // Curriculum standard references
  'studentAnalysis',    // Student background analysis
  'extraProperties',    // Extensible key-value store (e.g., scripts)
  'status',             // Lesson plan status
  'attachments',        // File attachments (audio, PDF, etc.)
] as const;
```

## The Attachment Workflow

A distinctive pattern in the Lesson Plan Designer is the **dual output** for generated content:

```
┌─────────────────────────────────────────────────────┐
│  AI generates teaching script                       │
│                                                     │
│  Output 1: write_output → extraProperties           │
│    - Text synced to form for inline viewing         │
│    - User sees "Sync to Form" button                │
│                                                     │
│  Output 2: Write file + attach_file → attachments   │
│    - File saved and attached for download            │
│    - User sees "Add Attachment" button              │
└─────────────────────────────────────────────────────┘
```

The user sees two sync buttons in the chat:
1. **Sync to Form** -- writes the script text into `extraProperties` for inline viewing
2. **Add Attachment** -- adds the `.md` file to the lesson plan's attachments list

This dual-output pattern applies to all generated materials: teaching scripts, audio files, and PDF slides.

## Injecting Skills into CCAAS

Skills defined in `solution.json` are automatically injected when you run the setup script. You can also inject them manually:

```bash
#!/bin/bash
# inject-skills.sh

CCAAS_URL="http://localhost:3001"

# Inject Lesson Plan Designer Skill
curl -X POST "$CCAAS_URL/api/v1/skills" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lesson Plan Designer",
    "slug": "lesson-plan-designer",
    "description": "AI lesson planning assistant",
    "type": "prompt",
    "content": "'"$(cat skills/lesson-plan-designer/SKILL.md)"'",
    "triggers": [
      {"type": "keyword", "value": "备课", "priority": 10},
      {"type": "keyword", "value": "教学目标", "priority": 8},
      {"type": "keyword", "value": "全套材料", "priority": 10}
    ],
    "allowedTools": ["write_output", "Read", "Write", "Skill"]
  }'

# Inject Teaching Script Generator Skill
curl -X POST "$CCAAS_URL/api/v1/skills" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teaching Script Generator",
    "slug": "teaching-script-generator",
    "description": "Generate teaching scripts from lesson plans",
    "type": "prompt",
    "content": "'"$(cat skills/teaching-script-generator/SKILL.md)"'",
    "triggers": [
      {"type": "keyword", "value": "生成讲稿", "priority": 100},
      {"type": "keyword", "value": "生成教学脚本", "priority": 100}
    ],
    "allowedTools": ["write_output", "Read", "Write", "attach_file"]
  }'

echo "Skills injected successfully"
```

## Testing Skills

### Manual Testing

The best way to test a Skill is to use the chat interface:

1. Start the CCAAS backend: `npm run dev:backend`
2. Start the Solution backend: `cd solutions/lesson-plan-designer/backend && npm run start:dev`
3. Open the frontend and create a lesson plan with basic fields filled in
4. Send a message that matches a trigger: "帮我优化教学目标"
5. Verify that:
   - The correct Skill was activated (check the agent logs)
   - `read_context` was called first (the Agent did not ask for already-filled fields)
   - `write_output` was called with the correct field names
   - The frontend form updated with the generated values

### Common Testing Issues

| Symptom | Likely Cause |
|---------|-------------|
| Wrong Skill activated | Trigger priorities conflict; adjust priority numbers |
| Agent asks for info already in form | `read_context` not called; check the mandatory step in SKILL.md |
| write_output returns an error | Field name mismatch between Skill and MCP Server |
| Form does not update | Frontend is not handling the field name from output_update |
| Attachment button not appearing | `attach_file` not called after file generation |
| Audio/PPT never completes | Subagent pattern not working; check Task tool invocation |

## Checkpoint

Before moving to the next section, verify:

- [ ] `skills/lesson-plan-designer/SKILL.md` exists with mandatory `read_context`, theoretical framework, and output format sections
- [ ] `skills/teaching-script-generator/SKILL.md` exists with dual-output pattern (text + file)
- [ ] `skills/notebooklm/SKILL.md` exists with language matching and `attach_file` integration
- [ ] All Skills are registered in `solution.json` with appropriate triggers
- [ ] The field names in the Skill's output format match the `SYNC_FIELDS` in the MCP Server
- [ ] `allowedTools` includes `write_output` for content Skills and `attach_file` for file-generating Skills
- [ ] Skills that need to invoke other Skills reference them in their SKILL.md instructions

## Exercise: Add a Curriculum Standards Lookup Skill

Create a new Skill that helps teachers find relevant curriculum standards. When the user says "查找课程标准" or "curriculum standards", this Skill should:

1. Call `read_context` to get the current subject and grade level
2. Call `get_curriculum_standards` MCP tool with the subject and relevant keywords
3. Present matching standards to the user
4. Optionally call `write_output` with `field: "curriculumRequirements"` to sync selected standards to the form

<details>
<summary>Hints</summary>

- Use triggers like `"课程标准"`, `"curriculum"`, `"标准对齐"`
- The `get_curriculum_standards` tool takes `subject` and `keyword` parameters
- Parse the user's objectives to extract keywords for the search
- Allow the user to select which standards to apply before syncing

</details>

## Summary

In this section you learned:

- **Skill structure**: Role definition, theoretical framework, workflow, output format, and constraints
- **Context-aware Skills**: Using `read_context` to avoid redundant questions and provide targeted suggestions
- **Dual output pattern**: Syncing text to `extraProperties` for inline viewing and files via `attach_file` for downloads
- **Trigger types**: `keyword` for exact matching and `intent` for semantic matching, with priority-based routing
- **Skill-to-Skill invocation**: Skills call other Skills through the `Skill` tool (e.g., Lesson Plan Designer orchestrating NotebookLM for "全套材料")
- **The three-way contract**: Skills tell the AI what to do, the MCP Server validates with `SYNC_FIELDS`, and the frontend renders -- all must use the same field names
- **Subagent pattern**: Long-running operations (audio, PDF generation) use background subagents to keep the conversation unblocked

With the MCP Server and Skills in place, the AI Agent can now generate structured lesson plan data, teaching scripts, audio, and slides -- and sync everything to the frontend. In the next section, we will build the **Frontend** that receives these updates and renders them.

---

**Next:** [6.5 Frontend](05-frontend.md)
**Previous:** [6.3 MCP Server](03-mcp-server.md)
