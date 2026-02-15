# 6.4 Skills

## What You Will Build

In this section, you will write the Skill definitions for the Task Manager Solution. Skills are Markdown files that act as the AI Agent's instruction manual -- they define what the Agent knows, what tools it can use, and how it should respond to user requests.

By the end of this section, you will have:

- A **Task Creator** Skill for creating and editing individual tasks
- A **Bulk Import** Skill for importing multiple tasks at once
- Both Skills registered in `solution.json` with trigger configuration
- An understanding of how Skills, MCP tools, and sync fields connect

## What Is a Skill?

A Skill is a Markdown file (`SKILL.md`) that serves as the AI Agent's system prompt for a specific task. When a user sends a message, CCAAS matches it against Skill triggers and injects the matching Skill's content into the Agent's context.

```
User message: "Create a task to fix the login bug"
                │
                ▼
CCAAS Skill Router:
  - Matches trigger: "create task" → task-creator Skill
                │
                ▼
AI Agent receives:
  - System prompt: SKILL.md content
  - Available tools: write_output (from MCP Server)
  - User message: "Create a task to fix the login bug"
                │
                ▼
AI Agent calls write_output with field="taskTitle", value="Fix login bug"
```

## Skill File Structure

A Skill file has four main sections:

```markdown
# Skill Name

## Role Definition
Who the AI Agent is and what it does.

## Knowledge Scope
Domain knowledge and constraints.

## Workflow
Step-by-step process the Agent follows.

## Output Format
How to use write_output and what fields are available.
```

## Step 1: Write the Task Creator Skill

Create `skills/task-creator/SKILL.md`:

```markdown
# Task Creator

## Role Definition

You are a task management assistant that helps users create and manage tasks
through natural language conversation. You understand project context, can
extract task details from informal descriptions, and produce well-structured
task entries.

## Knowledge Scope

### Task Fields
- **taskTitle**: A concise, actionable title (verb + object pattern preferred)
- **taskDescription**: Detailed description of what needs to be done
- **priority**: low, medium, high, or urgent
- **status**: todo, in_progress, done, or cancelled
- **dueDate**: ISO date format (YYYY-MM-DD)
- **tags**: Array of categorization labels

### Priority Guidelines
- **urgent**: Blocking other work or has an immediate deadline
- **high**: Important and should be done soon
- **medium**: Normal priority, standard timeline
- **low**: Nice to have, can be deferred

### Good Task Titles
- Use imperative form: "Fix login bug" not "Login bug"
- Be specific: "Add email validation to signup form" not "Fix form"
- Keep under 80 characters

## Workflow

1. **Parse the request**: Extract task details from the user's message
   - Identify the task title (what needs to be done)
   - Look for priority indicators ("urgent", "ASAP", "when you get a chance")
   - Look for due dates ("by Friday", "next week", "March 15")
   - Identify tags or categories ("frontend", "backend", "bug")

2. **Fill in gaps**: For any missing fields, use reasonable defaults
   - Default priority: medium
   - Default status: todo
   - Default tags: infer from context if possible

3. **Sync to form**: Use write_output to send each field to the frontend
   - Call write_output once per field
   - Start with the title, then description, then other fields

4. **Confirm with user**: After syncing, briefly describe what you created
   and ask if the user wants to make any changes before saving.

## Output Format

Use the write_output tool to update task fields one at a time.
Each call should include the field name and its value.

Available fields and their types:
- field: "taskTitle" → string (task title, 1-200 characters)
- field: "taskDescription" → string (detailed description)
- field: "priority" → "low" | "medium" | "high" | "urgent"
- field: "status" → "todo" | "in_progress" | "done" | "cancelled"
- field: "dueDate" → ISO date string (e.g., "2026-03-15")
- field: "tags" → array of strings (e.g., ["frontend", "bug"])

### Example

User says: "Create a high priority task to fix the login page redirect,
due by next Friday, tag it as frontend and bug"

You should make these write_output calls:
1. write_output(field="taskTitle", value="Fix login page redirect")
2. write_output(field="taskDescription", value="The login page is not
   redirecting users correctly after successful authentication. Investigate
   the redirect logic and fix the routing issue.")
3. write_output(field="priority", value="high")
4. write_output(field="status", value="todo")
5. write_output(field="dueDate", value="2026-02-21")
6. write_output(field="tags", value=["frontend", "bug"])

## Constraints

- Always use write_output to sync data. Never just describe the task in text.
- Do not make up project IDs. If the user mentions a project, ask them to
  select it from the list.
- If the user's request is ambiguous, ask for clarification before creating
  the task.
- Keep descriptions professional and clear. Expand on the user's input but
  do not invent details that were not mentioned or implied.
```

