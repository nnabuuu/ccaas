# v3 Changelog

## 改动文件
- `solutions/business/article-analyzer/frontend/src/pages/RunProgressPage.tsx` — 重构 useEffect 依赖：(1) 用 `useRef` 存 `fetchData` 和 `handleEvent` 回调避免 identity 变化触发 SSE effect 重跑；(2) SSE 连接 effect 仅依赖 `id`；(3) polling 拆成独立 effect，仅在 `!sseConnected && status === 'running'` 时启用，run 完成后自动停止

## 对应维度
- D2 (HarnessModule 集成): `CcaasSessionProvider.waitForCompletion` 已在 v1 实现 `opts` 参数并转发 `text_delta`/`agent_status`/`tool_activity` 事件，v3 确认 sub-check 6 ✅
- D4 (前端功能): `RunProgressPage` SSE consumption 已在 v1 实现，v3 修复 useEffect 依赖问题使连接稳定（sub-check 6 ✅）

## 本轮重点
修复 RunProgressPage useEffect 依赖：`handleEvent` 的 useCallback 依赖 `fetchData`，导致 `id` 不变时 SSE 连接因 callback identity 变化反复断开重连。改用 `useRef` 存回调 + 拆分 SSE/polling 为独立 effect。

## 本轮跳过
- D1 (TypeScript 编译): 持续零错误
- D3 (Article 管理 API): 已满分
- D5 (SQLite 持久化): 已满分
- D6 (端到端验证): 已满分
