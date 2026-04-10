---
name: task-harness-definer
description: "Help users define well-structured tasks for long-running AI agent harnesses. Two modes: (1) Iterative Improvement — interviews users to extract eval rubrics, optimization goals, and agent roles, producing a HARNESS_SPEC.md for overnight iteration loops. (2) Investigation/Diagnostic — interviews users to structure bug analysis or root cause investigation, producing a HARNESS_SPEC.md with hypotheses, evidence collection plans, and investigator agent architecture. Triggers include '定义验收条件', '优化目标', '搭harness', 'overnight task', 'eval criteria', 'agent loop setup', '自动优化', '迭代改进', 'define acceptance', '调查bug', '根因分析', 'root cause', 'investigate', 'debug', 'why does X happen', or when users describe tasks like 'I want AI to keep improving X while I sleep' or 'figure out why X is broken'. Also use when users have a task but aren't sure if it's suitable for autonomous iteration or investigation."
---

# Task Harness Definer

Turn vague goals into structured, measurable specs that autonomous agent loops can execute — either iterative improvement ("make X better") or systematic investigation ("find out why X is broken").

## Core Principle

Most people know *what* they want but can't articulate the structure needed for autonomous execution. For improvement tasks, they can't articulate *when it's good enough*. For investigation tasks, they can't articulate *which hypotheses to test and how*. This skill bridges that gap through structured interviewing.

**DO NOT generate any HARNESS_SPEC.md or output artifacts until all interview phases are complete.** This is the critical gate. Premature output leads to poorly-defined tasks that waste compute and produce mediocre results.

## Workflow

### Phase 0: Task Qualification & Routing Gate

Before interviewing, determine **which mode** the task needs, then whether it's suitable.

**Route A → Iterative Improvement** (Phases 1-5):
- Task is "make X better" / "optimize X" / "X should reach Y score"
- Has a measurable quality dimension (score, pass/fail, coverage %)
- A stable target that won't shift during the run
- Diminishing returns from human attention (human did 80%, the last 20% is grindable)
- A clear "done" condition or iteration cap

**Route B → Investigation/Diagnostic** (Phases 1D-4D):
- Task is "why does X happen?" / "X 的根因是什么?" / "investigate X bug"
- Has an observable symptom that can be described precisely
- Has a codebase or system that can be inspected for evidence
- Root cause is unknown but can be narrowed via hypothesis testing
- "Done" = root cause confirmed with evidence, not a score threshold

