# v2 Changelog

## 改动文件

### packages/context-layer/package.json
- 移除 `"type": "module"`，使 dist 输出 CJS（兼容 NestJS mock 的 commonjs 环境）
- 更新 exports 条件：`"import"` → `"default"`，新增 `"./nestjs"` 子路径导出

### packages/context-layer/tsconfig.json
- `module`: `"ESNext"` → `"NodeNext"`
- `moduleResolution`: `"bundler"` → `"NodeNext"`

### packages/context-layer/src/core/shortcut-manager.ts
- `getShortcuts()` 新增 `sessionTemplate?` 参数
- cache key 按 sessionTemplate 分隔：`ctx:shortcuts:{tenant}:{user}:{template}`

### packages/context-layer/src/nestjs/context-layer.controller.ts
- `/shortcuts` endpoint 将 `session_template` query param 传递给 ShortcutManager

### solutions/mock/context-layer-demo/package.json
- 新增依赖 `@kedge-agentic/context-layer: file:../../../packages/context-layer`
- scripts 加入 `--preserve-symlinks` 避免 NestJS 双包问题

### solutions/mock/context-layer-demo/src/app.module.ts（重写）
- **核心改动**: 替换独立 ContextDemoController → 接入 `ContextLayerModule.forRoot()`
- 传入三个 adapter：MockCacheStore, MockBrowseProvider, MockOrmAdapter

### solutions/mock/context-layer-demo/src/adapters/（新建 4 文件）
- `mock-cache-store.ts` — 内存 CacheStore（Map 模拟 kv / sorted set / hash）
- `mock-browse-provider.ts` — EntityBrowseProvider，委托 MockDataService
- `mock-orm-adapter.ts` — 空 OrmAdapter（关系由 MockSetupService 手动注入）
- `mock-setup.service.ts` — OnModuleInit 数据种子：10 实体类型 + 7 关系 + 4 recents + shortcuts

### solutions/mock/context-layer-demo/src/controllers/context-demo.controller.ts（删除）
- 不再需要独立 controller，由 ContextLayerModule 自带 controller 接管

### packages/context-layer-react/src/AtPickerProvider.tsx
- 7 个重复 interface 声明替换为 `import type {...} from '@kedge-agentic/context-layer/client'`
- 保留 `export type` 保持向后兼容

### packages/context-layer-react/package.json
- 新增 `peerDependencies: { "@kedge-agentic/context-layer": "^0.1.0" }`

### packages/context-layer-react/src/components/（删除 5 文件）
- `BreadcrumbNav.tsx`, `DrillDownView.tsx`, `RecentsSection.tsx`, `SearchResults.tsx`, `TypeBrowseSection.tsx`
- 未被任何代码引用，属于死代码

## 对应维度

- **D2 (架构合规性)**: Mock 改用 `ContextLayerModule.forRoot()` + adapter 模式（原 P3 扣分项）；React 包类型不再重复声明
- **D6 (代码规范)**: Mock roots 由 `EntityRegistry.computeRoots()` 自动计算为 `['lesson_plan', 'homework', 'requirement']`（原评估指出包含了子类型）；删除 5 个未引用组件

## 本轮重点
1. **Mock 接入真实模块**（D2 最大扣分项，+6pts 预估）：从独立 controller 改为 `ContextLayerModule.forRoot()`，验证整个 NestJS DynamicModule 链路
2. **ESM→CJS 兼容**：context-layer 包从 ESM 改为 CJS 输出，解决 NestJS mock 导入兼容性
3. **`--preserve-symlinks`** 解决 monorepo `file:` 依赖下 NestJS 双包解析问题
4. **类型去重 + 死代码清理**：context-layer-react 不再内联 7 个接口定义；删除 5 个未引用组件

## 本轮跳过
- **D1 (场景通过率)**: 未运行 Playwright E2E（需浏览器环境），但所有 API endpoint 手动验证通过
- **D4 (性能 SLA)**: 未做性能优化（内存操作已满足 < 200ms）
- **D5 (前端交互质量)**: 未改动前端 UI 组件
