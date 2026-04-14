# v1 Changelog

## 改动文件

- `solutions/business/recipe-book/mcp-server/src/index.ts` — recipe_edit 工具定义补充 block_attr_set/block_content_set 到 enum，添加 block_index/attr 参数描述

## 已确认完好的文件（前轮已创建，本轮验证通过）

- `solutions/business/recipe-book/backend/src/__tests__/integration/test-helpers.ts` — 集成测试基础设施
- `solutions/business/recipe-book/backend/src/__tests__/integration/context-api.integration.test.ts` — D1 测试（6 用例）
- `solutions/business/recipe-book/backend/src/__tests__/integration/edit-operations.integration.test.ts` — D2 测试（4 用例）
- `solutions/business/recipe-book/backend/src/__tests__/integration/edge-cases.integration.test.ts` — D3 测试（7 用例）
- `solutions/business/recipe-book/backend/src/__tests__/integration/agent-workflow.integration.test.ts` — D4 测试（4 用例）
- `solutions/business/recipe-book/skills/recipe-assistant/SKILL.md` — 含 metrics+text+actions JSON 示例 + 编辑确认流程
- `solutions/business/recipe-book/skills/nutrition-calculator/SKILL.md` — 含 metrics+bar_list+actions JSON 示例 + color_thresholds
- `solutions/business/recipe-book/skills/menu-planner/SKILL.md` — 含 outline+metrics+actions JSON 示例 + skill_hint

## 对应维度

- D1 (20pts): 6 个集成测试覆盖 entity-types/browse/search/context/document/resolve，使用 createTestingModule
- D2 (20pts): 4 个集成测试覆盖 str_replace/field_set/block_attr_set/block_content_set，通过 HTTP POST
- D3 (20pts): 7 个边界测试覆盖 published 拒绝/不可编辑字段/ingredient category 保留/callout color 保留/连续编辑/空搜索/404
- D4 (20pts): 4 个 agent 工作流测试 + CCAAS live verification（由 harness 验证）
- D5 (20pts): MCP enum+skill_hint 已有; recipe_edit 补充完整 4-op enum; 3 SKILL.md 各含合法 JSON 示例; skill_hint ≥3 处

## 本轮重点

验证所有 49 测试通过、tsc clean，补充 MCP recipe_edit 工具定义缺失的 block_attr_set/block_content_set 枚举和参数。

## 测试结果

- 7 test files, 49 tests, all passed
- TypeScript compilation: clean (no errors)
- JSON validation: all 4 JSON blocks in SKILL.md files parse successfully
- No frozen constraint violations
