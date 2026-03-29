---
name: task-harness-definer
description: "Help users define well-structured tasks for long-running AI agent harnesses. Interviews users through structured phases to extract acceptance criteria, optimization goals, eval rubrics, and agent role descriptions — producing a HARNESS_SPEC.md that the overnight-harness-builder skill consumes. Use when users want to set up autonomous overnight AI tasks, define eval criteria for iterative improvement, prepare acceptance conditions for agent loops, or convert vague improvement goals into measurable specs. Triggers include '定义验收条件', '优化目标', '搭harness', 'overnight task', 'eval criteria', 'agent loop setup', '自动优化', '迭代改进', 'define acceptance', or when users describe tasks like 'I want AI to keep improving X while I sleep'. Also use when users have a task but aren't sure if it's suitable for autonomous iteration."
---

# Task Harness Definer

Turn vague improvement goals into structured, measurable specs that autonomous agent loops can execute overnight.

## Core Principle

Most people know *what* they want improved but can't articulate *when it's good enough*. This skill bridges that gap through structured interviewing — acting as the "Inversion" pattern where the agent refuses to produce any output until it has gathered enough information to define a task that an autonomous loop can actually execute.

**DO NOT generate any HARNESS_SPEC.md or output artifacts until all interview phases are complete.** This is the critical gate. Premature output leads to poorly-defined tasks that waste compute and produce mediocre results.

## Workflow

### Phase 0: Task Qualification Gate

Before interviewing, determine whether the task is suitable for autonomous iteration. Not all tasks are.

**Suitable tasks have:**
- A measurable or semi-measurable quality dimension (score, pass/fail, coverage %)
- A stable target that won't shift during the run ("improve this article" ✅, "figure out what article to write" ❌)
- Diminishing returns from human attention (human did 80%, the last 20% is grindable)
- A clear "done" condition or iteration cap

