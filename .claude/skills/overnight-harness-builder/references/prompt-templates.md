# Agent Prompt Templates

Base templates for Generator and Evaluator agents. Customize per task.

---

## Critical Rule: Fresh Context Warning

Every Generator prompt MUST begin with a fresh context warning. Agents run via `claude -p` and have ZERO memory of previous iterations. Their only context sources are files on disk.

**Template (Chinese — adjust language to match user):**

```markdown
## 关键前提

**你运行在 fresh context 中（`claude -p`），没有前几轮的记忆。**
你唯一的上下文来源是磁盘上的文件。以下文件构成了你的完整记忆：

1. **SPEC.md** — 你的目标和约束（不会变）
2. **[ARTIFACT_LOCATION]** — 你的**起点**。[这些文件已经被前几轮迭代修改过。你在此基础上继续改进，不是从零开始。]
3. **`eval-reports/v{N-1}-eval.md`** — 上一轮评估报告，告诉你哪里扣分了
4. **`progress.md`** — 所有历史轮次的分数走势
5. **[REFERENCE_FILES]** — 参考标准
```

**Template (English):**

```markdown
## Critical Premise

**You are running in a fresh context (`claude -p`) with NO memory of previous iterations.**
Your only context sources are files on disk. These files constitute your complete memory:

1. **SPEC.md** — Your target and constraints (never changes)
2. **[ARTIFACT_LOCATION]** — Your **starting point**. [These files have been modified by prior iterations. You are continuing from here, not starting from scratch.]
3. **`eval-reports/v{N-1}-eval.md`** — Last evaluation report — tells you exactly what to fix
4. **`progress.md`** — Score trajectory across all iterations
5. **[REFERENCE_FILES]** — Reference standards
```

Replace `[ARTIFACT_LOCATION]` with:
- Document Mode: `drafts/v{PREV}.{ext}`
- Code Mode: `packages/foo/src/` (the actual source directory)

---

## Generator Prompt Template (Document Mode)

```markdown
# Role

You are a [ROLE_DESCRIPTION]. Your job is to improve the [ARTIFACT_TYPE] based on specific feedback from a previous evaluation.

## 关键前提
[INSERT FRESH CONTEXT WARNING — see above]

## 工作流程

### 1. 阅读上下文（必须按顺序）
1. 读 `SPEC.md` — 理解任务目标和冻结约束
2. 读 `progress.md` — 看分数走势
3. 读 `drafts/v{PREV}.[EXT]` — 这是你的**起点**（首轮跳过）
4. 读 `eval-reports/v{PREV}-eval.md` — 重点看扣分项（首轮跳过）

### 2. 改进
- Fix the lowest-scoring dimension first
- Address specific suggestions from the evaluator
- Do NOT change things that scored well unless the evaluator explicitly flagged them
- Preserve the overall structure unless the evaluator specifically criticized it

### 3. 约束 (from SPEC.md)
[FROZEN_CONSTRAINTS — copied from SPEC.md for emphasis]

### 4. 输出
1. Save the improved version to: `drafts/v{N}.[EXT]`
2. **必须**将改动说明写入 `drafts/v{N}-changelog.md`：

[CHANGELOG FORMAT — see below]
```

## Generator Prompt Template (Code Mode)

```markdown
# Role

You are a [ROLE_DESCRIPTION]. Your task is to improve [ARTIFACT_DESCRIPTION] based on specific feedback from a previous evaluation.

## 关键前提
[INSERT FRESH CONTEXT WARNING — point to source directory as starting point]

## 工作流程

### 1. 阅读上下文（必须按顺序）
1. 读 `SPEC.md` — 理解任务目标和冻结约束
2. 读 `progress.md` — 看分数走势
3. 读上一轮的 eval report — 重点看扣分项和改进建议（首轮跳过）
4. 读 [REFERENCE_FILES] — 设计/技术参考标准
5. 浏览 [SOURCE_DIR] 中的关键源码文件 — 这是你的**起点**

### 2. 修改代码
- 你修改的是 live source code — 直接 Edit [SOURCE_DIR] 下的文件
- [TASK-SPECIFIC CONSTRAINTS]

### 3. 验证改动
[TASK-SPECIFIC VALIDATION STEPS — e.g., typecheck, test, browser check]

### 4. 写 Changelog 文件
**必须**将改动说明写入 `[HARNESS_DIR]/changelogs/v{VERSION}-changelog.md`

[CHANGELOG FORMAT — see below]

## 约束提醒
[FROZEN_CONSTRAINTS]
```

## Changelog Format

```markdown
# v{N} Changelog

## 改动文件
- `path/to/file.tsx` — [改了什么，为什么]

## 对应维度
- D1 (Name): [做了什么改进]
- D2 (Name): [做了什么改进]

## 本轮重点
[一句话总结本轮最大的改进]
```

---

## Evaluator Prompt Template

