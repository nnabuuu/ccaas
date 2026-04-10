# Progress — AskUserQuestion Widget Harness

| Version | Timestamp | Score | D1 | D2 | D3 | D4 | D5 | D6 | D7 | Penalties | Top Issue |
|---------|-----------|-------|----|----|----|----|----|----|----|-----------|-----------|
| v1 | 2026-04-01 21:22 | 64 | 3 | 3 | 3 | 3 | 3 | 5 | - | 0 | AskUserQuestion 工具未被 AI Skill 触发，D1-D5 cap 3/5 |
| v2 | 2026-04-01 | pending | - | - | - | - | - | - | - | - | 添加 ?test=auq 测试框架解决浏览器验证; 修复 SubmittedView 多面板 + hasPreview 稳定性 |
| v2 | 2026-04-01 21:55 | 100 |  |  |  |  |  |  | - |  | **AskUserQuestion 工具仍未被 AI Skill 实际触发**: 浏览器验证通过 | |
| v3 | 2026-04-01 23:32 | pending | - | - | - | - | - | - | - | - | D7 persistence fix (includeToolEvents + contentBlocks reconstruction); hover CSS; **AI Skill 首次成功触发 AskUserQuestion**; 完整交互流程验证通过 |
| v3 | 2026-04-01 23:16 | 81 |  |  |  |  |  |  |  |  |  **Preview 模式无法在浏览器中验证** — 后端出题组卷 Skill 未� |
| v4 | 2026-04-01 23:50 | 85 |  |  |  |  |  |  |  |  |  **D7 持久化失败**: 刷新页面后 AskUserQuestion Widget 完全不渲染� |
| v5 | 2026-04-02 00:34 | 79 |  |  |  |  |  |  |  |  |  **[严重] tokens.css frozen 文件污染**: `packages/chat-interface/src/style |
| v6 | 2026-04-02 02:08 | pending | - | - | - | - | - | - | - | - | Reverted tokens.css (+10); Fixed widget collapsing via ALWAYS_VISIBLE_TOOLS text separators; Fixed D7 persistence (toolOutput string condition); Rebuilt chat-interface; All browser-verified | |
| v6 | 2026-04-02 01:27 | 98 |  |  |  |  |  |  |  |  | see eval-reports/v6-eval.md |
