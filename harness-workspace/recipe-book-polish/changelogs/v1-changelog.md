# v1 Changelog

## 改动文件

- `solutions/business/recipe-book/backend/package.json` — 添加 @nestjs/testing、@swc/core、unplugin-swc 三个 devDependencies
- `solutions/business/recipe-book/backend/vitest.config.ts` — 添加 SWC 插件，支持 NestJS 装饰器元数据
- `solutions/business/recipe-book/backend/src/referenceable/context-layer-local.module.ts` — 修复 editEntity 方法，支持全部 4 种编辑操作（str_replace、field_set、block_attr_set、block_content_set）
- `solutions/business/recipe-book/backend/src/__tests__/integration/test-helpers.ts` — 新建集成测试基础设施（内存 SQLite、种子数据、TestAppModule）
- `solutions/business/recipe-book/backend/src/__tests__/integration/context-api.integration.test.ts` — 新建 D1 测试（6 个用例：entity-types、browse、search、entity context、document、resolve）
- `solutions/business/recipe-book/backend/src/__tests__/integration/edit-operations.integration.test.ts` — 新建 D2 测试（4 个用例：str_replace、field_set、block_attr_set、block_content_set）
- `solutions/business/recipe-book/backend/src/__tests__/integration/edge-cases.integration.test.ts` — 新建 D3 测试（7 个用例：已发布拒绝、不可编辑字段、属性保留、连续编辑、空搜索、不存在 ID）
- `solutions/business/recipe-book/backend/src/__tests__/integration/agent-workflow.integration.test.ts` — 新建 D4 测试（4 个用例：完整 Agent 工作流、发布错误、空结果、404）
- `solutions/business/recipe-book/mcp-server/src/index.ts` — 更新 show_info_card（section type enum、badge）和 suggest_actions（prompt、primary、skill_hint）工具定义
- `solutions/business/recipe-book/skills/recipe-assistant/SKILL.md` — 添加工具调用序列和 JSON 示例
- `solutions/business/recipe-book/skills/nutrition-calculator/SKILL.md` — 添加工具调用序列和 JSON 示例
- `solutions/business/recipe-book/skills/menu-planner/SKILL.md` — 添加工具调用序列和 JSON 示例

## 对应维度

- D1 (Context API 集成): 新增 6 个测试覆盖 browse/search/resolve/document 端到端流程
- D2 (编辑操作集成): 新增 4 个测试验证全部 4 种编辑操作，修复本地控制器仅支持 2 种操作的 bug
- D3 (边界用例): 新增 7 个测试覆盖权限控制、属性保留、连续编辑一致性
- D4 (Agent 工作流): 新增 4 个测试模拟 Agent search→document→edit→verify 完整链路
- D5 (MCP/Skill 优化): 更新 show_info_card 和 suggest_actions 工具 schema，3 个 SKILL.md 添加 JSON 示例

## 本轮重点

搭建集成测试基础设施（内存 SQLite + SWC + TestAppModule），覆盖 21 个端到端用例，并修复 editEntity 仅处理 2/4 操作类型的 bug。
