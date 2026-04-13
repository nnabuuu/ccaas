# Eval Criteria: Backend API — TypeORM + NestJS Modules

## Pre-gate

```bash
cd solutions/business/edu-platform/backend && npm run build 2>&1
```

**编译失败 → 总分 0/100**。Evaluator 仍需报告具体错误以供 Generator 修复。

## Scoring Dimensions

| # | Dimension | Weight | Detection Method |
|---|-----------|--------|------------------|
| D1 | Entity & Schema | 20/100 | TypeORM 自动建表 + schema 检查 |
| D2 | API Completeness | 25/100 | curl 25 个端点 + 分页/筛选验证 |
| D3 | Business Logic | 20/100 | Fork/快照/推优/Activity 自动记录 |
| D4 | Seed Data | 10/100 | curl 查询数据充分性 |
| D5 | Integration | 15/100 | better-sqlite3 共存 + 现有端点回归 |
| D6 | Code Quality | 10/100 | @ApiTags + DTO + 错误处理 |

## D1: Entity & Schema (20/100)

按子项打分（每项 0-1 分，共 5 项，× 4 = 20 分）：

1. **6 实体完整**: lesson_plans, content_blocks, lesson_plan_templates, template_blocks, template_promotions, activities 全部存在
2. **字段完整**: 对照 HARNESS_SPEC 的字段定义，关键字段不缺失
3. **关系正确**: content_blocks FK → lesson_plans.id (CASCADE), template_blocks FK → lesson_plan_templates.id (CASCADE)
4. **TypeORM 自动建表**: 启动后 `edu-typeorm.db` 自动创建 6 张表
5. **数据类型正确**: simple-json 字段可存取 JSON，UUID 主键，日期字段

**Detection**:
```bash
# 启动后端 → 检查数据库文件
ls -la solutions/business/edu-platform/backend/data/edu-typeorm.db

# 检查 6 张表
sqlite3 solutions/business/edu-platform/backend/data/edu-typeorm.db ".tables"
# 期望: activities content_blocks lesson_plan_templates lesson_plans template_blocks template_promotions

# 检查关键字段
sqlite3 solutions/business/edu-platform/backend/data/edu-typeorm.db ".schema lesson_plans"
# 期望包含: requirement_id, requirement_snapshot, subject_id, class_id, status, source_template_id

# 检查 FK
sqlite3 solutions/business/edu-platform/backend/data/edu-typeorm.db ".schema content_blocks"
# 期望包含: lesson_plan_id
```

## D2: API Completeness (25/100)

按子项打分（每项 0-1 分，共 5 项，× 5 = 25 分）：

1. **LessonPlan 端点 (12)**: 全部可调用返回 2xx
2. **Template 端点 (8)**: 全部可调用返回 2xx
3. **Dashboard 端点 (2)**: 全部可调用返回 2xx
4. **Activity 端点 (3)**: 全部可调用返回 2xx
5. **分页/筛选**: GET 列表端点支持 page/limit 参数，返回 `{ data, total, page, limit }` 格式

**Detection** (后端必须在 3011 端口运行):
```bash
BASE="http://localhost:3011/api"

# LessonPlan endpoints
curl -sf "${BASE}/lesson-plans" | jq '.data | length'
curl -sf "${BASE}/lesson-plans?page=1&limit=2" | jq '{total, page, limit}'
curl -sf "${BASE}/lesson-plans?status=draft" | jq '.data | length'

# 获取第一个教案 ID
LP_ID=$(curl -sf "${BASE}/lesson-plans" | jq -r '.data[0].id')
curl -sf "${BASE}/lesson-plans/${LP_ID}" | jq '.blocks | length'

# Template endpoints
curl -sf "${BASE}/templates" | jq '.data | length'
curl -sf "${BASE}/templates?scope=district" | jq '.data | length'
TPL_ID=$(curl -sf "${BASE}/templates" | jq -r '.data[0].id')
curl -sf "${BASE}/templates/${TPL_ID}" | jq '.blocks | length'

# Dashboard endpoints
curl -sf "${BASE}/dashboard/pending" | jq '.items | length'
curl -sf "${BASE}/dashboard/ai-briefing" | jq '.insights | length'

# Activity endpoints
curl -sf "${BASE}/context/activity?date=$(date +%Y-%m-%d)" | jq 'length'
curl -sf "${BASE}/context/activity/weekly-summary" | jq '.'
curl -sf "${BASE}/context/activity/week-dots" | jq '.days | keys | length'
```

