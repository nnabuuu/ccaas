# v2 Evaluation Report

## Pre-gate
- npm run build: **PASS** — `nest build` completes with zero TypeScript errors

## 总分: 100/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | Entity & Schema | 5/5 | 20/20 | 6 entities complete, all fields match spec, FK + CASCADE correct |
| D2 | API Completeness | 5/5 | 25/25 | 25 endpoints all return 2xx, pagination format `{ data, total, page, limit }` correct |
| D3 | Business Logic | 5/5 | 20/20 | Fork copies blocks, snapshot persists, promote creates new template, activity auto-records, soft delete works |
| D4 | Seed Data | 5/5 | 10/10 | 3 LPs + 2 templates + 20 activities + 3 pending items, coverage complete |
| D5 | Integration | 5/5 | 15/15 | Build zero errors, start:dev works, curriculum/auth endpoints unaffected, DBs coexist |
| D6 | Code Quality | 5/5 | 10/10 | @ApiTags on all 4 controllers, DTOs with class-validator, 404/400 handling, clean module structure |

## Penalties
None

- edu.db: NOT modified (timestamp unchanged at Mar 26, confirmed via `git diff`)
- Frozen modules (database/, curriculum/, users/, auth/): NOT modified (confirmed via `git diff`)
- @ApiTags: Present on all 4 new controllers
- Activity auto-record: Confirmed working for all CRUD operations (verified in SQLite DB)

## D1 Details

### Sub-items (5/5 × 4 = 20/20)

| # | Item | Score | Evidence |
|---|------|-------|----------|
| 1 | 6 entities complete | 1/1 | `sqlite3 .tables` → activities, content_blocks, lesson_plan_templates, lesson_plans, template_blocks, template_promotions |
| 2 | Fields match HARNESS_SPEC | 1/1 | lesson_plans has: id(varchar PK), title, requirement_id(nullable), requirement_snapshot(text/simple-json), subject_id, class_id, lesson_type(default 'new'), duration_minutes(default 45), status(default 'draft'), source_template_id(nullable), source(default 'manual'), scope(default 'teacher'), is_deleted(default 0), user_id, exercise_ids(text), created_at, updated_at. Extra `exercise_ids` column is benign (used by linkExercises endpoint). |
| 3 | Relations correct | 1/1 | content_blocks: `FK lesson_plan_id → lesson_plans(id) ON DELETE CASCADE`. template_blocks: `FK template_id → lesson_plan_templates(id) ON DELETE CASCADE`. template_promotions: `FK template_id �� lesson_plan_templates(id) ON DELETE NO ACTION`. |
| 4 | TypeORM auto-creates tables | 1/1 | `synchronize: true` in typeorm.module.ts; all 6 tables present in edu-typeorm.db |
| 5 | Data types correct | 1/1 | simple-json columns stored as `text`, UUIDs as `varchar`, dates as `datetime` with defaults |

## D2 Details

### Sub-items (5/5 × 5 = 25/25)

| # | Item | Score | Evidence |
|---|------|-------|----------|
| 1 | LessonPlan endpoints (12) | 1/1 | All 12 return 2xx: GET list(200), GET detail(200), POST create(201), PUT update(200), DELETE soft-delete(200), POST blocks(201), POST link-requirement(201), GET requirement-status(200), POST exercises(201), POST publish(201), POST export(201), POST save-as-template(201) |
| 2 | Template endpoints (8) | 1/1 | All 8 return 2xx: GET list(200), GET detail(200), POST create(201), PUT update(200), DELETE soft-delete(200), POST promote(201), GET promotions(200), POST review(201) |
| 3 | Dashboard endpoints (2) | 1/1 | GET /dashboard/pending(200), GET /dashboard/ai-briefing(200) |
| 4 | Activity endpoints (3) | 1/1 | GET /context/activity(200), GET /context/activity/weekly-summary(200), GET /context/activity/week-dots(200) |
| 5 | Pagination format | 1/1 | Both lesson-plans and templates list endpoints return `{ data, total, page, limit }`. Verified via `jq 'keys'`. |

### Endpoint Detail

```
LessonPlan:  12/12 endpoints → 2xx
Templates:    8/8  endpoints �� 2xx
Dashboard:    2/2  endpoints → 2xx
Activity:     3/3  endpoints → 2xx
Total:       25/25 endpoints → 2xx
```

## D3 Details

### Sub-items (5/5 × 4 = 20/20)

| # | Item | Score | Evidence |
|---|------|-------|----------|
| 1 | Fork template→LP | 1/1 | District template (12 blocks) → POST /lesson-plans with source_template_id → new LP has 12 blocks, source='template', source_template_id matches. Template usage_count incremented. |
| 2 | Requirement snapshot | 1/1 | POST link-requirement with `{requirement_id:"req_1", requirement_snapshot:{code:"7.3.2",text:"SSS/SAS判定",version:"v2.1"}}` → GET LP detail shows requirement_snapshot persisted correctly |
| 3 | Promote flow complete | 1/1 | POST promote → TemplatePromotion created (status=pending) → POST review approve → new template created at school scope (school count: 1→2), blocks copied (1→1), source_template_id links to original |
| 4 | Activity auto-record | 1/1 | DB query confirmed: lesson_plan.created records exist for all POST /lesson-plans calls. All mutating operations (create, update, softDelete, updateBlocks, linkRequirement, linkExercises, publish, saveAsTemplate, promote, reviewPromotion) call ActivityService.record(). Verified 41 total activities in DB after tests. |
| 5 | Soft delete | 1/1 | POST create → DELETE → GET list: deleted LP has `is_deleted=true`, not returned in list query (confirmed count=0) |

