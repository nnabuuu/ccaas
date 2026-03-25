# Harness Engineering: Why Your AI Coding Agent Keeps Making the Same Mistakes

## The Recurring Bug Problem

Our AI coding agent introduced the same bug three times.

The setup was simple: a frontend SDK needed a `serverUrl` parameter — an absolute URL like `http://localhost:3001` — to connect to the backend. Three separate times, the agent set it to an empty string. Each time, every API request hit the frontend port instead of the backend. Each time, everything returned 500.

The first time, we fixed it and moved on. The second time, we added a note to our project instructions file. The third time, it happened again — because the instructions file had grown to 264 lines, and the note was buried.

That third time, something clicked. **The agent wasn't broken. The environment was.**

## Errors Are Environmental, Not Intellectual

Here's an analogy that makes this concrete.

Two companies hire the same new employee on the same day. Company A gives a 30-minute verbal walkthrough. Company B has structured onboarding docs, automated access provisioning, and CI checks that catch common mistakes. Three months in, Company A's hire is still making errors that "everyone knows about." Company B's hire is shipping independently.

The difference isn't talent. It's the environment.

In AI-assisted coding, the same principle applies:

- A **prompt** is a verbal instruction. You can tell the agent "never use an empty string for serverUrl" in every conversation, but it forgets when the session ends.
- A **harness** is institutional knowledge. It's durable, enforceable, and doesn't depend on memory.

I call the practice of building and maintaining this environment **Harness Engineering** — the discipline of designing the operating environment for AI coding agents.

## The Harness Engineering Framework

Five dimensions. Each represents a different layer of environmental support for your agent. None of them involve writing better prompts. All of them involve building better infrastructure.

### 1. Progressive Disclosure: Context Is a Budget — Spend It Wisely

An agent's context window is finite and precious. Every line of instructions you load consumes tokens that could be used for reasoning about the actual task. Cramming every rule, convention, and architectural decision into a single file is like handing a new employee a 500-page manual on their first day — nothing sticks because everything competes for attention.

The solution is information architecture. Layer your instructions the same way you'd layer a well-designed API:

- **Layer 1 (project instructions)**: Structure, build commands, quick-reference rules. Under 100 lines.
- **Layer 2 (linked docs)**: Conventions, workflows, design principles. Loaded on demand.
- **Layer 3 (package-level docs)**: Per-package architecture and guidelines. Loaded only when modifying that package.

We cut our project instructions from 264 lines to 76. The key technique was replacing inline content with links to standalone docs. The agent reads 76 lines for most tasks; it follows links only when it needs depth. The context budget freed up by this reduction means the agent has more room to think about the actual problem rather than parsing irrelevant instructions.

### 2. Memory Architecture: Lessons Must Be Retrievable, Not Just Recorded

Most projects treat auto-memory as an append-only log. Over time it balloons to hundreds of lines, exceeds loading limits, and gets truncated — losing the oldest (often most critical) lessons.

Effective memory needs two mechanisms:

- **Index + topic files**: The memory index stays under 100 lines with cross-references. Detailed technical lessons live in separate topic files (`serverurl-pattern.md`, `architecture-boundaries.md`).
- **Semantic organization**: Organized by technical topic, not timeline. When the agent hits a serverUrl issue, it navigates directly to the relevant topic file instead of scanning a 500-line chronological dump.

We restructured 665 lines of memory into a 37-line index pointing to 5 topic files. Nothing was lost — it became more accessible. The serverUrl lesson that kept getting ignored? It now has its own file with root cause analysis, broken patterns, correct patterns, and a prevention checklist. When the agent encounters a serverUrl-related task, it loads exactly the context it needs.

### 3. Lessons → Constraints: If a Human Would Forget It, Automate It

This dimension has the highest ROI in the entire framework. The principle: transform recurring errors from "documented" to "enforced."

Consider the serverUrl problem. A document saying "don't use empty strings" is a suggestion. A CI check that greps for the pattern and fails the build is a constraint:

```bash
grep -rn "serverUrl:\s*['\"]['\"]" --include="*.ts" --include="*.tsx" solutions/ packages/ \
  | grep -v "\.test\." | grep -v "\.spec\."
```

When the agent introduces the bug, CI fails immediately with a clear error message. The agent reads the failure, understands the fix, and corrects itself — no human reminder needed.

Each new constraint costs roughly one line of grep. The return is permanent prevention. We started with two checks — the empty serverUrl pattern and missing API documentation annotations — running as a dedicated CI job in parallel with linting and tests. Adding the third check will take two minutes. The marginal cost of each new constraint approaches zero while the cumulative value keeps growing.

### 4. Quality Visibility: Agents Need Risk Signals, Not Just Instructions