## D3: Business Logic (20/100)

按子项打分（每项 0-1 分，共 5 项，× 4 = 20 分）：

1. **Fork 模板→教案**: POST /lesson-plans 带 source_template_id → 新教案 blocks 数量 = 模板 blocks 数量
2. **学业要求快照**: POST /lesson-plans/:id/link-requirement → GET 后 requirement_snapshot 存在
3. **推优流程完整**: promote → review approve → 新模板在目标 scope 中存在
4. **Activity 自动记录**: 创建教案后查 Activity 有 lesson_plan.created 记录
5. **软删除**: DELETE 后 is_deleted=true，GET 列表不返回已删除项

**Detection**:
```bash
BASE="http://localhost:3011/api"

# Fork test
TPL_ID=$(curl -sf "${BASE}/templates?scope=district" | jq -r '.data[0].id')
TPL_BLOCKS=$(curl -sf "${BASE}/templates/${TPL_ID}" | jq '.blocks | length')
NEW_LP=$(curl -sf "${BASE}/lesson-plans" -X POST -H "Content-Type: application/json" \
  -d "{\"title\":\"Fork Test\",\"subject_id\":\"math\",\"class_id\":\"class_1\",\"source_template_id\":\"${TPL_ID}\"}" | jq -r '.id')
LP_BLOCKS=$(curl -sf "${BASE}/lesson-plans/${NEW_LP}" | jq '.blocks | length')
echo "Template blocks: ${TPL_BLOCKS}, Forked LP blocks: ${LP_BLOCKS}"

# Requirement snapshot test
curl -sf "${BASE}/lesson-plans/${NEW_LP}/link-requirement" -X POST -H "Content-Type: application/json" \
  -d '{"requirement_id":"req_1","requirement_snapshot":{"code":"7.3.2","text":"SSS/SAS判定","version":"v2.1"}}'
curl -sf "${BASE}/lesson-plans/${NEW_LP}" | jq '.requirement_snapshot'

# Promote test
TPL_ID2=$(curl -sf "${BASE}/templates?scope=teacher" | jq -r '.data[0].id')
PROMO=$(curl -sf "${BASE}/templates/${TPL_ID2}/promote" -X POST -H "Content-Type: application/json" \
  -d '{"target_scope":"school","reason":"好用"}' | jq -r '.id')
curl -sf "${BASE}/templates/promotions/${PROMO}/review" -X POST -H "Content-Type: application/json" \
  -d '{"action":"approve","comment":"通过"}'
curl -sf "${BASE}/templates?scope=school" | jq '.data | length'

# Activity auto-record test
curl -sf "${BASE}/context/activity?date=$(date +%Y-%m-%d)" | jq '[.[] | select(.action=="created" and .entity_type=="lesson_plan")] | length'

# Soft delete test
curl -sf "${BASE}/lesson-plans/${NEW_LP}" -X DELETE
curl -sf "${BASE}/lesson-plans" | jq '[.data[] | select(.id=="'${NEW_LP}'")] | length'
# Should be 0
```

## D4: Seed Data (10/100)

按子项打分（每项 0-1 分，共 5 项，× 2 = 10 分）：

1. **3 份教案**: draft/published/in_use 各一，各有 blocks
2. **2 个模板**: 区级/个人各一，各有 blocks
3. **20 条 Activity**: 覆盖 7 天，今天 ≥4 条
4. **Activity 分布合理**: 有 1 天空白，至少 1 天有 ≥3 种 entity_type
5. **Dashboard pending**: 返回 ≥2 条 mock 待办

