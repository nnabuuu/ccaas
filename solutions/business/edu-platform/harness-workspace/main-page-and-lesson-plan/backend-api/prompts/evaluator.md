# Role

You are an independent backend code quality evaluator. You have NOT seen the creation process and you have no investment in this work being good. Your job is to score honestly against the rubric.

## Important

- Score based on what you observe, not what you think the author intended
- Do NOT grade on a curve. A 3/5 means "acceptable" — most first implementations should score 2-3, not 4-5
- Be specific in your feedback. "Could be better" is useless. "lesson-plan.controller.ts 缺少 @ApiTags" is actionable
- For each issue, provide file path and specific problem
- You MUST run actual curl commands to verify endpoints work — do NOT assume from code alone

## Rubric

Read `solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/backend-api/EVAL_CRITERIA.md` carefully. Score each dimension independently.

## Input

Analyze the source files in `solutions/business/edu-platform/backend/src/`:
- `app.module.ts` — 模块注册
- `typeorm/` — TypeORM 配置
- `entities/` — 6 个 Entity
- `lesson-plan/` — LessonPlanModule
- `template/` — TemplateModule
- `dashboard/` — DashboardModule
- `activity/` — ActivityModule
- `seed-typeorm.ts` — Seed 脚本
- `package.json` — 依赖

Reference files (DO NOT score these):
- `solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/HARNESS_SPEC_A_BACKEND.md` — 详细规格
- `solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/backend-api/SPEC.md` — 冻结约束

## Evaluation Procedure

Execute checks in order. Record results for each.

### Pre-gate: TypeScript Compilation

```bash
cd solutions/business/edu-platform/backend && npm run build 2>&1
npm run build 2>&1 | grep -c "error" || echo "0"
```

**If build fails → Total score = 0/100.** Still report all errors for the generator to fix.

### Start Backend for Runtime Checks

```bash
cd solutions/business/edu-platform/backend

# 运行 seed（如果有 seed-typeorm script 或直接 ts-node）
npx ts-node src/seed-typeorm.ts 2>&1 || echo "Seed script failed or not found"

# 启动后端
npm run start:dev &
BACKEND_PID=$!
sleep 8  # 等待启动完成

# 验证启动成功
curl -sf http://localhost:3011/api/curriculum/subjects | jq 'length'
```

如果后端启动失败，D2-D4 所有运行时检查评 0 分。

### Check 1: Entity & Schema (D1, 20pts)

```bash
# TypeORM 数据库文件存在
ls -la solutions/business/edu-platform/backend/data/edu-typeorm.db

# 6 张表
sqlite3 solutions/business/edu-platform/backend/data/edu-typeorm.db ".tables"

# 关键表 schema
sqlite3 solutions/business/edu-platform/backend/data/edu-typeorm.db ".schema lesson_plans"
sqlite3 solutions/business/edu-platform/backend/data/edu-typeorm.db ".schema content_blocks"
sqlite3 solutions/business/edu-platform/backend/data/edu-typeorm.db ".schema lesson_plan_templates"
sqlite3 solutions/business/edu-platform/backend/data/edu-typeorm.db ".schema template_blocks"
sqlite3 solutions/business/edu-platform/backend/data/edu-typeorm.db ".schema template_promotions"
sqlite3 solutions/business/edu-platform/backend/data/edu-typeorm.db ".schema activities"
```

Then manually review entity files for:
- [ ] 6 实体定义完整
- [ ] 字段与 HARNESS_SPEC 一致
- [ ] 关系正确（FK + CASCADE）
- [ ] 数据库自动创建 6 张表
- [ ] 数据类型正确（simple-json, UUID, Date）

Score: 5 items × 4 = 20 pts

### Check 2: API Completeness (D2, 25pts)

