# v1 Changelog

## 创建文件

### Phase 1: NestJS 脚手架 + TypeORM + Recipe CRUD
- `backend/package.json` — 依赖配置（entity-document + context-layer file: links）
- `backend/tsconfig.json` — TS 配置含 paths mapping
- `backend/nest-cli.json` — NestJS CLI 配置
- `backend/vitest.config.ts` — 测试配置
- `backend/src/main.ts` — bootstrap on :3002
- `backend/src/app.module.ts` — 根模块
- `backend/src/typeorm/typeorm.module.ts` — TypeORM SQLite 配置
- `backend/src/entities/recipe.entity.ts` — Recipe entity（8 字段 + blocks JSON 列）
- `backend/src/recipe/recipe.module.ts` — RecipeModule
- `backend/src/recipe/recipe.service.ts` — CRUD 服务
- `backend/src/recipe/recipe.controller.ts` — REST 控制器 + @ApiTags
- `backend/src/recipe/dto/create-recipe.dto.ts` — 创建 DTO
- `backend/src/recipe/dto/update-recipe.dto.ts` — 更新 DTO

### Phase 2: ingredient transform + registry
- `backend/src/referenceable/recipe-registry.ts` — ingredientTransform + recipeRegistry
- `backend/src/referenceable/block-utils.ts` — 薄包装（13 行），config: callout+ingredient
- `backend/src/referenceable/constants.ts` — CUISINE_MAP, DIFFICULTY_MAP

### Phase 3: RecipeProvider
- `backend/src/referenceable/providers/recipe.provider.ts` — extends DocumentEditProvider，override serialize() + edit() 传入 recipeRegistry

### Phase 4: CCAAS 接入层
- `solution.json` — schemaVersion 3.0, tenant, mcpServers, sessionTemplates, skills
- `skills/recipe-assistant/SKILL.md` — 食谱助手 Skill
- `skills/nutrition-calculator/SKILL.md` — 营养计算器 Skill
- `skills/menu-planner/SKILL.md` — 菜单规划 Skill
- `mcp-server/package.json` — MCP server 依赖
- `mcp-server/tsconfig.json` — MCP TS 配置
- `mcp-server/src/index.ts` — 8 个 MCP 工具
- `backend/src/solution-register.service.ts` — CCAAS 注册服务
- `backend/src/referenceable/context-layer-local.module.ts` — 本地控制器（全部端点）
- `backend/src/referenceable/referenceable.module.ts` — Entity 注册 + Provider 绑定
- `backend/src/referenceable/adapters/recipe-browse-provider.ts` — Browse provider
- `backend/src/referenceable/adapters/recipe-browse-provider-instance.ts` — 单例实例
- `backend/src/referenceable/adapters/recipe-cache-store.ts` — 内存 CacheStore
- `backend/src/referenceable/adapters/recipe-orm-adapter.ts` — 最小 OrmAdapter

### Phase 5: Seed data + tests
- `backend/src/seed.ts` — 3 道菜（鱼香肉丝、番茄炒蛋、提拉米苏），覆盖所有块类型
- `backend/src/__tests__/ingredient-transform.test.ts` — 9 tests
- `backend/src/__tests__/recipe-provider.test.ts` — 10 tests
- `backend/src/__tests__/block-utils.test.ts` — 6 tests
- `README.md` — Solution 概述

## 对应维度
- D1 (TransformRegistry 自定义): ✅ ingredientTransform 实现 detect/serialize/deserialize，单行格式，注册到 recipeRegistry
- D2 (Surgical Diff): ✅ RecipeProvider.edit() override 传入 recipeRegistry 到 strReplace，ingredient 块 round-trip 正确
- D3 (Dual Edit Path): ✅ field_set + str_replace 双路径，validateEdit 拒绝 published 食谱
- D4 (CCAAS 租户接入): ✅ solution.json + 3 Skills + 8 MCP 工具 + context-layer-local 控制器 + solution-register
- D5 (Solution 完整性): ✅ 完整文件结构，25 tests 全部通过，tsc clean，冻结约束检查通过

## 本轮重点
从零构建完整 recipe-book solution，覆盖全部 5 个评估维度，25 个测试全部通过。
