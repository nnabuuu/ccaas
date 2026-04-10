# v3 Changelog

## 改动文件
- `packages/harness/src/core/interfaces.ts` — 扩展 `SessionEvent.type` union：添加 `'text_delta' | 'agent_status' | 'tool_activity'`，与 CcaasSessionProvider 实际发射的事件类型对齐
- `packages/harness/src/nestjs/harness.controller.ts` — 修复 `lastEventId` NaN guard：`parseInt` 结果为 NaN 时回退到 `undefined`，防止 SSE 重连时传入 NaN seq
- `packages/harness/src/nestjs/harness.module.ts` — (1) 在 routingEmitter 中添加延迟清理：`run_completed`/`run_failed`/`error` 事件后 60s 检查 subscriberCount=0 则移除 stream，防止内存泄漏；(2) 移除未使用的 `CompositeEventEmitter` import
- `packages/harness/src/core/composite-emitter.ts` — DELETE：dead code，`harness.module.ts` 已用 inline routingEmitter 实现 per-run routing
- `packages/harness/src/core/index.ts` — 移除 `CompositeEventEmitter` 导出
- `packages/harness/src/index.ts` — 移除 `CompositeEventEmitter` 导出
- `packages/harness/src/core/event-stream.spec.ts` — 新增：10 个测试用例覆盖 RunEventStream（emit/subscribe、ring buffer 上限、seq 过滤、unsubscribe、异常隔离、subscriberCount）和 RunEventStreamRegistry（getOrCreate、get、remove）
- `solutions/business/article-analyzer/frontend/src/pages/RunProgressPage.tsx` — 重构 useEffect 依赖：(1) 用 `useRef` 存 `fetchData` 和 `handleEvent` 回调避免 identity 变化触发 effect 重跑；(2) SSE 连接 effect 仅依赖 `id`；(3) polling 拆成独立 effect，仅在 `!sseConnected && status === 'running'` 时启用

## 对应维度
- D3 (核心编排逻辑): session event forwarding 已在 v1 实现，v3 修复 SessionEvent.type union 使类型安全完整（sub-check 6 ✅）
- D4 (REST API 完整性): SSE endpoint `GET /harness/runs/:runId/events` 已在 v1 实现，v3 修复 NaN guard（端点 15 ✅）
- D6 (测试覆盖): 新增 `event-stream.spec.ts`（10 个测试），总测试从 31→41（组件 6 ✅）

## 本轮重点
code-reviewer v1 报告的 6 个必修问题全部修复：P7（类型 union 缺失）、P8（内存泄漏）、NaN guard、dead code 清理、测试补全、React useEffect 修复。

## 本轮跳过
- D1 (TypeScript 编译): 持续零错误
- D2 (架构模式): 无变更
- D5 (Mock Demo): 无变更