**Unsuitable for either mode:**
- Require creative direction changes mid-process (the *what* isn't settled yet)
- Have no evaluable output and no observable symptom (pure brainstorming)
- Depend on external input not available to the agent (waiting on data, approvals)

**If the task is borderline**, explain the routing choice and let the user confirm. Some tasks are hybrid: "investigate why X is slow, then iterate to make it fast" — in this case, recommend running Investigation first, then feeding the root-cause report into an Iterative Improvement harness.

If unsuitable for both modes, suggest how to restructure.

---

> **If Route A (Iterative Improvement):** proceed to Phase 1 below.
> **If Route B (Investigation/Diagnostic):** skip to Phase 1D.

---

## Route B: Investigation/Diagnostic Mode (Phases 1D-4D)

### Phase 1D: Symptom Description

Precisely describe the observable bug behavior. Ask:

1. **What is the symptom?** What does the user see/experience that's wrong?
   - Get the exact user-visible behavior, not an interpretation
   - "Widget shows 3 times" ✅, "Widget has a rendering bug" ❌

2. **What is the expected behavior?** What *should* happen instead?

3. **Is it reproducible?** What exact steps trigger it? Every time, or intermittent?

4. **What is the blast radius?** Does this affect one feature or many? One user or all?

5. **What has already been tried?** Any debugging already done? What was ruled out?

**Output:** A precise symptom statement that any developer could verify independently.

---

### Phase 2D: Hypothesis Generation

Based on the symptom and the code architecture, generate 3-5 ranked hypotheses.

**Technique: The "Call Chain" Method**

Trace the data/control flow from user action to bug manifestation:
1. Map the complete call chain (user → frontend → backend → service → response → render)
2. At each boundary crossing, ask: "Could the bug originate here?"
3. Each potential origin point becomes a hypothesis

**For each hypothesis, define:**

```
### H{N}: [Hypothesis Name] (Likelihood: high/medium/low)
- **Claim**: [What would need to be true for this to be the cause]
- **Verification method**: [Concrete steps to confirm or eliminate]
- **Expected evidence if TRUE**: [What you'd observe]
- **Expected evidence if FALSE**: [What you'd observe]
- **Files to inspect**: [Specific file paths]
```

**Ranking criteria:**
- How many observed symptoms does this hypothesis explain?
- Is this the simplest explanation (Occam's razor)?
- Is this at a boundary crossing (where bugs are most common)?

**Common pitfalls to catch:**
- All hypotheses at the same layer → push to consider different layers
- No hypothesis explains ALL symptoms → may be a combination
- Hypothesis requires "magic" (unexplained mechanism) → too vague, refine it

---

### Phase 3D: Evidence Collection Plan

For each hypothesis, define 1-2 executable verification steps.

**Good verification steps are:**
- **Deterministic**: The result either confirms or eliminates the hypothesis
- **Non-destructive**: Reading code, adding logs, inspecting events — not modifying behavior
- **Ordered by information value**: The step that eliminates the most hypotheses goes first

**For each step:**
```
### Verification Step V{N}.{M}
- **Target hypothesis**: H{N}
- **Action**: [Read file X lines Y-Z / Run command / Check SSE event stream / ...]
- **Look for**: [Specific pattern, value, or absence]
- **If found**: H{N} is CONFIRMED → stop investigating, document root cause
- **If not found**: H{N} is ELIMINATED → proceed to next hypothesis
- **If ambiguous**: [What additional step to take]
```

**Step ordering strategy:**
1. Start with the cheapest steps (file reads) before expensive ones (running services, capturing events)
2. Start with steps that can eliminate multiple hypotheses at once
3. If H1 has a quick file-read verification, do that before H2's runtime verification

---

### Phase 4D: Generate Investigation HARNESS_SPEC.md

Only after Phases 1D-3D are complete, generate the spec:

```markdown
# Investigation Harness Specification

## Symptom
[Precise, verifiable description of the bug]

## Expected Behavior
[What should happen instead]

## Reproduction Steps
[Exact steps to trigger the bug]

## Code Path
[Complete call chain from user action to bug manifestation]
```
[user action]
  → [layer 1]: [file/function]
    → [layer 2]: [file/function]
      → ... → [bug manifests here]
```

## Hypotheses (ranked by likelihood)

### H1: [Name] (Likelihood: high)
- **Claim**: ...
- **Verification method**: ...
- **Expected evidence if TRUE**: ...
- **Expected evidence if FALSE**: ...
- **Files to inspect**: ...

### H2: [Name] (Likelihood: high)
...

### H3: [Name] (Likelihood: medium)
...

## Evidence Collection Plan
[Ordered list of verification steps, referencing hypotheses]

## Agent Architecture

### Investigator
- **Role**: Systematically verify hypotheses by collecting code evidence
- **Perspective**: You are a debugger who tests hypotheses against evidence. You do NOT fix bugs — you find root causes.
- **Input**: SPEC.md (symptoms + hypotheses), source code files
- **Output**: `evidence/h{N}-{name}.md` per hypothesis + `root-cause-report.md`
- **Isolation**: Fresh context per round (mandatory)
- **Key constraint**: One hypothesis per round. Do not skip to fixing.

### Fix Verifier (optional, if fix is in scope)
- **Role**: Verify that a proposed fix resolves the original symptom
- **Perspective**: Skeptical tester who tries to reproduce the original bug after fix
- **Input**: Root cause report + fix patch
- **Output**: Pass/fail with evidence

## Exit Conditions
- **Root cause confirmed**: At least 1 hypothesis has CONFIRMED status with code evidence
- **Max rounds**: N (typically 3-5 for investigation tasks)
- **Dead end**: All hypotheses ELIMINATED → generate new hypotheses or escalate to human
- **Combination root cause**: Multiple hypotheses confirmed → document the interaction

## Modifiable Files
[Files the investigator may add debug logs to — clearly separated from source files]

## Frozen Files
[Files that must NOT be modified, even for debug logging]
```

After generating, review the spec with the user. Confirm each hypothesis makes sense.

---

## Route A: Iterative Improvement Mode (Phases 1-5)

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