## D4 Details

### Sub-items (5/5 × 2 = 10/10)

| # | Item | Score | Evidence |
|---|------|-------|----------|
| 1 | 3 lesson plans | 1/1 | Seed output: "3 plans (17 blocks total)". Statuses: published(1, 8 blocks), draft(1, 4 blocks), in_use(1, 5 blocks). Each has realistic Chinese math content. |
| 2 | 2 templates | 1/1 | Seed output: "新授课标准模板 (12 blocks), 几何证明课模板 (10 blocks)". District scope + teacher scope. |
| 3 | 20 activities across 7 days | 1/1 | Seed output: "20 records across 6 days (day -4 is empty)". Week-dots shows 6 days with activity, Apr 9 intentionally blank. Today has 5 seed activities (homework.submitted, lesson_plan.published, lesson_plan.updated, lesson_plan.requirement_linked, session.created). |
| 4 | Activity distribution | 1/1 | Apr 9 has 0 records (blank day ✓). Apr 13 has 4 entity_types [lesson_plan, homework, session, template] ✓. Apr 10 has 3 entity_types [template, homework, lesson_plan] ✓. |
| 5 | Dashboard pending | 1/1 | Returns 3 items: 2 grading mocks ("八(2)班 SAS 专项练习", "八(3)班 全等复习作业") + 1 real TemplatePromotion review item ("几何证明课模板推优申请"). Matches spec exactly. |

### Additional Seed Quality

- AI briefing: Returns 2 insights with suggested_actions + common_actions matching spec
- Weekly summary: `{lesson_plan_edits: 9, submissions_graded: 2}` — aggregates correctly from activity data

## D5 Details

### Sub-items (5/5 × 3 = 15/15)

| # | Item | Score | Evidence |
|---|------|-------|----------|
| 1 | npm run build zero errors | 1/1 | `nest build` completes cleanly, no TS errors |
| 2 | npm run start:dev starts | 1/1 | Backend starts on port 3011, responds to curl requests |
| 3 | /api/curriculum/subjects works | 1/1 | Returns JSON array (type="array", length=1) — existing curriculum data intact |
| 4 | /api/auth/login responds | 1/1 | Returns proper 401 JSON `{"message":"用户名或密码错误","error":"Unauthorized","statusCode":401}` for wrong credentials — auth module functional and unaffected |
| 5 | TypeORM + better-sqlite3 coexist | 1/1 | edu.db (77824 bytes, Mar 26) untouched. edu-typeorm.db (86016 bytes) created separately. `git diff` confirms no changes to edu.db or frozen modules. |

## D6 Details

### Sub-items (5/5 × 2 = 10/10)

| # | Item | Score | Evidence |
|---|------|-------|----------|
| 1 | @ApiTags | 1/1 | All 4 controllers: `@ApiTags('lesson-plans')` (lesson-plan.controller.ts:17), `@ApiTags('templates')` (template.controller.ts:18), `@ApiTags('dashboard')` (dashboard.controller.ts:5), `@ApiTags('activity')` (activity.controller.ts:5) |
| 2 | DTO + class-validator | 1/1 | 7 DTO files across lesson-plan/dto/ and template/dto/. Use @IsString, @IsOptional, @IsNumber, @IsArray, @ValidateNested decorators. CreateLessonPlanDto validates title, subject_id, class_id as required strings. |
| 3 | 404 handling | 1/1 | `GET /lesson-plans/nonexistent-uuid` → 404 `{"message":"LessonPlan nonexistent-uuid not found","error":"Not Found","statusCode":404}` |
| 4 | 400 handling | 1/1 | `POST /lesson-plans` with `{}` → 400 `{"message":["title must be a string","subject_id must be a string","class_id must be a string"],"error":"Bad Request","statusCode":400}` |
| 5 | Module structure | 1/1 | Each module follows NestJS convention: module.ts + controller.ts + service.ts + dto/. lesson-plan/ has 3 DTOs, template/ has 4 DTOs. Clean separation of concerns. |

## Bug Classification

No deductions triggered. Minor observations (not deductions):

- **[DESIGN]** — `reviewPromotion` approve does not update original template's `promotion_status` from 'pending' to 'approved'. Spec says "原模板保持不变" which is ambiguous. TemplatePromotion record IS correctly updated. Not a functional bug per spec wording.
- **[DESIGN]** — Activity `getByDate` filters by `user_id` (defaults to 'teacher_001' in controller). API tests using 'default_user' don't appear in default activity queries. Not a bug — just a UX consideration for multi-user scenarios.

## Actionable Fix Hints

No [COMPONENT] deductions to fix. The two [DESIGN] observations above are optional improvements:

1. `template.service.ts` reviewPromotion method (~line where approve block is): After updating TemplatePromotion status to 'approved', also set `template.promotion_status = 'approved'` on the original template.
2. `activity.controller.ts`: Consider making `user_id` optional with no default filter, returning all activities if not specified.

## Priority Fix

No fixes required — all evaluation criteria met.

## What's Working Well

1. **Fork logic is correctly implemented** — Template blocks are copied to ContentBlock with proper type/content/sort_order mapping, source is set to 'template', usage_count is incremented. Do NOT change this.
2. **Activity auto-recording is thorough** — Every mutating operation in both LessonPlanService and TemplateService calls `ActivityService.record()` with appropriate entity_type, action, and detail. This is well-architected with proper dependency injection via ActivityModule exports. Do NOT change this pattern.
