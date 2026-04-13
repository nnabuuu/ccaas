# SPEC: Backend API — TypeORM + NestJS Modules

## Goal

在 edu-platform 现有 NestJS 后端中新增 TypeORM 集成 + 6 个 Entity + 4 个模块 + 25 个 REST 端点 + seed 数据，实现教案管理、模板管理、首页仪表盘和活动时间线 API。现有模块不受影响。

## Scope

| 包含 | 不包含 |
|------|--------|
| TypeORM 配置（独立 .sqlite 文件） | 前端页面 |
| 6 个 Entity 定义 | MCP 工具修改 |
| 25 个 REST 端点 | Skill prompt 修改 |
| Seed 数据（3 教案 + 2 模板 + 20 Activity + 3 待办 mock） | 外部系统对接 |
| app.module.ts 注册新模块 | WebSocket/SSE |
| 所有新 Controller 的 @ApiTags | |

## Work Items

### W1: TypeORM 集成

在 `backend/src/typeorm/` 下创建 TypeORM 配置模块：
- `typeorm.module.ts` — `TypeOrmModule.forRoot({ type: 'sqlite', database: '../data/edu-typeorm.db', synchronize: true })`
- `typeorm-config.ts` — DataSource 配置（用于 migration CLI）
- 依赖安装：`typeorm @nestjs/typeorm sqlite3`
- 与现有 better-sqlite3 共存（使用独立 .sqlite 文件）

### W2: 6 个 Entity

| Entity | 表名 | 关键关系 |
|--------|------|----------|
| LessonPlan | lesson_plans | OneToMany → ContentBlock |
| ContentBlock | content_blocks | ManyToOne → LessonPlan (CASCADE) |
| LessonPlanTemplate | lesson_plan_templates | OneToMany → TemplateBlock |
| TemplateBlock | template_blocks | ManyToOne → LessonPlanTemplate (CASCADE) |
| TemplatePromotion | template_promotions | ManyToOne → LessonPlanTemplate |
| Activity | activities | 独立 |

所有 Entity 完整字段定义见 HARNESS_SPEC_A_BACKEND.md §2。

### W3: LessonPlanModule（12 端点）

Controller `@ApiTags('lesson-plans')`：
- `GET /lesson-plans` — 列表（分页 + subject_id/status/class_id/has_requirement/q 筛选）
- `GET /lesson-plans/:id` — 详情（含 blocks 按 sort_order）
- `POST /lesson-plans` — 新建（支持 source_template_id fork 模板）
- `PUT /lesson-plans/:id` — 更新元信息
- `DELETE /lesson-plans/:id` — 软删除
- `POST /lesson-plans/:id/blocks` — 批量更新 blocks（全量替换）
- `POST /lesson-plans/:id/link-requirement` — 关联学业要求（存快照）
- `GET /lesson-plans/:id/requirement-status` — 检查课标版本更新
- `POST /lesson-plans/:id/exercises` — 关联练习
- `POST /lesson-plans/:id/publish` — 发布
- `POST /lesson-plans/:id/export` — 导出
- `POST /lesson-plans/:id/save-as-template` — 保存为模板

**Fork 逻辑**：source_template_id 非空时，读取模板 blocks → 复制为 ContentBlock。

### W4: TemplateModule（8 端点）

Controller `@ApiTags('templates')`：
- `GET /templates` — 列表（scope/subject_id/lesson_type/q 筛选）
- `GET /templates/:id` — 详情（含 blocks）
- `POST /templates` — 新建
- `PUT /templates/:id` — 更新
- `DELETE /templates/:id` — 软删除
- `POST /templates/:id/promote` — 提交推优
- `GET /templates/promotions` — 推优列表
- `POST /templates/promotions/:id/review` — 审核推优（approve 创建新模板）

### W5: DashboardModule（2 端点）

Controller `@ApiTags('dashboard')`：
- `GET /dashboard/pending` — 待办事项（mock + 真实 TemplatePromotion）
- `GET /dashboard/ai-briefing` — AI 洞察摘要（mock insights + suggested_actions）

### W6: ActivityModule（3 端点）

Controller `@ApiTags('activity')`：
- `GET /context/activity` — 某日活动时间线
- `GET /context/activity/weekly-summary` — 本周统计
- `GET /context/activity/week-dots` — 7 天活动色点

ActivityService 同时提供 `record()` 内部方法，由 LessonPlanService 和 TemplateService 自动调用。

### W7: Seed 数据

`backend/src/seed-typeorm.ts`：
- 3 份教案（draft/published/in_use 各一），含完整 blocks
- 2 个模板（区级/个人各一），含 blocks
- 20 条 Activity（覆盖 7 天，今天 ≥4 条，有 1 天空白）
- Dashboard pending 端点返回 3 条 mock 待办

### W8: app.module.ts 更新

注册 TypeOrmConfigModule + LessonPlanModule + TemplateModule + DashboardModule + ActivityModule。

## Frozen Constraints

**不可修改的文件：**
- `backend/src/database/` — 现有 better-sqlite3 模块冻结
- `backend/src/curriculum/` — 课标模块冻结
- `backend/src/users/` — 用户模块冻结（可读取 users 表数据）
- `backend/src/auth/` — 认证模块冻结（新端点可复用 AuthGuard）
- `backend/data/edu.db` — 现有数据库文件冻结
- `solutions/business/edu-platform/frontend/` — 前端冻结
- `solutions/business/edu-platform/mcp-server/` — MCP server 冻结
- `solutions/business/edu-platform/skills/` — Skills 冻结

**必须遵守的规则：**
- TypeORM 使用独立 `.sqlite` 文件（`backend/data/edu-typeorm.db`），不操作 `edu.db`
- 所有新 Controller 必须有 `@ApiTags` 装饰器
- 使用 NestJS DTO + class-validator 做参数校验
- 端点路径以 `/api` 前缀（已在 main.ts 全局设置）
- 分页接口统一返回 `{ data: T[], total: number, page: number, limit: number }`
- Activity 记录自动写入（在 service 层 hook），不需要前端手动调用
- 现有 `npm run build` 和 `npm run start:dev` 必须继续正常工作
- 现有 `GET /api/curriculum/*` 和 `POST /api/auth/*` 端点行为不变

## Modifiable Files

| 文件 | 操作 | 预期变更 |
|------|------|----------|
| `backend/src/app.module.ts` | MODIFY | 注册 TypeORM + 4 新模块 |
| `backend/src/typeorm/` | NEW | TypeORM 配置 |
| `backend/src/entities/` | NEW | 6 个 Entity |
| `backend/src/lesson-plan/` | NEW | LessonPlanModule (controller + service + DTOs) |
| `backend/src/template/` | NEW | TemplateModule (controller + service + DTOs) |
| `backend/src/dashboard/` | NEW | DashboardModule (controller + service) |
| `backend/src/activity/` | NEW | ActivityModule (controller + service) |
| `backend/src/seed-typeorm.ts` | NEW | Seed 脚本 |
| `backend/package.json` | MODIFY | 添加 typeorm/@nestjs/typeorm/sqlite3 依赖 |
