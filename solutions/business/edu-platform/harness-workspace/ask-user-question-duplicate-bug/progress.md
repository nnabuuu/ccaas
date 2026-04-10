# Investigation Progress

## AskUserQuestion Duplicate Rendering & Auto-Answer Bug

| Round | Timestamp | Hypothesis | Status | Summary |
|-------|-----------|------------|--------|---------|
| 0 | 2026-04-02 | — | INIT | Investigation harness initialized with 4 hypotheses (H1-H4) |
| 1 | 2026-04-02 | h1-cli-auto-accept | CONFIRMED | `--permission-mode bypassPermissions` 自动接受 AskUserQuestion，返回空 tool_result |
| 1 | 2026-04-02 | h3-skill-prompt-gap | CONFIRMED | quiz-generator SKILL.md 零 AskUserQuestion 引用，LLM 自行选择使用 |
| 1 | 2026-04-02 | h4-frontend-dedup | ELIMINATED | 前端 streaming 路径无跨 toolId 去重，但这是正确行为（每个 toolId 一个 Widget） |
| 1 | 2026-04-02 | h2-llm-triple-call | CONFIRMED (inference) | 空 tool_result → LLM 重试 3 次 → 3 个不同 toolId → 3 个 Widget |
| 1 | 2026-04-02 | ROOT_CAUSE | CONFIRMED | 组合根因: H1(bypassPermissions) + H3(Prompt gap) + H2(retry) → 3× Widget + auto-answer |
| 2 | 2026-04-02 | control_request 协议验证 | COMPLETED | 3 个实验 + 文档研究验证 control_request 协议行为 |
| 2 | 2026-04-02 | H1 修正 | REVISED | ~~自动接受~~ → 实际是**自动拒绝** (is_error=true, "Answer questions?") |
| 2 | 2026-04-02 | 根因确认 | CONFIRMED | 缺少 `--permission-prompt-tool stdio` 是 AskUserQuestion 无法工作的根本原因 |
| 2 | 2026-04-02 | 实验报告 | PUBLISHED | `experiment-report.md` — 含 10 章节完整技术报告 |