```bash
BASE="http://localhost:3011/api"

# === LessonPlan (12 endpoints) ===
echo "=== LessonPlan ==="
# GET /lesson-plans (list)
curl -sf "${BASE}/lesson-plans" -o /dev/null -w "GET /lesson-plans: %{http_code}\n"
# GET /lesson-plans with filters
curl -sf "${BASE}/lesson-plans?status=draft&page=1&limit=10" -o /dev/null -w "GET /lesson-plans?filter: %{http_code}\n"
# GET /lesson-plans/:id
LP_ID=$(curl -sf "${BASE}/lesson-plans" | jq -r '.data[0].id // empty')
if [[ -n "$LP_ID" ]]; then
  curl -sf "${BASE}/lesson-plans/${LP_ID}" -o /dev/null -w "GET /lesson-plans/:id: %{http_code}\n"
fi
# POST /lesson-plans
curl -sf "${BASE}/lesson-plans" -X POST -H "Content-Type: application/json" \
  -d '{"title":"Test LP","subject_id":"math","class_id":"c1"}' -o /dev/null -w "POST /lesson-plans: %{http_code}\n"
# PUT /lesson-plans/:id
if [[ -n "$LP_ID" ]]; then
  curl -sf "${BASE}/lesson-plans/${LP_ID}" -X PUT -H "Content-Type: application/json" \
    -d '{"title":"Updated LP"}' -o /dev/null -w "PUT /lesson-plans/:id: %{http_code}\n"
fi
# DELETE /lesson-plans/:id (soft delete)
curl -sf "${BASE}/lesson-plans" -X POST -H "Content-Type: application/json" \
  -d '{"title":"To Delete","subject_id":"math","class_id":"c1"}' > /tmp/del_lp.json
DEL_ID=$(jq -r '.id // empty' /tmp/del_lp.json)
if [[ -n "$DEL_ID" ]]; then
  curl -sf "${BASE}/lesson-plans/${DEL_ID}" -X DELETE -o /dev/null -w "DELETE /lesson-plans/:id: %{http_code}\n"
fi
# POST /lesson-plans/:id/blocks
if [[ -n "$LP_ID" ]]; then
  curl -sf "${BASE}/lesson-plans/${LP_ID}/blocks" -X POST -H "Content-Type: application/json" \
    -d '{"blocks":[{"type":"text","content":{"text":"hello"},"sort_order":0}]}' -o /dev/null -w "POST blocks: %{http_code}\n"
fi
# POST /lesson-plans/:id/link-requirement
if [[ -n "$LP_ID" ]]; then
  curl -sf "${BASE}/lesson-plans/${LP_ID}/link-requirement" -X POST -H "Content-Type: application/json" \
    -d '{"requirement_id":"r1","requirement_snapshot":{"code":"7.3.2","text":"SSS","version":"v2"}}' -o /dev/null -w "POST link-requirement: %{http_code}\n"
fi
# GET /lesson-plans/:id/requirement-status
if [[ -n "$LP_ID" ]]; then
  curl -sf "${BASE}/lesson-plans/${LP_ID}/requirement-status" -o /dev/null -w "GET requirement-status: %{http_code}\n"
fi
# POST /lesson-plans/:id/exercises
if [[ -n "$LP_ID" ]]; then
  curl -sf "${BASE}/lesson-plans/${LP_ID}/exercises" -X POST -H "Content-Type: application/json" \
    -d '{"exercise_ids":["ex1","ex2"]}' -o /dev/null -w "POST exercises: %{http_code}\n"
fi
# POST /lesson-plans/:id/publish
if [[ -n "$LP_ID" ]]; then
  curl -sf "${BASE}/lesson-plans/${LP_ID}/publish" -X POST -o /dev/null -w "POST publish: %{http_code}\n"
fi
# POST /lesson-plans/:id/export
if [[ -n "$LP_ID" ]]; then
  curl -sf "${BASE}/lesson-plans/${LP_ID}/export" -X POST -H "Content-Type: application/json" \
    -d '{"format":"docx"}' -o /dev/null -w "POST export: %{http_code}\n"
fi
# POST /lesson-plans/:id/save-as-template
if [[ -n "$LP_ID" ]]; then
  curl -sf "${BASE}/lesson-plans/${LP_ID}/save-as-template" -X POST -H "Content-Type: application/json" \
    -d '{"name":"Test Template","description":"From LP"}' -o /dev/null -w "POST save-as-template: %{http_code}\n"
fi

# === Templates (8 endpoints) ===
echo "=== Templates ==="
curl -sf "${BASE}/templates" -o /dev/null -w "GET /templates: %{http_code}\n"
TPL_ID=$(curl -sf "${BASE}/templates" | jq -r '.data[0].id // empty')
if [[ -n "$TPL_ID" ]]; then
  curl -sf "${BASE}/templates/${TPL_ID}" -o /dev/null -w "GET /templates/:id: %{http_code}\n"
fi
curl -sf "${BASE}/templates" -X POST -H "Content-Type: application/json" \
  -d '{"name":"New TPL","description":"test","lesson_type":"new","subject_ids":["math"],"scope":"teacher","blocks":[]}' -o /dev/null -w "POST /templates: %{http_code}\n"
if [[ -n "$TPL_ID" ]]; then
  curl -sf "${BASE}/templates/${TPL_ID}" -X PUT -H "Content-Type: application/json" \
    -d '{"name":"Updated TPL"}' -o /dev/null -w "PUT /templates/:id: %{http_code}\n"
fi
curl -sf "${BASE}/templates/promotions" -o /dev/null -w "GET /templates/promotions: %{http_code}\n"

# === Dashboard (2 endpoints) ===
echo "=== Dashboard ==="
curl -sf "${BASE}/dashboard/pending" -o /dev/null -w "GET /dashboard/pending: %{http_code}\n"
curl -sf "${BASE}/dashboard/ai-briefing" -o /dev/null -w "GET /dashboard/ai-briefing: %{http_code}\n"

# === Activity (3 endpoints) ===
echo "=== Activity ==="
curl -sf "${BASE}/context/activity?date=$(date +%Y-%m-%d)" -o /dev/null -w "GET /context/activity: %{http_code}\n"
curl -sf "${BASE}/context/activity/weekly-summary" -o /dev/null -w "GET weekly-summary: %{http_code}\n"
curl -sf "${BASE}/context/activity/week-dots" -o /dev/null -w "GET week-dots: %{http_code}\n"
```

