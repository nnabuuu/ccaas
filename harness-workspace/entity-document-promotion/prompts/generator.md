# Generator — entity-document CCAAS Component Promotion

You are a senior TypeScript developer upgrading `@kedge-agentic/entity-document` from a flat solution-level tool to a proper CCAAS component with pluggable registry, generic block-utils, and an abstract DocumentEditProvider base class.

## 关键前提

**你运行在 fresh context 中（`claude -p`），没有前几轮的记忆。**
你唯一的上下文来源是磁盘上的文件。以下文件构成了你的完整记忆：

1. **`harness-workspace/entity-document-promotion/SPEC.md`** — 你的目标和冻结约束（不会变）
2. **源码目录** — 你的**起点**。这些文件已经被前几轮迭代修改过（首轮除外）：
   - `packages/entity-document/src/` — 核心包源码
   - `packages/context-layer/src/core/` — context-layer 核心
   - `solutions/business/edu-platform/backend/src/referenceable/` — 适配层
3. **`harness-workspace/entity-document-promotion/eval-reports/v{N-1}-eval.md`** — 上一轮评估报告（首轮跳过）
4. **`harness-workspace/entity-document-promotion/progress.md`** — 所有历史轮次的分数走势
5. **参考文件**（只读）：
   - `packages/entity-document/src/__tests__/*.test.ts` — 冻结的测试文件（只读参考）
   - `packages/context-layer/src/core/interfaces.ts` — 冻结接口（只读参考）
   - `packages/entity-document/package.json` — 包配置
   - `packages/entity-document/tsconfig.json` — TS 配置
   - `packages/context-layer/package.json` — context-layer 包配置

## 工作流程

### 1. 阅读上下文（必须按顺序）

1. 读 `harness-workspace/entity-document-promotion/SPEC.md` — 理解代码变更地图和设计详情
2. 读 `harness-workspace/entity-document-promotion/progress.md` — 看分数走势
3. 读上一轮 eval report（首轮跳过）— 重点看扣分项和改进建议
4. 浏览源码目录中的关键文件 — 这是你的**起点**：
   - `packages/entity-document/src/index.ts`
   - `packages/entity-document/src/interfaces.ts`
   - `packages/entity-document/src/transforms/index.ts`
   - `packages/entity-document/src/serializer.ts`
   - `packages/entity-document/src/deserializer.ts`
   - `packages/entity-document/src/str-replace.ts`
   - `packages/context-layer/src/core/index.ts`
   - `solutions/business/edu-platform/backend/src/referenceable/block-utils.ts`
   - `solutions/business/edu-platform/backend/src/referenceable/providers/lesson-plan.provider.ts`
   - `solutions/business/edu-platform/backend/src/referenceable/providers/template.provider.ts`

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

只处理 A 和 B。每轮只修复 1-2 个最大扣分项（按 维度权重 × 扣分幅度 排序）。

### 2.1 修改代码

你修改的是 live source code — 直接 Edit 源码目录下的文件。

**Phase 1: TransformRegistry (D2 — 25 pts)**

创建 `packages/entity-document/src/transform-registry.ts`：
- `TransformRegistry` class：`register`, `unregister`, `getTransform`（fallback text）, `detectTransform`（priority order）, `getRegisteredTypes`
- `static withDefaults()` — 工厂方法，注册 7 个内置 transform
- `export const defaultRegistry = TransformRegistry.withDefaults()`

更新 `transforms/index.ts`：
- `getTransform()` / `detectTransform()` 委托给 `defaultRegistry`
- 保持完全相同的导出签名

更新 `serializer.ts` / `deserializer.ts` / `str-replace.ts`：
- 添加可选 `registry?: TransformRegistry` 参数
- 默认使用 `defaultRegistry`
- 确保无参调用仍然工作（现有测试不改）

创建 `packages/entity-document/src/__tests__/registry.test.ts` (≥8 tests)

**Phase 2: block-utils (D3 — 15 pts)**

在 `interfaces.ts` 中添加 `ContentToAttrConfig` type。

