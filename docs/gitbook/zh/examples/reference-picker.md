# Context Layer @ Reference Picker

基于 Harness 驱动的 Context Layer 全栈模块实现 —— 从设计文档到可运行的 `@` 引用选择器，包含后端实体注册、推荐引擎和 React 前端组件。

## 问题

Context Layer 设计文档（v9）描述了一套完整的聊天界面 `@` 引用系统 —— 实体注册、活动追踪、智能推荐和多模式选择器 UI —— 但零代码存在。挑战在于实现一个跨包的复杂模块，且有严格的架构约束。

## 方案

使用 [Harness Engineering](../guide/harness-engineering.md) 模式从零开始迭代构建模块，以 Playwright E2E 测试作为主要质量信号。

### 架构

Context Layer 跨越 4 个包，有严格的 import 边界：

```
packages/
  context-layer/                    # @kedge-agentic/context-layer
    src/
      core/                         # 纯 TypeScript — 零 NestJS 依赖
        entity-registry.ts
        relation-inferrer.ts
        recommend-engine.ts
        context-injector.ts
      client/                       # ContextLayerClient SDK
      nestjs/                       # NestJS 薄壳
  context-layer-react/              # @kedge-agentic/context-layer-react
    src/
      AtPicker.tsx                  # @ picker 组件
      components/                   # RecentsSection, DrillDownView, SearchResults 等
      hooks/                        # useContextLayer, useSuggest, useBrowse, useSearch
```

### 评估维度

| # | 维度 | 权重 | 重点 |
|---|------|------|------|
| D1 | 场景通过率 | 35/100 | 13 个 Playwright E2E 测试 |
| D2 | 架构合规性 | 30/100 | Import 边界、分包结构、Decorator 模式 |
| D3 | TypeScript 正确性 | 15/100 | `tsc --noEmit` 零错误、接口与设计文档对齐 |
| D4 | 性能 SLA | 8/100 | Suggest < 50ms、搜索防抖、钻取 < 200ms |
| D5 | 前端交互质量 | 8/100 | Picker 弹出、面包屑导航、引用 Pill 展示 |
| D6 | 代码规范 | 4/100 | CCAAS 约定、无冗余、ESLint |

### 冻结约束

- `core/` 不得 import `@nestjs/*`（纯 TypeScript，零框架依赖）
- `ChatInterfaceComposer.tsx` 现有代码不可修改（picker 通过 overlay + context 实现）
- Mock solution 不得 import `solutions/business/edu-platform/`
- API 响应 schema 必须严格对齐设计文档 Section 7.1
- `@Referenceable` 和 `@Tracked` decorator 只做 SetMetadata，零运行时逻辑

## 结果

| 版本 | 分数 | 重点 |
|------|------|------|
| v1 | 56/100 | 初始实现：核心模块 + NestJS 封装 + 基础 React 组件 |
| v2 | 59/100 | 架构修复：import 边界违规、接口对齐 |
| v3 | 67/100 | 前端打磨：picker 交互、面包屑导航 |
| v4 | 69/100 | TypeScript 修复、mock solution 改进 |
| v5 | 69/100 | 进入平台期 — E2E 测试需要运行服务才能进一步提升 |

Harness 在 69/100 进入平台期。主要阻塞因素是 D1（场景通过率，35 分）—— 13 个 Playwright E2E 测试需要运行后端服务，而 Harness Agent 无法在评估循环中完全自动化这一过程。

## 核心交付物

### 后端 (`@kedge-agentic/context-layer`)

- **EntityRegistry**: 通过 `@Referenceable` decorator 注册实体类型
- **RecommendEngine**: 基于最近使用、频率和相关性的智能推荐
- **ContextInjector**: 自动将引用的实体注入 Agent 上下文
- **REST API**: 8 个端点（suggest、search、browse、drill-down、entity types 等）

### 前端 (`@kedge-agentic/context-layer-react`)

- **AtPicker**: 在聊天输入中由 `@` 触发的多模式选择器
- **RecentsSection**: 最近引用的实体
- **TypeBrowseSection**: 按实体类型浏览
- **DrillDownView**: 带面包屑的实体层级导航
- **SearchResults**: 带防抖的实时搜索
- **RefPill**: 聊天消息中的内联引用展示

### Chat Interface 集成

- 基于 Overlay 的 `@` 选择器，与现有 `ChatInterfaceComposer` 配合
- 通过 `useChatCore()` context 实现引用注入
- 不修改现有聊天核心代码

## 经验总结

1. **E2E 测试作为主要指标**: 将 E2E 权重设为 35% 强烈激励端到端功能的实现，但需要运行服务的基础设施难以自动化
2. **架构合规性权重很重要**: 30% 的 import 边界权重确保从一开始就保持干净的分层，避免了常见的"先跑通再重构"模式
3. **跨包任务更难**: 与单目录重设计不同，这个 Harness 需要协调 4 个包的变更 —— Generator 必须管理更复杂的依赖关系
4. **平台期信号设计问题**: 当分数停止提升时，通常指向 Harness 设置本身的结构性问题（本案例中是 E2E 测试基础设施）

## 相关文档

- [Context Layer 指南](../guide/context-layer.md) — Context Layer 完整开发指南
- [Context Layer API](../api/context-layer.md) — REST API 参考
- [交互式提示](../guide/interactive-prompting.md) — 上下文注入模式

## 工作空间

完整 Harness 工作空间: `harness-workspace/reference-picker-core-module/`