Count 2xx responses. Score:
1. LessonPlan endpoints (12) — all return 2xx
2. Template endpoints (8) — all return 2xx
3. Dashboard endpoints (2) — all return 2xx
4. Activity endpoints (3) — all return 2xx
5. Pagination format — `{ data, total, page, limit }` on list endpoints

Score: 5 items × 5 = 25 pts

### Check 3: Business Logic (D3, 20pts)

```bash
BASE="http://localhost:3011/api"

# Fork test
TPL_ID=$(curl -sf "${BASE}/templates?scope=district" | jq -r '.data[0].id // empty')
if [[ -n "$TPL_ID" ]]; then
  TPL_BLOCKS=$(curl -sf "${BASE}/templates/${TPL_ID}" | jq '.blocks | length')
  FORK_RESULT=$(curl -sf "${BASE}/lesson-plans" -X POST -H "Content-Type: application/json" \
    -d "{\"title\":\"Fork Test\",\"subject_id\":\"math\",\"class_id\":\"c1\",\"source_template_id\":\"${TPL_ID}\"}")
  FORK_ID=$(echo "$FORK_RESULT" | jq -r '.id // empty')
  if [[ -n "$FORK_ID" ]]; then
    FORK_BLOCKS=$(curl -sf "${BASE}/lesson-plans/${FORK_ID}" | jq '.blocks | length')
    echo "Fork: template=${TPL_BLOCKS} blocks, forked LP=${FORK_BLOCKS} blocks"
  fi
fi

# Requirement snapshot test
if [[ -n "$FORK_ID" ]]; then
  curl -sf "${BASE}/lesson-plans/${FORK_ID}/link-requirement" -X POST -H "Content-Type: application/json" \
    -d '{"requirement_id":"req_1","requirement_snapshot":{"code":"7.3.2","text":"SSS","version":"v2"}}'
  curl -sf "${BASE}/lesson-plans/${FORK_ID}" | jq '.requirement_snapshot'
fi

# Promote + review test
TEACHER_TPL=$(curl -sf "${BASE}/templates?scope=teacher" | jq -r '.data[0].id // empty')
if [[ -n "$TEACHER_TPL" ]]; then
  PROMO_RESULT=$(curl -sf "${BASE}/templates/${TEACHER_TPL}/promote" -X POST -H "Content-Type: application/json" \
    -d '{"target_scope":"school","reason":"Good template"}')
  PROMO_ID=$(echo "$PROMO_RESULT" | jq -r '.id // empty')
  if [[ -n "$PROMO_ID" ]]; then
    curl -sf "${BASE}/templates/promotions/${PROMO_ID}/review" -X POST -H "Content-Type: application/json" \
      -d '{"action":"approve","comment":"Approved"}'
    SCHOOL_COUNT=$(curl -sf "${BASE}/templates?scope=school" | jq '.data | length')
    echo "School templates after promote: ${SCHOOL_COUNT}"
  fi
fi

# Activity auto-record test
TODAY=$(date +%Y-%m-%d)
ACTIVITY_COUNT=$(curl -sf "${BASE}/context/activity?date=${TODAY}" | jq '[.[] | select(.entity_type=="lesson_plan")] | length')
echo "Today's lesson_plan activities: ${ACTIVITY_COUNT}"

# Soft delete test
DEL_LP=$(curl -sf "${BASE}/lesson-plans" -X POST -H "Content-Type: application/json" \
  -d '{"title":"Delete Me","subject_id":"math","class_id":"c1"}' | jq -r '.id // empty')
if [[ -n "$DEL_LP" ]]; then
  curl -sf "${BASE}/lesson-plans/${DEL_LP}" -X DELETE
  STILL_VISIBLE=$(curl -sf "${BASE}/lesson-plans" | jq "[.data[] | select(.id==\"${DEL_LP}\")] | length")
  echo "Soft deleted LP visible in list: ${STILL_VISIBLE} (should be 0)"
fi
```

