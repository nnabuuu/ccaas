# Skill Writing Guide

## What is a Skill

A Skill is the core abstraction in KedgeAgentic that defines AI Agent behavior. Each Skill specifies the AI Agent's role, knowledge scope, available tools, and output format.

## When to Use This

A Skill defines what an agent does and how it behaves. Every CCAAS solution needs at least one Skill.

The question isn't whether to write a Skill — it's **which Skill type to use**:

- `type: prompt` covers 90% of cases. Give the agent a role, knowledge, and tool permissions; let it decide the steps.
- `type: workflow` when you need forced sequential execution — Step 1 must complete before Step 2 starts, with possible user confirmation or conditional branching between steps.
- `type: sub-agent` when a subtask needs a different model for cost or speed reasons, and the main agent dispatches to it via the Task tool.

If you're not sure which to use, start with `prompt`. Reach for `workflow` only when "the agent should decide the order" isn't good enough.

## Skill File Format

Skills are written as Markdown files (`SKILL.md`) containing YAML frontmatter and body content:

```markdown
---
name: "Lesson Plan Designer"
slug: "lesson-plan-designer"
description: "Helps teachers design lesson plans aligned with curriculum standards"
type: prompt
version: "1.0.0"
---

# Role Definition

You are an experienced instructional design expert...

# Knowledge Scope

## Curriculum Standards
...

## Teaching Theories
...

# Workflow

1. Understand teaching requirements
2. Search curriculum standards
3. Design learning objectives
4. Plan teaching activities
5. Generate a complete lesson plan

# Output Format

Use the write_output tool to output structured lesson plan data...
```

## Multi-File Skills

When a Skill needs to reference substantial supporting materials, examples, or configuration, you can split the content across multiple files instead of cramming everything into `SKILL.md`.

### Directory Structure

```
skills/
└── quiz-analyze-explain/
    ├── SKILL.md                    # Main file (required)
    └── references/                 # Additional files directory
        ├── geometry-formulas.md    # Reference material
        ├── scoring-rubric.md       # Scoring criteria
        └── examples/
            └── sample-analysis.md  # Sample analysis
```

`SKILL.md` is the entry point, defining the role, workflow, and metadata. Files under `references/` serve as supplementary knowledge that the Agent can read on demand.

### When to Use Multi-File Skills

| Scenario | Single file | Multi-file |
|----------|------------|------------|
| Skill content < 2000 tokens | ✅ | Not needed |
| Needs extensive reference material (formulas, standards, examples) | Not ideal | ✅ |
| Reference content needs independent version management | Not ideal | ✅ |
| Different Skills share reference material | Not ideal | ✅ |

**Rule of thumb:** If reference material pushes `SKILL.md` beyond ~2000 tokens, split it out. Keep the role definition and workflow in SKILL.md; put reference content in `references/`.

### Platform Behavior

- **Auto-discovery:** When importing a Skill, the platform scans all non-hidden files (excluding those starting with `.`) in the SKILL.md directory and stores them in the database
- **Session sync:** Each time a session is created, the platform syncs all Skill files (including `references/`) to the session workspace at `.claude/skills/{slug}/`
- **Version tracking:** Content hashes of additional files are tracked; only changed files are updated
- **Path safety:** The platform validates that all file paths stay within the Skill directory boundary, preventing path traversal

### Referencing Additional Files in SKILL.md

```markdown
# Workflow

## Step 2: Consult Reference Material

For geometry formulas, read the reference file:
Read(".claude/skills/quiz-analyze-explain/references/geometry-formulas.md")

When scoring, consult the rubric:
Read(".claude/skills/quiz-analyze-explain/references/scoring-rubric.md")
```

### Admin UI Management

In the Admin dashboard's Skill editing page, multi-file Skills are displayed as a file tree. Supported operations:
- Browse all files (SKILL.md + references/)
- Edit file content online
- Add, rename, or delete additional files
- Code highlighting and Markdown preview

## Skill Types

### `type: prompt` — Default (90% of cases)

Defines the agent's system prompt. The agent decides how to use its tools and in what order.

```yaml
---
type: prompt
---
```

**Choose this when:** You want a result-oriented agent. You care about what gets done, not the exact sequence of steps. Most lesson plan designers, quiz analyzers, and content generators fall here.

