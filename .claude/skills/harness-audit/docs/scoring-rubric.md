# Harness Audit Scoring Rubric

Each dimension is scored 0–5. Total score: 0–25.

## Dimension 1: Context Budget

How well does the project manage AI instruction files (CLAUDE.md, .cursorrules, etc.)?

| Score | Criteria |
|-------|----------|
| 0 | No instruction file exists |
| 1 | Instruction file exists but is unstructured or >300 lines |
| 2 | Under 200 lines, some organization (headers/sections) |
| 3 | Under 150 lines, uses progressive disclosure (some links to external docs) |
| 4 | Root <100 lines with TOC structure, links to package-specific docs, quick reference section. Sub-instruction files exist but some may be >100 lines or contain duplicated content |
| 5 | Root <100 lines, full progressive disclosure. ALL instruction files <100 lines. No content duplicated between files. Cross-doc dedup applied where docs overlap |

### What to Check

- `find . -name "CLAUDE.md" ... -exec wc -l` — ALL instruction files, not just root
- Flag any instruction file over 100 lines as optimization candidate
- Does root have a Quick Reference / cheat sheet section?
- Are detailed conventions in separate linked files?
- Do individual packages/modules have their own instruction docs?
- Is the build order / dev setup front and center?
- **Content quality** (for score 4+):
  - Is there content duplicating nearby docs (README, design docs)?
  - Are generic rules already present in root deleted from sub-files?
  - Do sub-files follow a consistent template structure?
- **Cross-doc dedup** (for score 5):
  - When two docs share >50% content, does one reference the other instead of repeating?
  - Do all markdown links in instruction files resolve to existing files?

## Dimension 2: Memory Architecture

How are lessons and patterns stored for cross-session persistence?

| Score | Criteria |
|-------|----------|
| 0 | No persistent memory mechanism |
| 1 | Memory exists but is a single large file (>200 lines) or chronological dump |
| 2 | Memory file under 200 lines but no topic splitting |
| 3 | Memory file under 100 lines with some topic files, but no consistent organization |
| 4 | Index file under 100 lines, topic files by subject, semantic (not chronological) organization |
| 5 | Compact index (<50 lines), well-maintained topic files, clear quick rules section, no stale content, regular pruning evidence |

### What to Check

- `wc -l MEMORY.md` — size relative to truncation limit (usually 200 lines)
- Are there separate topic files (e.g., `serverurl-pattern.md`)?
- Is organization semantic (by topic) or chronological (by date)?
- Is there evidence of pruning/cleanup (not just appending)?
- Do critical patterns have their own dedicated files?

## Dimension 3: Executable Constraints

Are lessons and rules enforced through automation, not just documentation?

| Score | Criteria |
|-------|----------|
| 0 | No automated enforcement beyond standard linting |
| 1 | Commitlint or basic pre-commit hooks |
| 2 | Commitlint + type checking in CI |
| 3 | Above + architecture tests or custom lint rules |
| 4 | Above + custom harness checks script (grep-based rules for project-specific patterns) |
| 5 | Custom harness checks in CI, architecture tests, known recurring errors all have automated checks, clear process for adding new checks when errors recur |

### What to Check

- Does CI have a dedicated harness/constraint check job?
- Is there a `scripts/harness-checks.sh` or equivalent?
- Are architecture boundaries enforced by tests?
- For each documented "don't do X" rule: is there an automated check?
- How easy is it to add a new check? (One grep line = frictionless)

## Dimension 4: Quality Visibility

Can the agent assess module-level risk before making changes?

| Score | Criteria |
|-------|----------|
| 0 | No quality signals visible to the agent |
| 1 | Test coverage exists but isn't summarized or agent-accessible |
| 2 | Some quality info in docs, but scattered or incomplete |
| 3 | Quality scorecard exists but covers only some modules or dimensions |
| 4 | Module-level scorecard covering tests, docs, types; most modules graded; linked from project instructions |
| 5 | Complete scorecard (tests, docs, API coverage, types) for all modules, clear grade definitions (A-D), update triggers documented, regularly maintained |

### What to Check

- Does `docs/QUALITY_SCORE.md` or equivalent exist?
- Does it cover all modules in the project?
- Are grades clearly defined (what does A vs D mean)?
- Is it referenced from the main instruction file?
- When was it last updated? (Check git log)
- Are there instructions for when to update it?

## Dimension 5: Maintenance Mechanism

Is there a process to keep documentation and harness artifacts healthy?

| Score | Criteria |
|-------|----------|
| 0 | No maintenance process; write-once documentation |
| 1 | Occasional manual review, no defined process |
| 2 | Checklist exists for doc review, but not regularly executed |
| 3 | Defined maintenance skill/process that checks link validity and file sizes |
| 4 | Maintenance process covers links, sizes, quality score freshness, and memory pruning |
| 5 | Automated checks (link validity, size limits) + defined review cadence + clear error→lesson→constraint pipeline + evidence of regular execution |

### What to Check

- Is there a doc-gardening skill or equivalent process?
- Does it check broken links in documentation?
- Does it verify memory file sizes?
- Does it validate quality score freshness?
- Is there evidence of past execution (git log of doc maintenance commits)?
- Is the error→lesson→constraint pipeline documented?

## Overall Score Interpretation

| Range | Level | Recommendation |
|-------|-------|----------------|
| 0–5 | Critical | Agent is flying blind. Focus on Context Budget and one quick Executable Constraint. |
| 6–10 | Basic | Foundation exists but major gaps. Address lowest-scoring dimension first. |
| 11–15 | Developing | Good base. Focus on turning documented lessons into automated constraints. |
| 16–20 | Strong | Well-harnessed. Focus on the flywheel: every new error → new constraint. |
| 21–25 | Excellent | Mature harness. Focus on maintenance and sharing practices across projects. |