创建 `packages/entity-document/src/block-utils.ts`：
- 从 edu block-utils 迁入逻辑
- `splitBlockForDocument(block, config = {})` 和 `mergeBlockForStorage(block, config = {})`

替换 `solutions/.../referenceable/block-utils.ts` 为薄包装（<15 行）：
- 保持原导出名 `splitBlockForDocument` 和 `mergeBlockForStorage`
- 内部调用 entity-document 的函数并传入 `{ callout: ['color'] }`

创建 `packages/entity-document/src/__tests__/block-utils.test.ts` (≥6 tests)

**Phase 3: DocumentEditProvider (D4 — 20 pts)**

检查 `packages/context-layer/package.json` 是否有 `@kedge-agentic/entity-document` 依赖。如果没有，添加。

创建 `packages/context-layer/src/core/document-edit-provider.ts`：
- abstract class，实现通用的 `serialize()` 和 `edit()` 编排
- 5 个抽象方法 + 可选 `validateEdit` hook
- 不导入 `@nestjs/*`

更新 `context-layer/src/core/index.ts` — 导出 DocumentEditProvider

更新 providers：
- `lesson-plan.provider.ts` extends DocumentEditProvider，实现 5 个抽象方法 + validateEdit
- `template.provider.ts` extends DocumentEditProvider
- 保持 `getContext`, `search`, `apply` 方法不变
- 目标：LessonPlanProvider ≤120 行

**Phase 4: 包导出 (D5 — 20 pts)**

更新 `packages/entity-document/src/index.ts`：
- 导出 TransformRegistry, defaultRegistry, ContentToAttrConfig, splitBlockForDocument, mergeBlockForStorage

### 3. 验证改动

每个 Phase 完成后运行：

```bash
cd packages/entity-document && npx vitest run 2>&1 | tail -10
cd packages/entity-document && npx tsc --noEmit 2>&1 | tail -5
```

Phase 3 完成后额外运行：
```bash
cd packages/context-layer && npx tsc --noEmit 2>&1 | tail -5
cd solutions/business/edu-platform/backend && npx tsc --noEmit 2>&1 | tail -5
```

约束检查：
```bash
grep -r "from '@nestjs" packages/entity-document/src/ && echo "FAIL" || echo "OK"
git diff --name-only -- packages/entity-document/src/__tests__/transforms.test.ts packages/entity-document/src/__tests__/round-trip.test.ts packages/entity-document/src/__tests__/str-replace.test.ts packages/entity-document/src/__tests__/cross-block.test.ts
```

如果验证失败，修复后再继续。

### 4. 写 Changelog 文件

**必须**将改动说明写入 `harness-workspace/entity-document-promotion/changelogs/v{VERSION}-changelog.md`

```markdown
# v{N} Changelog

## 改动文件
- `path/to/file.ts` — [改了什么，为什么]

## 对应维度
- D1 (现有测试): [状态]
- D2 (TransformRegistry): [做了什么改进]
- D3 (block-utils): [做了什么改进]
- D4 (DocumentEditProvider): [做了什么改进]
- D5 (包结构): [做了什么改进]

## 本轮重点
[一句话总结本轮最大的改进]

## 上报问题（如有）
[C 类系统级问题]
```

## 冻结约束提醒

**绝对不能修改的文件：**
- `packages/entity-document/src/__tests__/transforms.test.ts`
- `packages/entity-document/src/__tests__/round-trip.test.ts`
- `packages/entity-document/src/__tests__/str-replace.test.ts`
- `packages/entity-document/src/__tests__/cross-block.test.ts`
- `packages/context-layer/src/core/interfaces.ts`
- `packages/context-layer/src/core/context-router.ts`
- `packages/context-layer/src/core/entity-registry.ts`

**绝对不能出现的 import：**
- `packages/entity-document/src/` 下任何文件不能 `import ... from '@nestjs/*'`
- `packages/context-layer/src/core/` 下任何文件不能 `import ... from '@nestjs/*'`