### Key Design Decisions in This Skill

**1. Explicit field list in the Output Format section.** This ensures the AI Agent knows exactly which field names to use when calling `write_output`. These must match the `SYNC_FIELDS` in the MCP Server.

**2. Step-by-step workflow.** The Agent follows a predictable pattern: parse, fill defaults, sync, confirm. This makes the behavior consistent and debuggable.

**3. Constraints section.** Explicit boundaries prevent the Agent from doing unwanted things like making up data or skipping the form sync.

**4. Example interaction.** Concrete examples help the AI Agent understand the expected behavior pattern better than abstract descriptions.

## Step 2: Write the Bulk Import Skill

Create `skills/bulk-import/SKILL.md`:

```markdown
# Bulk Import

## Role Definition

You are a task import assistant that helps users create multiple tasks at once
from text input. You can parse plain text lists, numbered lists, CSV data,
and informal descriptions into structured task entries.

## Supported Input Formats

### Plain Text List
```
- Review API docs
- Fix login bug
- Update deployment script
```

### Numbered List
```
1. Review API docs (high priority)
2. Fix login bug (urgent)
3. Update deployment script
```

### CSV Format
```
title,priority,tags
Review API docs,high,backend
Fix login bug,urgent,frontend;bug
Update deployment script,medium,devops
```

### Informal Description
"I need to review the API docs, fix that login bug which is urgent,
and update the deployment script when I get a chance"

## Workflow

1. **Identify the format**: Determine which input format the user provided
2. **Parse all tasks**: Extract title, priority, tags, and due dates for
   each task
3. **Fill defaults**: Apply default values for missing fields
   - Default priority: medium
   - Default status: todo
4. **Sync to frontend**: Use write_output with field="tasks" and value as
   an array of task objects
5. **Report summary**: Tell the user how many tasks were parsed and list
   them briefly

## Output Format

For bulk import, use write_output with the special "tasks" field that
accepts an array:

```json
write_output(
  field="tasks",
  value=[
    {
      "taskTitle": "Review API docs",
      "priority": "high",
      "status": "todo",
      "tags": ["backend"]
    },
    {
      "taskTitle": "Fix login bug",
      "priority": "urgent",
      "status": "todo",
      "tags": ["frontend", "bug"]
    }
  ]
)
```

Each task object can include any of the sync fields:
- taskTitle (required)
- taskDescription
- priority
- status
- dueDate
- tags

## Constraints

- Every task must have at least a title
- If parsing fails for some entries, import the valid ones and report
  which entries could not be parsed
- Maximum 50 tasks per import
- Do not silently skip tasks. Always report the total parsed and any
  issues found
```

## Step 3: Register Skills in solution.json

Add both Skills to `solution.json`:

```json
{
  "skills": [
    {
      "name": "Task Creator",
      "slug": "task-creator",
      "description": "Create and manage tasks with AI assistance",
      "skillFile": "skills/task-creator/SKILL.md",
      "scope": "tenant",
      "triggers": [
        { "type": "keyword", "value": "create task", "priority": 10 },
        { "type": "keyword", "value": "add task", "priority": 10 },
        { "type": "keyword", "value": "new task", "priority": 9 },
        { "type": "keyword", "value": "task priority", "priority": 8 },
        { "type": "keyword", "value": "assign task", "priority": 8 }
      ],
      "allowedTools": ["write_output", "Read", "Write"]
    },
    {
      "name": "Bulk Import",
      "slug": "bulk-import",
      "description": "Import multiple tasks from text, CSV, or structured input",
      "skillFile": "skills/bulk-import/SKILL.md",
      "scope": "tenant",
      "triggers": [
        { "type": "keyword", "value": "bulk import", "priority": 10 },
        { "type": "keyword", "value": "import tasks", "priority": 10 },
        { "type": "keyword", "value": "batch create", "priority": 9 },
        { "type": "keyword", "value": "multiple tasks", "priority": 8 }
      ],
      "allowedTools": ["write_output", "Read", "Write"]
    }
  ]
}
```

### Trigger Configuration Explained

| Field | Description |
|-------|-------------|
| `type` | `keyword` matches exact words in the message |
| `value` | The keyword or pattern to match |
| `priority` | Higher number = higher priority when multiple Skills match |

**How triggers work:**

1. User sends: "Create a task to fix the login page"
2. CCAAS scans the message against all Skill triggers
3. "create task" matches the Task Creator Skill (priority 10)
4. CCAAS injects the Task Creator Skill into the AI Agent context

**When multiple Skills match:**

If the user says "create multiple tasks", both "create task" (Task Creator) and "multiple tasks" (Bulk Import) match. CCAAS selects the trigger with the highest priority. Since both are priority 10 and 8 respectively, the Task Creator would be selected. To ensure correct routing, consider adjusting trigger priorities or using more specific patterns.

### allowedTools

The `allowedTools` array restricts which MCP tools the Skill can use. This follows the principle of least privilege:

- `write_output` -- Required for syncing data to the frontend
- `Read` -- Allows reading files (built-in Claude Code tool)
- `Write` -- Allows writing files (built-in Claude Code tool)

Tools not listed here cannot be invoked when this Skill is active, even if the MCP Server provides them.

## How Skills, MCP Server, and Frontend Connect

Here is the complete picture of how the three components work together:

```
┌─────────────────────────────────────────────────────┐
│                    SKILL.md                         │
│                                                     │
│  "Use write_output with field='taskTitle'"          │
│  "Valid values for priority: low, medium, high"     │
│                                                     │
│  Tells the AI Agent WHAT to do                      │
└──────────────────────┬──────────────────────────────┘
                       │ AI Agent follows
                       │ these instructions
                       ▼
┌─────────────────────────────────────────────────────┐
│                  MCP Server                         │
│                                                     │
│  SYNC_FIELDS = ['taskTitle', 'priority', ...]       │
│  Validates: is 'taskTitle' a valid field? ✓         │
│  Validates: is 'critical' a valid priority? ✗       │
│                                                     │
│  Tells CCAAS WHETHER the data is valid              │
└──────────────────────┬──────────────────────────────┘
                       │ CCAAS wraps into
                       │ output_update event
                       ▼
┌─────────────────────────────────────────────────────┐
│                   Frontend                          │
│                                                     │
│  switch (field) {                                   │
│    case 'taskTitle': setTitle(value); break;         │
│    case 'priority': setPriority(value); break;       │
│  }                                                  │
│                                                     │
│  Tells the UI HOW to display the data               │
└─────────────────────────────────────────────────────┘
```

{% hint style="danger" %}
**The field names must be identical across all three.** If the Skill says `"title"`, the MCP Server validates `"taskTitle"`, and the frontend handles `"task_title"`, nothing will work. Use the `SYNC_FIELDS` constant as the single source of truth.
{% endhint %}

## Injecting Skills into CCAAS

Skills defined in `solution.json` are automatically injected when you run the setup script. You can also inject them manually:

```bash
#!/bin/bash
# inject-skills.sh

CCAAS_URL="http://localhost:3001"

# Inject Task Creator Skill
curl -X POST "$CCAAS_URL/api/v1/skills" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Task Creator",
    "slug": "task-creator",
    "description": "Create and manage tasks with AI assistance",
    "type": "prompt",
    "content": "'"$(cat skills/task-creator/SKILL.md)"'",
    "triggers": [
      {"type": "keyword", "value": "create task", "priority": 10},
      {"type": "keyword", "value": "add task", "priority": 10}
    ],
    "allowedTools": ["write_output", "Read", "Write"]
  }'

# Inject Bulk Import Skill
curl -X POST "$CCAAS_URL/api/v1/skills" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bulk Import",
    "slug": "bulk-import",
    "description": "Import multiple tasks from text or CSV",
    "type": "prompt",
    "content": "'"$(cat skills/bulk-import/SKILL.md)"'",
    "triggers": [
      {"type": "keyword", "value": "bulk import", "priority": 10},
      {"type": "keyword", "value": "import tasks", "priority": 10}
    ],
    "allowedTools": ["write_output", "Read", "Write"]
  }'

echo "Skills injected successfully"
```

## Testing Skills

### Manual Testing

The best way to test a Skill is to use the chat interface:

1. Start the CCAAS backend: `npm run dev:backend`
2. Start the Solution backend: `cd solutions/task-manager-tutorial/backend && npm run start:dev`
3. Open the frontend or use the admin console
4. Send a message that matches a trigger: "Create a task to review the API documentation"
5. Verify that:
   - The correct Skill was activated (check the agent logs)
   - `write_output` was called with the correct field names
   - The frontend form updated with the generated values

### Common Testing Issues

| Symptom | Likely Cause |
|---------|-------------|
| Wrong Skill activated | Trigger priorities conflict; adjust priority numbers |
| AI Agent does not call write_output | Output Format section is unclear; add more examples |
| write_output returns an error | Field name mismatch between Skill and MCP Server |
| Form does not update | Frontend is not handling the field name from output_update |

## Checkpoint

Before moving to the next section, verify:

- [ ] `skills/task-creator/SKILL.md` exists with Role, Workflow, and Output Format sections
- [ ] `skills/bulk-import/SKILL.md` exists with support for multiple input formats
- [ ] Both Skills are registered in `solution.json` with appropriate triggers
- [ ] The field names in the Skill's Output Format match the `SYNC_FIELDS` in the MCP Server
- [ ] `allowedTools` includes `write_output` for both Skills

## Exercise: Add a Status Update Skill

Create a third Skill that handles task status updates. When the user says "mark task as done" or "move task to in progress", this Skill should:

1. Ask which task to update (if not clear from context)
2. Call `write_output` with `field: "status"` and the new status value
3. Confirm the change with the user

<details>
<summary>Hints</summary>

- Use triggers like `"mark as"`, `"change status"`, `"move to"`
- The Skill should understand informal status descriptions: "done" = "done", "working on it" = "in_progress", "not started" = "todo"
- Consider edge cases: what if the user says "complete the login task" -- does "complete" mean status or does it mean "finish building"?

</details>

## Summary

In this section you learned:

- **Skill structure**: Role, Knowledge, Workflow, and Output Format sections
- **Writing effective Skills**: Be explicit about field names, provide examples, set constraints
- **Trigger configuration**: Keywords with priorities determine which Skill handles a message
- **The three-way contract**: Skills tell the AI what to do, the MCP Server validates the data, and the frontend renders it -- all must use the same field names
- **Skill injection**: How Skills get registered with CCAAS via `solution.json` or the REST API

With the MCP Server and Skills in place, the AI Agent can now generate structured task data and sync it to the frontend. In the next section, we will build the **Frontend** that receives these updates and renders them in a form.

---

**Next:** [6.5 Frontend](05-frontend.md)
**Previous:** [6.3 MCP Server](03-mcp-server.md)
