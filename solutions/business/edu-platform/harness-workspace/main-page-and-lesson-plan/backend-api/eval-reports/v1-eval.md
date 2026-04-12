# v1 Evaluation Report

## Pre-gate
- npm run build: **PASS** — `nest build` completes with zero TypeScript errors

## 总分: 87/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | Entity & Schema | 5/5 | 20/20 | 6 实体完整，字段、关系、类型全部正确 |
| D2 | API Completeness | 4/5 | 20/25 | 24/25 端点返回 2xx；`POST /blocks` 返回 500 |
| D3 | Business Logic | 4/5 | 16/20 | Fork/快照/推优/软删除正确；Activity 查询有时区问题 |
| D4 | Seed Data | 4/5 | 8/10 | 数据充分但 week-dots 默认参数在周日计算错误 |
| D5 | Integration | 5/5 | 15/15 | 构建零错误，双 DB 共存，现有端点正常 |
| D6 | Code Quality | 4/5 | 8/10 | 4 个 @ApiTags ✓；BlockItemDto.content 缺装饰器导致 500 |

## Penalties
None triggered.
- edu.db 未修改（git diff 无变更）
- 冻结模块（database/, curriculum/, users/, auth/）无修改
- 所有 4 个 Controller 均有 @ApiTags
- Activity 记录确实写入数据库（records exist in DB）

---

## D1 Details — Entity & Schema (20/20)

| Sub-item | Score | Finding |
|----------|-------|---------|
| 6 实体完整 | 1/1 | `sqlite3 .tables` 返回 6 张表：activities, content_blocks, lesson_plan_templates, lesson_plans, template_blocks, template_promotions |
| 字段完整 | 1/1 | lesson_plans 包含 requirement_id, requirement_snapshot, subject_id, class_id, lesson_type, status, source_template_id, source, scope, is_deleted, exercise_ids；全部与 HARNESS_SPEC 一致 |
| 关系正确 | 1/1 | content_blocks.lesson_plan_id FK → lesson_plans.id ON DELETE CASCADE；template_blocks.template_id FK → lesson_plan_templates.id ON DELETE CASCADE |
| TypeORM 自动建表 | 1/1 | `edu-typeorm.db` 自动创建，synchronize: true |
| 数据类型正确 | 1/1 | simple-json（requirement_snapshot, content, subject_ids, exercise_ids）、UUID 主键、datetime 日期字段 |

## D2 Details — API Completeness (20/25)

### LessonPlan 端点 (11/12)

| Endpoint | Status | Note |
|----------|--------|------|
| `GET /lesson-plans` | 200 ✓ | 分页 + 筛选正常 |
| `GET /lesson-plans/:id` | 200 ✓ | 含 blocks 按 sort_order |
| `POST /lesson-plans` | 201 ✓ | 含 fork 逻辑 |
| `PUT /lesson-plans/:id` | 200 ✓ | |
| `DELETE /lesson-plans/:id` | 200 ✓ | 软删除 |
| `POST /lesson-plans/:id/blocks` | **500 ✗** | `BlockItemDto.content` 无 class-validator 装饰器，被 `whitelist: true` 剥离 → content=undefined → DB NOT NULL 约束失败 |
| `POST /lesson-plans/:id/link-requirement` | 201 ✓ | |
| `GET /lesson-plans/:id/requirement-status` | 200 ✓ | |
| `POST /lesson-plans/:id/exercises` | 201 ✓ | |
| `POST /lesson-plans/:id/publish` | 201 ✓ | 含 warning 逻辑 |
| `POST /lesson-plans/:id/export` | 201 ✓ | Mock 实现 |
| `POST /lesson-plans/:id/save-as-template` | 201 ✓ | |

### Template 端点 (8/8) ✓

| Endpoint | Status |
|----------|--------|
| `GET /templates` | 200 ✓ |
| `GET /templates/:id` | 200 ✓ |
| `POST /templates` | 201 ✓ |
| `PUT /templates/:id` | 200 ✓ |
| `DELETE /templates/:id` | 200 ✓ |
| `POST /templates/:id/promote` | 201 ✓ |
| `GET /templates/promotions` | 200 ✓ |
| `POST /templates/promotions/:id/review` | 201 ✓ |