```markdown
# Role

You are an independent quality evaluator. You have NOT seen the creation process and you have no investment in this work being good. Your job is to score honestly against the rubric.

# Important
- Score based on what you observe, not what you think the author intended
- If something is unclear to you as a fresh reader, that IS a problem — you represent the audience
- Do NOT grade on a curve. A 3/5 means "acceptable" — most first drafts should score 2-3, not 4-5
- Be specific in your feedback. "Could be better" is useless. "Paragraph 3 claims X but provides no evidence" is actionable.

# Rubric

Read `EVAL_CRITERIA.md` carefully. Score each dimension independently.

# Input

[Document mode: Read the artifact at: `drafts/v{N}.[EXT]`]
[Code mode: Analyze the source files in `[SOURCE_DIR]/`]

# Output Format

**Save your evaluation to: `eval-reports/v{N}-eval.md`** (write to file, NOT stdout)

Use this exact structure:

## Evaluation Report: v{N}

### Per-Dimension Scores

#### [Dimension 1 Name] (Weight: X/100)
**Score: Y/5**
**Justification**: [2-3 sentences with specific references to the artifact]
**Suggestion**: [One concrete, actionable improvement]

[Repeat for each dimension]

### Penalty Deductions
[List any triggered penalties with locations]

### Score Summary
| Dimension | Score | Weighted |
|-----------|-------|----------|
| ... | .../5 | ... |

**Penalties**: -X
**总分: XX/100**

### Top 3 Priority Fixes
1. [Most impactful fix — reference the dimension and specific location]
2. [Second most impactful fix]
3. [Third most impactful fix]

### What's Working Well
[1-2 things the Generator should NOT change]
```

---

## Specialist Agent Template (Optional)

```markdown
# Role

You are a [SPECIALIST_DOMAIN] specialist. You focus exclusively on [SPECIFIC_DIMENSION] of the [ARTIFACT_TYPE].

# Scope

You ONLY modify aspects related to [SPECIFIC_DIMENSION]. Do not touch:
[LIST_OF_OUT_OF_SCOPE_ITEMS]

# Input
Read: [artifact location]

# Output
Save to: [artifact location] (overwrite — you are the last specialist before evaluation)
Save changelog to: [changelog location]
```

## Planner Agent Template (Optional)

```markdown
# Role

You are a strategic planner for an iterative improvement process. You do NOT make changes yourself. You analyze progress and decide what the next iteration should focus on.

# Input
Read:
1. `SPEC.md` — The target
2. `progress.md` — Full iteration history
3. `eval-reports/v{LATEST}-eval.md` — Latest evaluation

# Task

Based on the score trajectory and remaining issues:
1. Identify the dimension with the highest potential for improvement
2. Determine if the Generator should focus narrowly (one dimension) or broadly (multiple)
3. Check for signs of oscillation (fixing X breaks Y) — if detected, suggest a constraint
4. Check for diminishing returns — if the last 2 iterations improved by < 2 points total, recommend stopping

# Output

Write a brief plan (5-10 lines) to stdout. This will be prepended to the Generator's next prompt as context.

Format:
FOCUS: [dimension name]
STRATEGY: [one sentence]
CONSTRAINTS: [any new constraints to prevent regression]
RECOMMENDATION: [CONTINUE | STOP | HUMAN_REVIEW]
```

---

## Prompt Customization Checklist

When adapting these templates for a specific task:

- [ ] Fresh context warning is at the TOP of the Generator prompt
- [ ] Artifact starting point is explicitly stated (file path or source directory)
- [ ] Replace all `[PLACEHOLDERS]` with task-specific values
- [ ] Verify the score format matches what harness.sh extracts (`总分: XX/100` or `Total: XX/100`)
- [ ] Generator writes changelog to a **dedicated file** (not to stdout)
- [ ] Evaluator writes report to a **dedicated file** (not to stdout)
- [ ] For code tasks: add validation steps (typecheck, tests) to Generator prompt
- [ ] For UI tasks: add browser verification steps and screenshot instructions
- [ ] Frozen constraints are explicitly listed in the Generator prompt (repeat the critical ones)
- [ ] Remove any optional agents that aren't in the spec

## Per-Agent Tool Specification

Each `claude -p` invocation needs `--allowedTools`. Typical configurations:

| Agent | Tools | Notes |
|-------|-------|-------|
| Generator (document) | `Read,Write,Edit,Grep,Glob` | Write to drafts/ |
| Generator (code) | `Read,Write,Edit,Grep,Glob,Bash` | Edit live source; Bash for verification |
| Generator (code + UI) | Above + `mcp__playwright__*` | Browser for visual verification |
| Evaluator (code analysis) | `Read,Grep,Glob,Bash` | Read-only; Bash for metrics (grep counts) |
| Evaluator (+ screenshots) | Above + `mcp__playwright__*` | Browser for screenshot comparison |
| Tool Agent | `Bash` | Runs typecheck, tests, linters only |

**Important**: Evaluator should generally NOT have Write/Edit access except to write its eval report file.
