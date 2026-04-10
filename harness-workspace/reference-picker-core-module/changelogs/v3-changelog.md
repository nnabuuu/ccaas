# v3 Changelog

## 改动文件

### D2/D6: Dead code cleanup
- **DELETED** `solutions/mock/context-layer-demo/src/controllers/context-demo.controller.ts` — v1 遗留的独立 controller，v2 迁移到 ContextLayerModule.forRoot() 后不再使用
- **DELETED** `solutions/mock/context-layer-demo/src/controllers/` — 空目录
- `solutions/mock/context-layer-demo/src/seed/mock-data.service.ts` — 删除未使用的方法（getEntityTypes, getSuggest, getShortcuts, recordActivity）、roots 字段、sessionTemplates 字段、recentActivities 字段、relations 字段；将 6 个内联 type 声明替换为 `import type { ... } from '@kedge-agentic/context-layer'`
- `solutions/mock/context-layer-demo/src/app.module.ts` — 移除 providers 中未使用的 `MockDataService` DI 实例（实际使用的是 module 级手动创建的实例）

### D5: MentionPicker 完整集成
- `packages/chat-interface/src/components/chat/MentionPicker.tsx` — 新增 `<AtPicker>` 渲染（当 pickerOpen=true 时），添加 Escape 键关闭 picker，导入并使用 context-layer-react 的 AtPicker 组件
- `packages/chat-interface/package.json` — 添加 `@kedge-agentic/context-layer-react` 为 peer + dev 依赖

### D4: 性能优化 — batch hmget
- `packages/context-layer/src/core/interfaces.ts` — CacheStore 接口新增 `hmget(key, fields[])` 方法
- `packages/context-layer/src/core/recommend-engine.ts` — getTopN() 改用单次 hmget 批量获取 entity info，替代 N 次 hget 循环
- `solutions/mock/context-layer-demo/src/adapters/mock-cache-store.ts` — 实现 hmget 方法

### D2: Client SDK 完善
- `packages/context-layer/src/client/context-layer-client.ts` — getShortcuts() 添加可选 sessionTemplate 参数，与 controller API 对齐

## 对应维度
- **D2 (架构合规性)**: 删除 dead file + dead code + 重复类型声明 → 0 dead code。Client SDK getShortcuts 支持 sessionTemplate。
- **D4 (性能 SLA)**: N+1 hget → 1 次 hmget 批量获取。对 Redis 场景从 N round-trips 优化为 1 round-trip。
- **D5 (前端交互)**: MentionPicker 现在完整渲染 AtPicker overlay，不再只是 pill-only 组件。添加 Escape 键关闭。
- **D6 (代码规范)**: 删除所有 dead code，import types from package 而非重复声明。

## 本轮重点
MentionPicker 完整集成 + dead code 全面清理 + hmget 批量性能优化。

## 本轮跳过
- **AtPickerProvider 使用 ContextLayerClient** — eval 指出 AtPickerProvider 内联 fetch 而非使用 Client SDK。这是一个 DESIGN 级改动，涉及 context-layer-react 包对 context-layer client 的依赖关系变更，本轮不做以避免跨包回归。
- **键盘导航** — 箭头键在 picker items 中的支持。属于交互增强，非扣分项，留待后续。

## tsc 验证
- packages/context-layer: 0 errors ✓
- packages/context-layer-react: 0 errors ✓
- solutions/mock/context-layer-demo: 0 errors ✓

## Penalty 检查
- P1 (core NestJS import): PASS — `grep -rn "from '@nestjs" core/` 返回空
- P2 (Composer modification): PASS — 未修改 ChatInterfaceComposer.tsx
- P3 (mock edu-platform import): PASS — mock 无 edu-platform import
- P5 (decorator purity): PASS — 未修改 decorator