### Dashboard 端点 (2/2) ✓

| Endpoint | Status |
|----------|--------|
| `GET /dashboard/pending` | 200 ✓ |
| `GET /dashboard/ai-briefing` | 200 ✓ |

### Activity 端点 (3/3) ✓

| Endpoint | Status |
|----------|--------|
| `GET /context/activity` | 200 ✓ |
| `GET /context/activity/weekly-summary` | 200 ✓ |
| `GET /context/activity/week-dots` | 200 ✓ |

### Pagination 格式 ✓

`GET /lesson-plans?page=1&limit=2` 返回 `{ data, total, page, limit }` — 符合规格。

## D3 Details — Business Logic (16/20)

| Sub-item | Score | Finding |
|----------|-------|---------|
| Fork 模板→教案 | 1/1 | district 模板 12 blocks → fork 后教案 12 blocks，块数完全匹配。`source = 'template'`，`usage_count` 自增 |
| 学业要求快照 | 1/1 | `POST /link-requirement` 后 `GET /lesson-plans/:id` 返回 `requirement_snapshot: { code: '7.3.2', text: 'SSS', version: 'v2' }` |
| 推优流程完整 | 1/1 | promote (pending) → review approve → 新模板 scope=school 被创建，school 模板数从 1 增至 2。blocks 也被复制 |
| Activity 自动记录 | 0/1 | **Recording works**（DB 中存在 CRUD 触发的 activity 记录），**但 API 查询失败**：(1) ActivityController 默认 `user_id='default'`，Service 创建时用 `'default_user'` — 不匹配；(2) `getByDate` 使用 UTC 边界 (`${date}T00:00:00.000Z`)，在 UTC+8 环境下会遗漏当天活动 |
| 软删除 | 1/1 | DELETE 后 `is_deleted=true`，`GET /lesson-plans` 列表不返回已删除项 |

## D4 Details — Seed Data (8/10)

| Sub-item | Score | Finding |
|----------|-------|---------|
| 3 份教案 | 1/1 | draft(12.1 全等三角形), published(12.2 SSS/SAS), in_use(11.3 多边形内角和)；blocks 数 4/8/5 |
| 2 个模板 | 1/1 | district(新授课标准模板, 12 blocks), teacher(几何证明课模板, 10 blocks) |
| 20 条 Activity | 1/1 | 20 条记录覆盖 6 天，entity_type 包含 lesson_plan/homework/session/requirement/template/proposal |
| Activity 分布 | 0/1 | **数据本身正确**（6 天有活动，Apr 9 空白，Apr 7 有 4 种 entity_type）。但 `week-dots` 默认 week_start 计算在周日时算出下周一（`getDate() - getDay() + 1` 当 getDay()=0 时 = 14），导致默认查询仅返回 2 天数据。显式传 `week_start=2026-04-07` 可得到 6 天正确结果 |
| Dashboard pending | 1/1 | 返回 3 条（2 mock grading + 1 real TemplatePromotion pending） |

## D5 Details — Integration (15/15)

| Sub-item | Score | Finding |
|----------|-------|---------|
| npm run build 零错误 | 1/1 | `nest build` 无 error 无 warning |
| npm run start:dev 启动成功 | 1/1 | 监听 0.0.0.0:3011 |
| 现有端点不受影响 | 1/1 | `GET /api/curriculum/subjects` → 200，返回 `[{"subject":"math","count":163}]` |
| 现有 auth 端点不受影响 | 1/1 | `POST /api/auth/login` → 401（正确拒绝错误凭据），端点行为未变 |
| TypeORM 与 better-sqlite3 共存 | 1/1 | `edu.db`（77824 bytes, unchanged）与 `edu-typeorm.db`（86016 bytes）独立共存 |

## D6 Details — Code Quality (8/10)