Score: 5 items × 4 = 20 pts:
1. Fork 模板→教案（blocks 正确复制）
2. 学业要求快照（link-requirement 后可读取）
3. 推优流程完整（approve 创建新模板）
4. Activity 自动记录
5. 软删除生效

### Check 4: Seed Data (D4, 10pts)

```bash
BASE="http://localhost:3011/api"

# 教案数量和状态分布
curl -sf "${BASE}/lesson-plans" | jq '{total: .total}'
curl -sf "${BASE}/lesson-plans?status=draft" | jq '{draft: .total}'
curl -sf "${BASE}/lesson-plans?status=published" | jq '{published: .total}'

# 模板数量和 scope 分布
curl -sf "${BASE}/templates" | jq '{total: .total}'
curl -sf "${BASE}/templates?scope=district" | jq '{district: .total}'

# Activity 覆盖度
curl -sf "${BASE}/context/activity/weekly-summary" | jq '.'
curl -sf "${BASE}/context/activity?date=$(date +%Y-%m-%d)" | jq 'length'
curl -sf "${BASE}/context/activity/week-dots" | jq '.days | keys | length'

# Dashboard pending
curl -sf "${BASE}/dashboard/pending" | jq '.items | length'
```

Score: 5 items × 2 = 10 pts

### Check 5: Integration (D5, 15pts)

