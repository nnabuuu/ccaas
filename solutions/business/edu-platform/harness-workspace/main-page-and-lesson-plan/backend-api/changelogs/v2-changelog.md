# v2 Changelog

## 目标
基于 v1 eval report (87/100) 的 4 个 bug 修复，目标 100/100。

## 修改清单

### Fix 1: BlockItemDto.content 缺装饰器 (D2+D6, +7pts)
- `backend/src/lesson-plan/dto/update-blocks.dto.ts:8` — 给 `content` 字段添加 `@IsObject()` 装饰器
- 原因: `whitelist: true` 会剥离无装饰器的字段 → content=undefined → DB NOT NULL 约束失败 → 500

### Fix 2: ActivityController 默认 user_id 不匹配 (D3)
- `backend/src/activity/activity.controller.ts` — 默认值从 `'default'` 改为 `'teacher_001'`（匹配 seed 数据）
- 3 个方法全部统一修改

### Fix 3: Activity 日期查询时区问题 (D3)
- `backend/src/activity/activity.service.ts:30-31` — `getByDate` 去掉日期边界的 `Z` 后缀（使用本地时间而非 UTC）
- `backend/src/activity/activity.service.ts:78` — `getWeekDots` 同样去掉 `Z` 后缀
- `backend/src/activity/activity.service.ts:91` — `getWeekDots` 日期键提取改用本地时间格式
- `backend/src/activity/activity.controller.ts:16` — `getByDate` 默认日期从 `toISOString()` 改为本地日期

### Fix 4: week_start / weekly-summary 默认时间窗口 (D4)
- `backend/src/activity/activity.controller.ts:34-42` — 默认 week_start 改为「6 天前」（滚动 7 天窗口），不再依赖 getDay() 的 Monday 偏移计算
- `backend/src/activity/activity.service.ts:50-53` — `getWeeklySummary` 同样改为滚动 7 天窗口
- 原因: 原逻辑在周日时 `getDate() - 0 + 1` 计算为下周一；且在周一时只显示当天数据

## 自检结果
- npm run build: PASS（零错误）
- 现有端点回归: PASS（curriculum subjects 正常返回）
- POST /blocks: 201 ✓（修复前 500）
- Activity today: 6 items ✓（修复前 3）
- Weekly summary: `{lesson_plan_edits: 7, submissions_graded: 2}` ✓（修复前 0, 0）
- Week-dots default: 6 days ✓（修复前 1）
- Dashboard pending: 3 items ✓
- 新端点可用: 25/25

## 本轮跳过
- 无跳过项，本轮修复了 eval report 中的全部 4 个 bug