| Sub-item | Score | Finding |
|----------|-------|---------|
| @ApiTags 装饰器 | 1/1 | 4 个 Controller 全部有：`lesson-plans`, `templates`, `dashboard`, `activity` |
| DTO + class-validator | 0/1 | 大部分 DTO 使用 @IsString/@IsOptional/@IsNumber/@IsArray/@ValidateNested。**但 `BlockItemDto.content: Record<string, any>` 无任何装饰器**，被 `whitelist: true` 剥离 → 导致 POST /blocks 500 |
| 404 处理 | 1/1 | `GET /lesson-plans/nonexistent-uuid` → `404 {"message":"LessonPlan nonexistent-uuid not found"}` |
| 400 处理 | 1/1 | `POST /lesson-plans` 空 body → `400 {"message":["title must be a string","subject_id must be a string","class_id must be a string"]}` |
| 模块结构规范 | 1/1 | lesson-plan/ 和 template/ 含 module+controller+service+dto/；dashboard/ 和 activity/ 含 module+controller+service |

## Bug Classification

1. **[COMPONENT]** `BlockItemDto.content` 缺少 class-validator 装饰器 → POST /blocks 500
2. **[COMPONENT]** `ActivityController` 默认 user_id='default'，而 Service 层使用 'default_user' — user_id 不匹配
3. **[COMPONENT]** `ActivityService.getByDate` 使用 UTC 边界导致 UTC+8 时区下日期过滤不准确
4. **[COMPONENT]** `ActivityController.getWeekDots` 默认 week_start 计算在周日时出错（`getDate() - 0 + 1` = 下周一）

## Actionable Fix Hints

### Fix 1: BlockItemDto.content 缺装饰器
- **File**: `backend/src/lesson-plan/dto/update-blocks.dto.ts:8`
- **Fix**: 在 `content` 字段添加 `@IsObject()` 或 `@IsNotEmpty()` 装饰器
```typescript
import { IsObject } from 'class-validator';
// ...
@IsObject()
content: Record<string, any>;
```

### Fix 2: Activity user_id 默认值不匹配
- **File**: `backend/src/activity/activity.controller.ts:12`
- **Fix**: 将默认值从 `'default'` 改为 `'default_user'`（或统一为某个常量）

### Fix 3: getByDate 时区问题
- **File**: `backend/src/activity/activity.service.ts:30-31`
- **Fix**: 使用本地日期边界而非 UTC
```typescript
const startOfDay = new Date(`${date}T00:00:00`);  // 去掉 Z
const endOfDay = new Date(`${date}T23:59:59.999`);
```

### Fix 4: week_start 周日计算错误
- **File**: `backend/src/activity/activity.controller.ts:33-37`
- **Fix**: 处理 Sunday (getDay()=0) 的特殊情况
```typescript
const day = now.getDay();
const diff = day === 0 ? 6 : day - 1; // Monday=0 offset
d.setDate(now.getDate() - diff);
```

## Priority Fix
1. **[D2+D6] `update-blocks.dto.ts:8`** — 给 `content` 加 `@IsObject()` 装饰器。修复后 POST /blocks → 200，D2 升至 5/5（+5分），D6 升至 5/5（+2分），总分 +7
2. **[D3] `activity.controller.ts:12` + `activity.service.ts:30-31`** — user_id 默认值改 `'default_user'` + 去掉日期边界的 Z 后缀。修复后 Activity 查询正常，D3 升至 5/5（+4分）
3. **[D4] `activity.controller.ts:33-37`** — 修复周日 week_start 计算。修复后 week-dots 默认返回完整 6 天数据，D4 升至 5/5（+2分）

**全部修复后预计总分: 100/100**

## What's Working Well
1. **Fork 模板→教案逻辑** — 块复制完整、usage_count 自增、source 字段正确设置。这是核心业务逻辑，实现质量高。
2. **推优流程** — promote → review approve 创建新模板 + 复制 blocks 的完整流程无误。包含 from_scope/to_scope/promotion_status 状态管理。