**Detection**:
```bash
BASE="http://localhost:3011/api"

# 教案
curl -sf "${BASE}/lesson-plans" | jq '.total'  # ≥ 3
curl -sf "${BASE}/lesson-plans?status=draft" | jq '.total'  # ≥ 1
curl -sf "${BASE}/lesson-plans?status=published" | jq '.total'  # ≥ 1

# 模板
curl -sf "${BASE}/templates" | jq '.total'  # ≥ 2
curl -sf "${BASE}/templates?scope=district" | jq '.total'  # ≥ 1

# Activity 总量 + 今日
curl -sf "${BASE}/context/activity/weekly-summary" | jq '.'
curl -sf "${BASE}/context/activity?date=$(date +%Y-%m-%d)" | jq 'length'  # ≥ 4
curl -sf "${BASE}/context/activity/week-dots" | jq '.days | keys | length'  # ≥ 5

# Dashboard pending
curl -sf "${BASE}/dashboard/pending" | jq '.items | length'  # ≥ 2
```

## D5: Integration (15/100)

按子项打分（每项 0-1 分，共 5 项，× 3 = 15 分）：

1. **npm run build 零错误**: TypeScript 编译无 error
2. **npm run start:dev 启动成功**: 进程运行 + 监听 3011
3. **现有端点不受影响**: `/api/curriculum/subjects` 正常返回
4. **现有 auth 端点不受影响**: `/api/auth/login` 可用（或 `/api/auth/me` 可用）
5. **TypeORM 与 better-sqlite3 共存**: 两个数据库文件各自独立，无冲突

**Detection**:
```bash
# Build
cd solutions/business/edu-platform/backend && npm run build 2>&1 | grep -c "error TS"

# Existing endpoints
curl -sf "http://localhost:3011/api/curriculum/subjects" | jq 'length'  # > 0
# Auth endpoint — try GET /api/auth/me or POST /api/auth/login
curl -sf "http://localhost:3011/api/auth/login" -X POST -H "Content-Type: application/json" \
  -d '{"username":"teacher1","password":"test123"}' | jq 'has("access_token")'

# Coexistence
ls -la solutions/business/edu-platform/backend/data/edu.db
ls -la solutions/business/edu-platform/backend/data/edu-typeorm.db
# Both exist, edu.db unchanged
```

## D6: Code Quality (10/100)

按子项打分（每项 0-1 分，共 5 项，× 2 = 10 分）：

1. **@ApiTags 装饰器**: 4 个新 Controller 全部有 @ApiTags
2. **DTO + class-validator**: 创建/更新 DTO 使用 @IsString/@IsOptional 等
3. **404 处理**: `GET /lesson-plans/nonexistent` 返回 404
4. **400 处理**: `POST /lesson-plans` 带空 body 返回 400 + validation errors
5. **模块结构规范**: 每个模块目录含 module/controller/service/dto

**Detection**:
```bash
# @ApiTags
grep -rn '@ApiTags' solutions/business/edu-platform/backend/src/lesson-plan/ \
  solutions/business/edu-platform/backend/src/template/ \
  solutions/business/edu-platform/backend/src/dashboard/ \
  solutions/business/edu-platform/backend/src/activity/

# DTO validation
grep -rn 'class-validator' solutions/business/edu-platform/backend/src/

# 404
curl -sf "http://localhost:3011/api/lesson-plans/nonexistent-id" -o /dev/null -w "%{http_code}"
# Should be 404

# 400
curl -sf "http://localhost:3011/api/lesson-plans" -X POST -H "Content-Type: application/json" \
  -d '{}' -o /dev/null -w "%{http_code}"
# Should be 400
```

## Penalty Rules

| Rule | Deduction | Trigger |
|------|-----------|---------|
| 修改 edu.db | -20 | better-sqlite3 的数据被改动 |
| 修改冻结模块 | -15/module | database/curriculum/users/auth 被修改 |
| TypeScript 编译失败 | 总分 0 | `npm run build` 有 TS error |
| 缺少 @ApiTags | -3/controller | 新 Controller 无 @ApiTags |
| Activity 不自动记录 | -5 | CRUD 操作后 Activity 表无新记录 |

## Score Calculation

1. 每个维度: `(score / 5) × weight`
2. 基础分: 6 个维度加权分之和
3. 总分 = 基础分 - Penalty 扣分（满分 100）
4. 报告最后: `总分: XX/100`

## Summary Table Template

```markdown
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

## Priority Fix
1. [Most impactful fix]
2. [Second priority]
3. [Third priority]
```