**Unsuitable tasks:**
- Require creative direction changes mid-process (the *what* isn't settled yet)
- Have no evaluable output (pure exploration, brainstorming)
- Depend on external input not available to the agent (waiting on data, approvals)
- Risk compounding errors that are expensive to undo

**If the task is borderline**, explain why and let the user decide. Frame it as: "This task has X measurable dimension but Y requires judgment. You could run it overnight with a human review gate at iteration 3."

If unsuitable, suggest how to restructure the task into a suitable form. Many unsuitable tasks contain a suitable subtask.

---

### Phase 1: Task Understanding

Ask these questions. Wait for answers before proceeding.

1. **What is the artifact?** What concrete thing will the agent be working on?
   - A document (article, report, spec)?
   - Code (a module, test suite, configuration)?
   - Data (dataset cleanup, classification, organization)?
   - A structured knowledge base (memory, taxonomy, index)?

2. **What is the current state?** Does the artifact already exist, or is it being created from scratch?
   - If exists: where is it, what format, how far along?
   - If from scratch: what inputs/materials are available?

3. **Who is the audience / consumer?** Who will judge the final output? What do they care about?

4. **What does "done" look like in your head?** Don't worry about precision yet — describe the ideal outcome in your own words.

---

### Phase 2: Defining the Optimization Target

This is where most people get stuck. Help them decompose their vague goal into scorable dimensions.

**Technique: The "Complaints" Method**

Instead of asking "what's good?", ask:
- "What would you complain about if you saw the current version?"
- "What are the top 3 things that would make you say 'this isn't good enough'?"
- "If someone else did this task, what mistakes would annoy you most?"

Complaints are natural eval criteria inverted. Each complaint maps to a scoring dimension.

**Technique: The "Rubric Draft" Method**

Based on the complaints, propose 4-7 scoring dimensions. For each:

```
[Dimension Name] (weight: X/100)
- 5/5: [describe what excellence looks like]
- 3/5: [describe what acceptable looks like]
- 1/5: [describe what failure looks like]
- Detection method: [how an AI evaluator would assess this]
```

Present this draft rubric to the user. Iterate until they agree. The weights matter — they encode what the user actually cares about most.

**Common pitfalls to catch:**
- All dimensions weighted equally → push user to prioritize
- Dimensions that overlap significantly → merge them
- Dimensions that require human taste with no proxy → flag as "human review gate" items
- Missing negative criteria (things to penalize) → ask "what should the agent definitely NOT do?"

---

### Phase 3: Agent Architecture

Based on the task type and eval criteria, determine the agent roles needed.

**Default architecture: Generator + Evaluator**

This covers 80% of overnight tasks. The Generator improves the artifact; the Evaluator scores it against the rubric from Phase 2.

**When to add more agents:**

| Signal | Additional Agent | Role |
|--------|-----------------|------|
| Multiple distinct skill domains | **Specialist** | Handles one specific dimension (e.g., a "fact-checker" separate from a "style editor") |
| Risk of scope drift | **Planner** | Reviews progress.md at each iteration and decides what to focus on next |
| High cost of errors | **Guardrail** | Pre-screens Generator output before it becomes the new version |
| Output requires specific tools | **Tool Agent** | Runs linters, tests, scrapers, or other deterministic checks |

For each agent, define:
- **Role description**: One sentence on what it does
- **Perspective instruction**: How it should think (e.g., "You are a skeptical reviewer who has NOT seen the writing process")
- **Input**: What files/context it receives
- **Output**: What it produces and where it saves it
- **Isolation requirement**: Must it run in a separate context? (Almost always yes for Evaluator)

---

### Phase 4: Guardrails and Exit Conditions

Define when the loop should stop and what it should not do.

**Exit conditions** (at least one required):
- Score threshold: "Stop when total score ≥ X"
- Max iterations: "Run at most N iterations"
- Diminishing returns: "Stop if score improves by < Y points for 2 consecutive iterations"
- Time budget: "Run for at most T hours"

**Guardrails** (task-specific):
- What the agent must NOT change (e.g., "do not alter the core thesis")
- Format constraints (e.g., "output must remain valid Markdown")
- Size constraints (e.g., "article must stay between 3000-4000 characters")
- Content constraints (e.g., "no new technical jargon")
- Rollback condition: when should a version be discarded rather than iterated on?

---

### Phase 5: Generate HARNESS_SPEC.md

Only after all phases are complete, generate the spec. Use this exact structure:

```markdown
# Harness Specification

## Task
- **Artifact**: [what is being worked on]
- **Current state**: [starting point]
- **Target audience**: [who judges the output]
- **Goal**: [one-sentence optimization target]

## Frozen Constraints
[Things that must NOT change during the run]
- ...

## Eval Rubric

### Scoring Dimensions
| # | Dimension | Weight | Detection Method |
|---|-----------|--------|------------------|
| 1 | ... | /100 | ... |

### Dimension Details
#### [Dimension 1 Name]
- **5/5**: ...
- **3/5**: ...
- **1/5**: ...

### Penalty Rules
- [Specific penalizable patterns with point deductions]

### Threshold
- **Pass score**: X/100
- **Target score**: Y/100

## Agent Architecture
### Generator
- **Role**: ...
- **Perspective**: ...
- **Input**: ...
- **Output**: ...

### Evaluator
- **Role**: ...
- **Perspective**: ...
- **Input**: ...
- **Output**: ...
- **Isolation**: Separate context window (mandatory)

[Additional agents if needed]

## Exit Conditions
- ...

## Progress Tracking
- **Log file**: progress.md
- **Per-iteration record**: version number, timestamp, total score, per-dimension scores, key changes summary, evaluator's top unresolved issue

## Estimated Resource Usage
- **Iterations**: ~N expected
- **Tokens per iteration**: ~X (generator) + ~Y (evaluator)
- **Total estimated cost**: ~$Z
```

After generating, review the spec with the user. Confirm each section. Make adjustments.

---

## Language

Match the user's language throughout the interview. The HARNESS_SPEC.md should use the same language as the user, except for structural labels (Phase, Dimension, etc.) which stay in English for compatibility with the overnight-harness-builder skill.

## What This Skill Does NOT Do

- It does not build or run the harness — that's the overnight-harness-builder skill
- It does not write the agent prompts — it defines *what* the agents should do, not *how*
- It does not judge whether the user's quality standards are "right" — it helps make them explicit and measurable
- It does not replace domain expertise about the task content
