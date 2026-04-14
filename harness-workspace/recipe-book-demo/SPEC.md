# SPEC: Recipe Book Demo Solution

## Objective

从零构建 `solutions/business/recipe-book/` — 一个完整的 CCAAS 租户 solution，演示 `@kedge-agentic/entity-document` + `@kedge-agentic/context-layer` 的全部功能。

核心挑战：
1. 自定义 `ingredient` 块类型（TransformRegistry 扩展）
2. RecipeProvider 必须 override `edit()` 传入自定义 registry（否则 str_replace 后 ingredient 块 round-trip 失败）
3. 完整的 CCAAS 接入（solution.json, Skills, MCP Server, context-layer 本地控制器）

## Artifact Description

**Primary**: `solutions/business/recipe-book/` — 整个 solution 目录（从零创建）

## Frozen Constraints

| ID | Constraint | Files |
|----|-----------|-------|
| FC-1 | entity-document 源码不能修改 | `packages/entity-document/src/**` |
| FC-2 | context-layer 核心不能修改 | `packages/context-layer/src/core/**` |
| FC-3 | edu-platform 不能修改 | `solutions/business/edu-platform/**` |
| FC-4 | TypeORM + SQLite (better-sqlite3) | 数据库选型 |
| FC-5 | 自定义块类型用 `<!-- type:ingredient` 注释格式 | Markdown 格式约束 |
| FC-6 | RecipeProvider 必须 extends DocumentEditProvider | 继承约束 |
| FC-7 | 测试在 `src/__tests__/` 目录 | 目录结构约束 |
| FC-8 | ContentToAttrConfig 包含 callout 和 ingredient | block-utils 配置 |
| FC-9 | solution.json 遵循 schemaVersion 3.0 格式 | 配置格式 |
| FC-10 | Skills 目录结构：`skills/<slug>/SKILL.md` | 目录结构 |

## 完整文件结构

```
solutions/business/recipe-book/
  solution.json                       # CCAAS 租户配置
  README.md                           # Solution 概述
  skills/
    recipe-assistant/
      SKILL.md                        # 食谱助手
    nutrition-calculator/
      SKILL.md                        # 营养计算器
    menu-planner/
      SKILL.md                        # 菜单规划
  mcp-server/
    package.json
    tsconfig.json
    src/
      index.ts                        # 8 个 MCP 工具
  backend/
    package.json                      # NestJS + entity-document/context-layer file: links
    tsconfig.json
    nest-cli.json
    vitest.config.ts
    src/
      main.ts                         # bootstrap on :3002
      app.module.ts
      solution-register.service.ts    # CCAAS 注册
      typeorm/
        typeorm.module.ts             # TypeORM SQLite
      entities/
        recipe.entity.ts             # Recipe entity (JSON blocks column)
      recipe/
        recipe.module.ts
        recipe.service.ts             # CRUD
        recipe.controller.ts          # REST + @ApiTags
        dto/
          create-recipe.dto.ts
          update-recipe.dto.ts
      referenceable/
        block-utils.ts                # 薄包装 ≤15 行
        recipe-registry.ts            # TransformRegistry.withDefaults() + ingredientTransform
        constants.ts                  # CUISINE_MAP, DIFFICULTY_MAP
        referenceable.module.ts
        context-layer-local.module.ts # 本地控制器
        adapters/
          recipe-browse-provider.ts
          recipe-browse-provider-instance.ts
          recipe-cache-store.ts
          recipe-orm-adapter.ts
        providers/
          recipe.provider.ts          # extends DocumentEditProvider
      seed.ts                         # 3 道菜
      __tests__/
        ingredient-transform.test.ts  # ≥6 tests
        recipe-provider.test.ts       # ≥8 tests
        block-utils.test.ts           # ≥4 tests
```

## Design Details

### Recipe Entity

```typescript
@Entity('recipes')
export class Recipe {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() title: string;
  @Column() cuisine: string;        // '川菜' | '粤菜' | '西餐' | '家常'
  @Column() difficulty: string;     // 'easy' | 'medium' | 'hard'
  @Column({ default: 0 }) prep_time: number;
  @Column({ default: 0 }) cook_time: number;
  @Column({ default: 1 }) servings: number;
  @Column({ default: 'draft' }) status: string;  // 'draft' | 'published'
  @Column({ type: 'simple-json', nullable: true }) blocks: any[];
}
```

### 自定义 `ingredient` BlockTransform

**关键约束**：`shouldContinueChunk()` (deserializer.ts) 只处理 `<!-- type:timeline -->`，其他 HTML comment 不会与后续行合并为同一 chunk。因此 ingredient 块必须是**单行格式**。

**Markdown 格式**:
```
<!-- type:ingredient 鸡蛋 | 3个 | 常温 ; 面粉 | 200g | 低筋 -->
```

**数据结构**:
```typescript
{
  type: 'ingredient',
  content: { items: [{ name: '鸡蛋', amount: '3个', note: '常温' }, ...] },
  attributes: { category: '主料' }  // 由 block-utils 的 ContentToAttrConfig 提取
}
```

**BlockTransform 实现**:
```typescript
const ingredientTransform: BlockTransform = {
  type: 'ingredient',
  detect(lines: string[]): boolean {
    return lines.length === 1 && lines[0].startsWith('<!-- type:ingredient ');
  },
  serialize(content: Record<string, any>): string {
    const items = (content.items || [])
      .map((i: any) => [i.name, i.amount, i.note].filter(Boolean).join(' | '))
      .join(' ; ');
    return `<!-- type:ingredient ${items} -->`;
  },
  deserialize(lines: string[]): Record<string, any> | null {
    const line = lines[0];
    const match = line.match(/^<!-- type:ingredient (.+?) -->$/);
    if (!match) return null;
    const items = match[1].split(' ; ').map(part => {
      const [name, amount, note] = part.split(' | ').map(s => s.trim());
      return { name, amount: amount || '', note: note || '' };
    });
    return { items };
  },
};
```

