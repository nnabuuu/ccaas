# Jijian Context Layer — `@kedge-agentic/context-layer`

## Solution builder 的最小接入

```typescript
// 1. import module
ContextLayerModule.forRoot({ redis: { host: 'localhost' } })

// 2. 每个实体加 1 行
@Referenceable({ type: 'lesson_plan', displayName: '教案', icon: '📝' })

// 3. ORM 关系正常写（已经在做的事）
@ManyToOne(() => LessonPlan) lessonPlan: LessonPlan;

// 完了。关系从 ORM 推断。导航树自动生成。@ picker 自动可用。
```

## 导入

```typescript
// Solution 后端（NestJS，默认入口）
import { ContextLayerModule, Referenceable, Tracked } from '@kedge-agentic/context-layer';

// Solution 后端（非 NestJS，core 层）
import { EntityRegistry, ActivityEmitter } from '@kedge-agentic/context-layer/core';

// Solution 前端 / CLI / 跨进程消费者
import { ContextLayerClient } from '@kedge-agentic/context-layer/client';

// React @ picker 组件（独立包）
import { AtPicker } from '@kedge-agentic/context-layer-react';
```

## 核心设计原则

- **2 个 decorator**：@Referenceable（类）+ @Tracked（Service 方法）
- **Decorator 只做 SetMetadata**：零逻辑，遵循 @nestjs/throttler 模式
- **core/nestjs 分层**：core 是纯 TS 零框架依赖，nestjs 是薄壳
- **ORM 自动推断关系**：只保留两端都是 @Referenceable 的 FK
- **每个实体都是一等公民**：子实体可独立搜索、独立出现在 recents
- **@ 弹出 < 50ms**：Phase 1 从 Redis 预计算缓存读取
- **运行在 Solution 进程内**：不依赖 CCaaS 核心服务

## 设计演进记录

| 阶段 | 变化 |
|------|------|
| v1 | 8 个 decorator + 手动注册 EntityTypeRegistration（含 search/browse/resolve 端点声明） |
| v2 | 加入 children 树形声明（父亲声明子资源） |
| v3 | children → belongsTo（反转声明方向，每个实体声明自己属于谁） |
| v4 | belongsTo → ORM 自动推断（零声明，从 @ManyToOne 元数据推断） |
| v5 | 8 decorator → 2 decorator（其余折叠进参数或自动推断） |
| v6 | core/nestjs 分层（参考 @nestjs/throttler 的三层分工） |
| v7 | 部署模式确定：npm 包运行在 Solution 内，不需要向 CCaaS-core 注册 |
| v8 | 前端对接契约完善：entity-types 返回关系树 + 面包屑缓存 + 完整 response schema |
| v9 | 成都教育 Solution 的 @ 产品逻辑 harness：13 个验证场景 + mock 数据 + 4 阶段实现路径 |