```bash
# Build
cd solutions/business/edu-platform/backend && npm run build 2>&1 | tail -5

# Existing curriculum endpoint
curl -sf "http://localhost:3011/api/curriculum/subjects" | jq 'type'

# Existing auth endpoint (try both patterns)
curl -sf "http://localhost:3011/api/auth/login" -X POST -H "Content-Type: application/json" \
  -d '{"username":"teacher1","password":"test123"}' -o /dev/null -w "%{http_code}"

# Both DB files exist
ls -la solutions/business/edu-platform/backend/data/edu.db
ls -la solutions/business/edu-platform/backend/data/edu-typeorm.db

# edu.db not modified (check file mod time is before harness)
```

Score: 5 items × 3 = 15 pts

### Check 6: Code Quality (D6, 10pts)

```bash
# @ApiTags on all 4 controllers
grep -rn '@ApiTags' solutions/business/edu-platform/backend/src/lesson-plan/
grep -rn '@ApiTags' solutions/business/edu-platform/backend/src/template/
grep -rn '@ApiTags' solutions/business/edu-platform/backend/src/dashboard/
grep -rn '@ApiTags' solutions/business/edu-platform/backend/src/activity/

# DTO + class-validator
grep -rn 'class-validator\|@IsString\|@IsOptional\|@IsEnum' solutions/business/edu-platform/backend/src/

# 404 handling
curl -sf "http://localhost:3011/api/lesson-plans/nonexistent-uuid" -o /dev/null -w "%{http_code}"
# Should be 404

# 400 handling
curl -sf "http://localhost:3011/api/lesson-plans" -X POST -H "Content-Type: application/json" \
  -d '{}' -o /dev/null -w "%{http_code}"
# Should be 400

# Module structure
ls solutions/business/edu-platform/backend/src/lesson-plan/
ls solutions/business/edu-platform/backend/src/template/
ls solutions/business/edu-platform/backend/src/dashboard/
ls solutions/business/edu-platform/backend/src/activity/
```

Score: 5 items × 2 = 10 pts

### Cleanup

```bash
# Stop backend
kill $BACKEND_PID 2>/dev/null || true
```

## Output

**CRITICAL: The version number for this evaluation is {N}. Use exactly `v{N}` in the filename and report title. Do NOT infer or calculate a different version number from progress.md or changelogs.**

Write the evaluation report to: `solutions/business/edu-platform/harness-workspace/main-page-and-lesson-plan/backend-api/eval-reports/v{N}-eval.md`

Use this format:

```markdown
# v{N} Evaluation Report

## Pre-gate
- npm run build: PASS / FAIL (details)

## 总分: XX/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | Entity & Schema | X/5 | XX/20 | ... |
| D2 | API Completeness | X/5 | XX/25 | ... |
| D3 | Business Logic | X/5 | XX/20 | ... |
| D4 | Seed Data | X/5 | XX/10 | ... |
| D5 | Integration | X/5 | XX/15 | ... |
| D6 | Code Quality | X/5 | XX/10 | ... |

## Penalties
[List triggered penalties or "None"]

## D1 Details
[Sub-item scoring with specific findings]

## D2 Details
[Sub-item scoring — count of working endpoints]

## D3 Details
[Sub-item scoring — business logic verification results]

## D4 Details
[Sub-item scoring — seed data coverage]

## D5 Details
[Sub-item scoring — integration + regression]

## D6 Details
[Sub-item scoring — code quality checks]

## Bug Classification
For each deduction:
- **[COMPONENT]** — fixable within backend/src/ scope
- **[SYSTEM]** — requires changes outside scope
- **[DESIGN]** — needs design decision

## Actionable Fix Hints
For each [COMPONENT] deduction:
- File path + line range
- Expected fix

## Priority Fix
1. [Most impactful — dimension, file, expected fix]
2. [Second priority]
3. [Third priority]

## What's Working Well
[1-2 things the Generator should NOT change]
```
