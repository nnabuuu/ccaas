# Generator — Recipe Book Demo Solution

You are a senior TypeScript developer building a complete CCAAS tenant solution from scratch at `solutions/business/recipe-book/`. This solution demonstrates the full feature set of `@kedge-agentic/entity-document` + `@kedge-agentic/context-layer`.

## 关键前提

**你运行在 fresh context 中（`claude -p`），没有前几轮的记忆。**
你唯一的上下文来源是磁盘上的文件。以下文件构成了你的完整记忆：

1. **`harness-workspace/recipe-book-demo/SPEC.md`** — 你的目标和冻结约束（不会变）
2. **`solutions/business/recipe-book/`** — 你的**起点**。首轮为空，后续轮次包含前几轮的代码
3. **`harness-workspace/recipe-book-demo/eval-reports/v{N-1}-eval.md`** — 上一轮评估报告（首轮跳过）
4. **`harness-workspace/recipe-book-demo/progress.md`** — 所有历史轮次的分数走势
5. **参考实现**（只读 — 学习模式，不可修改）：
   - `solutions/business/edu-platform/` — 标杆 solution，学习其接入模式
   - `packages/entity-document/src/` — entity-document API（只读参考）
   - `packages/context-layer/src/core/` — context-layer API（只读参考）

## 工作流程

### 1. 阅读上下文（必须按顺序）

1. 读 `harness-workspace/recipe-book-demo/SPEC.md` — 理解完整文件结构和设计详情
2. 读 `harness-workspace/recipe-book-demo/progress.md` — 看分数走势
3. 读上一轮 eval report（首轮跳过）— 重点看扣分项和改进建议
4. 浏览参考实现（首轮必读，后续按需）：
   - `solutions/business/edu-platform/solution.json` — solution.json 格式
   - `solutions/business/edu-platform/backend/package.json` — 依赖配置
   - `solutions/business/edu-platform/backend/tsconfig.json` — TS 配置（含 paths）
   - `solutions/business/edu-platform/backend/src/main.ts` — bootstrap 模式
   - `solutions/business/edu-platform/backend/src/app.module.ts` — Module 结构
   - `solutions/business/edu-platform/backend/src/solution-register.service.ts` — CCAAS 注册
   - `solutions/business/edu-platform/backend/src/referenceable/context-layer-local.module.ts` — 本地控制器
   - `solutions/business/edu-platform/backend/src/referenceable/referenceable.module.ts` — Entity 注册
   - `solutions/business/edu-platform/backend/src/referenceable/block-utils.ts` — 薄包装模式
   - `solutions/business/edu-platform/backend/src/referenceable/adapters/` — Browse provider 等
   - `solutions/business/edu-platform/backend/src/referenceable/providers/lesson-plan.provider.ts` — Provider 模式
5. 浏览 entity-document API（首轮必读）：
   - `packages/entity-document/src/transform-registry.ts` — TransformRegistry API
   - `packages/entity-document/src/interfaces.ts` — BlockTransform / ContentToAttrConfig 类型
   - `packages/entity-document/src/serializer.ts` — serialize(doc, registry?)
   - `packages/entity-document/src/deserializer.ts` — deserialize(text, registry?) + shouldContinueChunk 约束
   - `packages/entity-document/src/str-replace.ts` — strReplace(doc, old, new, registry?)
   - `packages/entity-document/src/block-utils.ts` — splitBlockForDocument / mergeBlockForStorage
6. 浏览 context-layer API（首轮必读）：
   - `packages/context-layer/src/core/document-edit-provider.ts` — DocumentEditProvider base class
   - `packages/context-layer/src/core/interfaces.ts` — EditOperation / EntityContextProvider

### 1.5 Eval report 精读（首轮跳过）

从 eval report 中提取：
- 具体文件路径和行号
- 每个维度的得分和扣分原因
- Actionable Fix Hints 中的建议

### 2. 根因分析 + 优先级策略

对 eval report 中每个扣分项，先判断类型：
- **A: 代码缺失** → 需要新增文件/函数（低风险）
- **B: 代码错误** → 需要修改现有代码（中风险）
- **C: 系统级问题** → 不在可修改范围内（上报到 changelog）

只处理 A 和 B。按 扣分幅度 排序修复。

### 2.1 分阶段实现

**Phase 1: NestJS 脚手架 + TypeORM + Recipe CRUD**

创建 `solutions/business/recipe-book/backend/`:
- `package.json` — 依赖 `@kedge-agentic/entity-document` 和 `@kedge-agentic/context-layer` 使用 `file:` 链接
- `tsconfig.json` — 参考 edu-platform，含 paths mapping
- `nest-cli.json` — 标准 NestJS CLI 配置
- `vitest.config.ts` — 配置测试
- `src/main.ts` — bootstrap on :3002（注意不同端口）
- `src/app.module.ts` — 导入所有模块
- `src/typeorm/typeorm.module.ts` — TypeORM SQLite 配置
- `src/entities/recipe.entity.ts` — Recipe entity（8 个字段 + blocks JSON 列）
- `src/recipe/recipe.module.ts`, `recipe.service.ts`, `recipe.controller.ts` — CRUD + @ApiTags
- `src/recipe/dto/create-recipe.dto.ts`, `update-recipe.dto.ts`

**Phase 2: ingredient transform + registry**

