# Skill Writing Guide

## What is a Skill

A Skill is the core abstraction in LoopAI that defines AI Agent behavior. Each Skill specifies the AI Agent's role, knowledge scope, available tools, and output format.

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

## Skill Types

### Prompt Type (Most Common)

Directly defines the AI Agent's system prompt:

```yaml
---
type: prompt
---
```

Use case: Most Skills. Instructions are clear, and tool permissions are explicit.

### Workflow Type

Defines a multi-step workflow:

```yaml
---
type: workflow
---
```

Use case: Complex processes that require strict step-by-step execution.

### Sub-agent Type

A sub-agent that can be configured with independent model parameters:

```yaml
---
type: sub-agent
model: claude-3-5-sonnet
---
```

Use case: Specialized subtasks that require a dedicated model.

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
