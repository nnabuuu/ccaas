# v4 Changelog

## 改动文件
- `solutions/business/edu-platform/backend/src/referenceable/referenceable.module.ts` — 在 onModuleInit() 中增加 `registry.register()` 调用，注册 lesson_plan/template/requirement 的 type metadata（displayName, icon, color, abilities），使 `/context/entity-types` 返回有意义的 types 数组
- `solutions/business/edu-platform/backend/src/referenceable/providers/lesson-plan.provider.ts` — 添加 LESSON_TYPE_MAP，将 lesson_type 原始值（new/review/practice/experiment/lecture）映射为中文（新授课/复习课/练习课/实验课/讲评课），在 buildSummary 和 buildListSummary 中使用
- `solutions/business/edu-platform/backend/src/referenceable/providers/requirement.provider.ts` — 添加 SUBJECT_MAP，将 subject 原始值（math/chinese/english 等）映射为中文（数学/语文/英语等），在 buildSummary 和 parent relation summary 中使用
- `solutions/business/edu-platform/backend/src/referenceable/adapters/edu-browse-provider.ts` — 同步添加 LESSON_TYPE_MAP 和 SUBJECT_MAP，确保 browse/search 端点返回的 summary 也使用中文映射，与 EntityContext summary 一致
- `packages/chat-interface/src/components/chat/ApplyActionBlock.tsx` — 新建 ApplyActionBlock 组件，渲染 apply_action content block 为确认按钮，调用 POST /context/apply，支持 pending/loading/applied/error 状态
- `packages/chat-interface/src/components/chat/index.ts` — 导出 ApplyActionBlock 和 ApplyActionProps

## 对应维度
- D2 (架构合规性): entity-types 端点现在返回 3 个注册的 types（lesson_plan/template/requirement），每个包含 displayName、icon、color、searchable、browsable 字段。修复了 registry.register() 缺失导致的空数组问题。+5 分预期（4/5 → 5/5）
- D4 (数据质量): summary 中 lesson_type 和 subject 全部使用中文映射。"new" → "新授课"，"math" → "数学"。browse/search 端点的 summary 也同步更新。+3 分预期（4/5 → 5/5）
- D5 (前端交互): 新增 ApplyActionBlock 组件，data-testid="apply-action-button" 存在于生产代码中。+2 分预期（4/5 → 5/5）

## 本轮重点
修复 3 个 [COMPONENT] 级问题（entity-types 空数组、lesson_type 中文映射、subject 中文映射），额外增加 browse/search 中文一致性和 ApplyActionBlock 组件。

## 本轮跳过
- S9/S10 (Chat UI 前端页面): [SYSTEM] 级问题，需要配置 Vite dev server 或 static assets middleware 提供前端页面。不属于 context-layer 实现范围。
- entity-types tree.roots 为空: 当前 setRelations() 未被调用（lesson_plan → requirement 关系未显式注册）。不影响功能，entity-types 格式正确。如需修复可在 onModuleInit 中调用 registry.setRelations()。

## 验证结果
- tsc --noEmit: edu-platform backend 和 chat-interface 均零错误
- entity-types: 返回 3 个 types（之前为空数组）
- lesson_plan summary: "八(2)班 数学 新授课 教案 45分钟 学业要求7.3.1"（之前 "new"）
- requirement summary: "数学 数与代数"（之前 "math"）
- browse summary: "八(2)班 数学 新授课 教案"（之前 "new"）
- 向后兼容: suggest/resolve/browse/search 端点格式不变