### `type: workflow` — Forced Sequential Execution

Defines a multi-step workflow where steps execute in a fixed order.

```yaml
---
type: workflow
---
```

**Choose this when:**
- Step 1 must complete before Step 2 can start (e.g., gather requirements → get user confirmation → generate content)
- There are conditional branches based on intermediate results
- A failed step needs to roll back previous work

Don't reach for `workflow` just because your agent has multiple steps — a `prompt` agent handles multi-step tasks fine on its own.

### `type: sub-agent` — Specialized Subtask with Dedicated Model

A sub-agent invoked by a parent agent via the Task tool, with its own model configuration.

```yaml
---
type: sub-agent
model: claude-3-5-sonnet
---
```

**Choose this when:** A specific subtask (e.g., rapid classification, image analysis) needs a different model for speed or cost. The main agent dispatches to the sub-agent and waits for the result.

## Writing Guidelines

### 1. Role Definition

Clearly establish the AI Agent's identity and core capabilities at the beginning:

```markdown
# Role Definition

You are a professional lesson plan design assistant with the following capabilities:
- Deep understanding of curriculum standards across subjects
- Mastery of multiple teaching theories and instructional design methods
- Ability to design lesson plans for different grade levels and subjects
```

### 2. Knowledge Structure

Provide the domain knowledge the AI Agent needs:

```markdown
# Knowledge Scope

## Instructional Design Theories
- Bloom's Taxonomy (Remember → Understand → Apply → Analyze → Evaluate → Create)
- ADDIE Model (Analyze → Design → Develop → Implement → Evaluate)
- UbD (Understanding by Design) Framework

## Subject Knowledge
Query via MCP tools:
- search_curriculum_standards: Look up curriculum standards
- search_textbook: Search textbook content
```

### 3. Workflow

Define clear execution steps:

```markdown
# Workflow

## Step 1: Requirements Analysis
- Confirm the subject, grade level, and topic
- Understand lesson duration and student proficiency

## Step 2: Standards Alignment
- Use the search_curriculum_standards tool to query standards
- Map learning objectives to curriculum standard requirements

## Step 3: Lesson Plan Design
- Design learning objectives (based on Bloom's Taxonomy)
- Plan teaching activities and time allocation
- Design assessment methods

## Step 4: Output the Lesson Plan
- Use the write_output tool to output structured data
```

### 4. Output Format

Explicitly specify the format for write\_output:

```markdown
# Output Format

Use the write_output tool to output the lesson plan in the following format:

{
  "title": "Topic name",
  "subject": "Subject",
  "gradeLevel": "Grade level",
  "duration": 45,
  "objectives": ["Learning objective 1", "Learning objective 2"],
  "activities": [
    {
      "title": "Activity name",
      "duration": 10,
      "type": "introduction",
      "description": "Activity description"
    }
  ]
}
```

## Trigger Configuration

Configure triggers in `solution.json`:

```json
{
  "triggers": [
    {
      "type": "keyword",
      "value": "lesson plan",
      "priority": 1
    },
    {
      "type": "pattern",
      "value": "(please )?(help me )?design.*lesson plan",
      "priority": 2
    },
    {
      "type": "intent",
      "value": "create_lesson_plan",
      "priority": 3
    }
  ]
}
```

**Priority rules**: Lower numbers indicate higher priority. When triggers from multiple Skills match simultaneously, the one with the highest priority is selected.

## Tool Permissions

List the tools available to a Skill in `allowedTools`:

```json
{
  "allowedTools": [
    "write_output",
    "search_curriculum_standards",
    "search_textbook",
    "search_teaching_resources"
  ]
}
```

{% hint style="warning" %}
Only grant a Skill the tools it actually needs. Follow the principle of least privilege.
{% endhint %}

## Best Practices

1. **Clear role definition** -- Establish the AI's identity and boundaries right from the start
2. **Explicit steps** -- Workflow steps should be clear and unambiguous
3. **Well-defined output** -- When using write\_output, clearly specify the meaning and format of each field
4. **Knowledge boundaries** -- Clearly distinguish between knowledge embedded in the Skill and knowledge that must be queried via tools
5. **Language consistency** -- If the target users speak a particular language, the Skill instructions should be written in that language
6. **Test and verify** -- After writing a Skill, run it in practice to validate the output format and behavior