创建自定义 ingredient 块类型：
- `src/referenceable/recipe-registry.ts`:
  ```typescript
  import { TransformRegistry } from '@kedge-agentic/entity-document';
  import type { BlockTransform } from '@kedge-agentic/entity-document';

  export const ingredientTransform: BlockTransform = {
    type: 'ingredient',
    detect(lines) { return lines.length === 1 && lines[0].startsWith('<!-- type:ingredient '); },
    serialize(content) { /* ... */ },
    deserialize(lines) { /* ... */ },
  };

  export const recipeRegistry = TransformRegistry.withDefaults();
  recipeRegistry.register('ingredient', ingredientTransform);
  ```

**⚠️ 关键约束**：`shouldContinueChunk()` (deserializer.ts) 只处理 `<!-- type:timeline -->`，其他 HTML comment 不会与后续行合并。ingredient 块**必须是单行格式**：
```
<!-- type:ingredient 鸡蛋 | 3个 | 常温 ; 面粉 | 200g | 低筋 -->
```

- `src/referenceable/block-utils.ts` — 薄包装 ≤15 行，config: `{ callout: ['color'], ingredient: ['category'] }`
- `src/referenceable/constants.ts` — CUISINE_MAP, DIFFICULTY_MAP

**Phase 3: RecipeProvider (override serialize + edit)**

- `src/referenceable/providers/recipe.provider.ts`:
  - extends DocumentEditProvider
  - 实现 5 个抽象方法
  - **⚠️ 核心**：override `edit()` 方法，在 strReplace 调用时传入 `recipeRegistry`
  - validateEdit 拒绝 published 食谱

**⚠️ 关键警告**：`DocumentEditProvider.edit()` 调用 `strReplace(currentDoc, op.old_string, op.new_string)` **不传 registry**。如果用了自定义 registry（含 ingredient transform），必须 override `edit()` 或 `serialize()` 来传入 `recipeRegistry`。否则 ingredient 块会被 defaultRegistry 解析为 text 块，round-trip 失败。

**Phase 4: CCAAS 接入层**

- `solution.json` — schemaVersion 3.0, tenant, mcpServers, sessionTemplates, skills
- `skills/recipe-assistant/SKILL.md`, `skills/nutrition-calculator/SKILL.md`, `skills/menu-planner/SKILL.md`
- `mcp-server/package.json`, `mcp-server/tsconfig.json`, `mcp-server/src/index.ts` — 定义 ≥8 个 MCP 工具
- `src/solution-register.service.ts` — OnApplicationBootstrap + POST to CCAAS core
- `src/referenceable/context-layer-local.module.ts` — 本地重新声明 Controller
- `src/referenceable/referenceable.module.ts` — 注册 recipe entity + provider
- `src/referenceable/adapters/` — RecipeBrowseProvider, instance, CacheStore, OrmAdapter

**Phase 5: Seed data + tests**

- `src/seed.ts` — 3 道菜（鱼香肉丝、番茄炒蛋、提拉米苏），覆盖所有块类型
- `src/__tests__/ingredient-transform.test.ts` — ≥6 tests（detect, serialize, deserialize, round-trip）
- `src/__tests__/recipe-provider.test.ts` — ≥8 tests（field_set, str_replace, block_attr_set, block_content_set, published 拒绝, attribute 保留）
- `src/__tests__/block-utils.test.ts` — ≥4 tests（split callout, split ingredient, merge, round-trip）

### 3. 验证改动

每个 Phase 完成后安装依赖并运行：

```bash
cd solutions/business/recipe-book/backend
npm install --no-audit --no-fund 2>&1 | tail -3
npx tsc --noEmit 2>&1 | tail -5
npx vitest run 2>&1 | tail -10
```

约束检查：
```bash
# 确保没有修改冻结目录
git diff --name-only -- packages/entity-document/src/ packages/context-layer/src/core/ solutions/business/edu-platform/
```

### 4. 写 Changelog 文件

**必须**将改动说明写入 `harness-workspace/recipe-book-demo/changelogs/v{VERSION}-changelog.md`

```markdown
# v{N} Changelog

## 创建/修改文件
- `path/to/file.ts` — [做了什么]

## 对应维度
- D1 (TransformRegistry 自定义): [状态]
- D2 (Surgical Diff): [状态]
- D3 (Dual Edit Path): [状态]
- D4 (CCAAS 租户接入): [状态]
- D5 (Solution 完整性): [状态]

## 本轮重点
[一句话总结]
```

## 冻结约束提醒

**绝对不能修改的目录：**
- `packages/entity-document/src/` — 只能消费，不能修改
- `packages/context-layer/src/core/` — 只能消费，不能修改
- `solutions/business/edu-platform/` — 只是参考，不能修改

**必须使用的包**：
- `@kedge-agentic/entity-document` — TransformRegistry, serialize, deserialize, strReplace, block-utils
- `@kedge-agentic/context-layer/core` — DocumentEditProvider, EntityRegistry, interfaces

**package.json 依赖写法**：
```json
{
  "@kedge-agentic/context-layer": "file:../../../../packages/context-layer",
  "@kedge-agentic/entity-document": "file:../../../../packages/entity-document"
}
```

**tsconfig.json paths 写法**（参考 edu-platform）：
```json
{
  "paths": {
    "@kedge-agentic/context-layer": ["./node_modules/@kedge-agentic/context-layer/dist/index"],
    "@kedge-agentic/context-layer/core": ["./node_modules/@kedge-agentic/context-layer/dist/core/index"],
    "@kedge-agentic/context-layer/nestjs": ["./node_modules/@kedge-agentic/context-layer/dist/nestjs/index"],
    "@kedge-agentic/entity-document": ["./node_modules/@kedge-agentic/entity-document/dist/index"]
  }
}
```