When an agent is about to modify a module, it needs to know the module's health. A well-tested, well-documented module (Grade A) and an untested, undocumented module (Grade D) require fundamentally different levels of caution.

We created a quality scorecard that grades each module across four dimensions — tests, docs, API coverage, and types:

| Module | Tests | Docs | API | Types | Grade |
|--------|-------|------|-----|-------|-------|
| backend/auth | ✅ | ✅ | ✅ | ✅ | A |
| backend/scheduler | ❌ | ⚠️ | ✅ | ⚠️ | D |

When the agent sees a D-grade module, it automatically becomes more careful — reading existing code thoroughly, considering adding tests before making changes. Without this signal, the agent treats every module the same way, which means it's either too cautious everywhere (slow) or not cautious enough where it matters (buggy). Quality visibility lets it allocate its attention intelligently.

The maintenance cost is trivial — update one line in a markdown table whenever you improve a module's test coverage or documentation. But the decision-making value compounds across every task the agent performs on that module.

### 5. Continuous Gardening: Documentation Rots — Build the Immune System

All documentation has a shelf life. Links break, rules become outdated, scores drift from reality. Without a maintenance mechanism, the harness itself rots — which is worse than having no harness at all, because the agent makes decisions based on stale information.

We built a doc-gardening process that periodically checks:

- Whether file links in project docs are still valid
- Whether memory files exceed size limits
- Whether quality scores still reflect reality
- Whether architecture decision records reference deleted code

This isn't a one-time cleanup. It's a repeatable audit, like a linter for your documentation layer.

## The Flywheel

Here's why this compounds:

**Error → Lesson → Constraint → Prevention → Trust → More Autonomy → Higher Output → ...**

Each cycle makes the next one cheaper. The first harness check requires creating a script and configuring CI. The second requires adding one line of grep. The inventory of lessons grows richer, the operating environment becomes more robust, and the agent becomes more trustworthy.

This is the critical shift: every time the agent makes a mistake, the environment gets stronger. Errors aren't just fixed — they're permanently prevented. In traditional software development, bugs are defects to be eliminated. In Harness Engineering, bugs are raw material for building better constraints. A project with zero bugs has learned nothing; a project that has converted fifty bugs into fifty automated checks has an incredibly robust operating environment.

## A 10-Minute Diagnostic

Five questions. Score each 0–5. Total out of 25.

**1. Context Budget** — How large is your AI instruction file (CLAUDE.md or equivalent)?
- 0: No instructions, or 300+ lines of undifferentiated text
- 3: Under 150 lines, some structure
- 5: Under 100 lines, clear hierarchy with links to detailed docs

**2. Memory Architecture** — How are lessons and patterns stored?
- 0: No persistent memory, or a single bloated file
- 3: Memory exists but is a chronological append-only log
- 5: Indexed memory under 100 lines, topic files for details, regularly maintained

**3. Executable Constraints** — How many recurring bugs have become automated checks?
- 0: None
- 3: Some lint rules or type checks cover common issues
- 5: Custom CI checks that enforce project-specific lessons learned

**4. Quality Visibility** — Can the agent tell which modules are risky?
- 0: No quality signals available
- 3: Some test coverage info exists but isn't agent-accessible
- 5: Module-level quality scores, regularly updated, referenced in project docs

**5. Maintenance Mechanism** — Do your docs have a health check?
- 0: Write-once, never maintained
- 3: Manual review happens occasionally
- 5: Automated checks for link validity, size limits, and freshness

**Scoring**:
- **0–8**: Your agent is flying blind. Start with P0 items.
- **9–16**: Foundation exists but has gaps. Focus on the lowest-scoring dimension.
- **17–25**: Strong harness. Focus on the flywheel — turning each new lesson into a constraint.

## What This Means for AI-Assisted Development

The AI coding conversation has been dominated by "better prompts" — more detailed instructions, clever system messages, elaborate chain-of-thought techniques. These matter, but they're optimizing the wrong layer.

Prompts are ephemeral. They exist for one session and vanish. A harness persists across every session, every agent, every team member.

The shift is from **"How do I tell the agent what to do?"** to **"How do I build an environment where the agent naturally does the right thing?"**

This is Harness Engineering — and it's not just a set of techniques. It's an emerging engineering discipline, as fundamental to AI-assisted development as testing is to software engineering. We didn't always write tests either. Then we learned that the cost of not testing far exceeded the cost of testing.

The same inflection point is happening now with agent environments. Models will keep getting smarter — but smarter agents in poorly harnessed environments will still make the same avoidable mistakes. The constraint isn't intelligence; it's institutional memory.

The teams that figure this out first won't just have better agents — they'll have compounding advantages that grow with every mistake their agents make and never make again. The environment remembers so the agent doesn't have to.