**Registry 创建**:
```typescript
const recipeRegistry = TransformRegistry.withDefaults();
recipeRegistry.register('ingredient', ingredientTransform);
```

**`category` 字段处理**：在 DB 中存在 `content` 里，通过 `splitBlockForDocument` 移到 `attributes`，通过 `mergeBlockForStorage` 合并回去。

### RecipeProvider 设计挑战

**核心难点**：`DocumentEditProvider.edit()` 调用 `strReplace(currentDoc, op.old_string, op.new_string)` **不传 registry**。如果 recipe 用了 `recipeRegistry`（含 ingredient transform），str_replace 后 ingredient 块会被 defaultRegistry 解析为 text 块，round-trip 失败。

**正确做法**：RecipeProvider 必须 **override `edit()` 方法**，在调用 `strReplace` 时传入 `recipeRegistry`。或者至少 override 相关方法传入 registry。

这是本 harness 的**核心测试点**。

### block-utils 配置

```typescript
const RECIPE_CONFIG: ContentToAttrConfig = {
  callout: ['color'],
  ingredient: ['category'],
};
```

### CCAAS 接入层

**solution.json**:
```json
{
  "schemaVersion": "3.0",
  "tenant": { "name": "Recipe Book", "slug": "recipe-book", "description": "智能食谱管理平台" },
  "mcpServers": { "recipe-tools": { "command": "node", "args": ["mcp-server/dist/index.js"], "type": "stdio", "env": {} } },
  "sessionTemplates": { "cooking": { "description": "烹饪助手模式", "enabledSkills": ["recipe-assistant", "nutrition-calculator", "menu-planner"] } },
  "skills": [
    { "slug": "recipe-assistant", "name": "recipe-assistant" },
    { "slug": "nutrition-calculator", "name": "nutrition-calculator" },
    { "slug": "menu-planner", "name": "menu-planner" }
  ]
}
```

**context-layer-local.module.ts**:
- 参考 `edu-platform/backend/src/referenceable/context-layer-local.module.ts`
- 本地重新声明 Controller（避免 @nestjs/core 双版本冲突）
- 包含全部端点：entity-types, suggest, browse, search, resolve, activity, entity context, document, edit, shortcuts

**referenceable.module.ts**:
- 注册 `recipe` 实体类型（displayName: '食谱', icon: '🍳', abilities: browse+search+resolve+track）
- 注册 RecipeProvider 为 entity context provider
- 通过 `setServices()` 注入 RecipeService 到 RecipeBrowseProvider

**solution-register.service.ts**:
- OnApplicationBootstrap，读取 solution.json，POST 到 CCAAS core
- 解析 MCP server args 为绝对路径

### MCP Server 工具（8 个）

| 工具 | 用途 |
|------|------|
| `recipe_search` | 搜索食谱 |
| `recipe_get_document` | 获取食谱 entity-document 文本 |
| `recipe_edit` | 编辑食谱 |
| `nutrition_analyze` | 分析食谱营养 |
| `nutrition_compare` | 对比多个食谱营养 |
| `menu_suggest` | 推荐菜单组合 |
| `show_info_card` | 展示信息卡片 |
| `suggest_actions` | 后续操作按钮 |

### Seed Data

| 食谱 | 菜系 | 难度 | 状态 | Block 类型覆盖 |
|------|------|------|------|---------------|
| 鱼香肉丝 | 川菜 | medium | draft | 全部 8 种（section, text, ingredient×2, list, timeline, table, callout×2） |
| 番茄炒蛋 | 家常 | easy | draft | 5 种（section, text, ingredient, list, callout） |
| 提拉米苏 | 西餐 | hard | published | 7 种（section, text, ingredient×2, list, table, callout） |

### 关键参考文件

| 文件 | 用途 |
|------|------|
| `packages/entity-document/src/transform-registry.ts` | TransformRegistry API |
| `packages/entity-document/src/serializer.ts` | serialize / serializeWithRanges |
| `packages/entity-document/src/deserializer.ts` | deserialize / shouldContinueChunk 约束 |
| `packages/entity-document/src/str-replace.ts` | strReplace 算法 |
| `packages/entity-document/src/block-utils.ts` | splitBlockForDocument / mergeBlockForStorage |
| `packages/context-layer/src/core/document-edit-provider.ts` | DocumentEditProvider base class |
| `packages/context-layer/src/core/interfaces.ts` | EditOperation / EntityContextProvider |
| `solutions/business/edu-platform/solution.json` | solution.json 格式参考 |
| `solutions/business/edu-platform/backend/src/solution-register.service.ts` | CCAAS 注册参考 |
| `solutions/business/edu-platform/backend/src/referenceable/referenceable.module.ts` | Entity registry 参考 |
| `solutions/business/edu-platform/backend/src/referenceable/context-layer-local.module.ts` | 本地控制器参考 |
| `solutions/business/edu-platform/backend/src/referenceable/adapters/edu-browse-provider.ts` | Browse provider 参考 |
| `solutions/business/edu-platform/backend/src/referenceable/block-utils.ts` | block-utils 薄包装参考 |
| `solutions/business/edu-platform/backend/src/referenceable/providers/lesson-plan.provider.ts` | Provider 参考 |

## Exit Conditions

- **Target**: ≥90/100
- **Pass**: ≥70/100
- **Max iterations**: 8
- **Diminishing returns**: <3 point improvement for 2 consecutive iterations
