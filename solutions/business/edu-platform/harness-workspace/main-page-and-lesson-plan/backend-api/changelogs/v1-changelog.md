# v1 Changelog

## 目标
v1 基础搭建 — 安装依赖、创建 TypeORM 集成、6 个 Entity、4 个模块、25 个端点、Seed 数据。

## 修改清单

### 新增依赖
- `backend/package.json` — 添加 typeorm, @nestjs/typeorm, sqlite3, @nestjs/swagger

### TypeORM 配置
- `backend/src/typeorm/typeorm.module.ts` — TypeOrmModule.forRoot，使用独立 edu-typeorm.db
- `backend/src/typeorm/typeorm-config.ts` — DataSource 配置（migration CLI 用）

### 6 个 Entity
- `backend/src/entities/lesson-plan.entity.ts` — LessonPlan（含 requirement_snapshot, exercise_ids）
- `backend/src/entities/content-block.entity.ts` — ContentBlock（ManyToOne → LessonPlan, CASCADE）
- `backend/src/entities/lesson-plan-template.entity.ts` — LessonPlanTemplate（含 subject_ids, promotion_status）
- `backend/src/entities/template-block.entity.ts` — TemplateBlock（ManyToOne → LessonPlanTemplate, CASCADE）
- `backend/src/entities/template-promotion.entity.ts` — TemplatePromotion（ManyToOne → LessonPlanTemplate）
- `backend/src/entities/activity.entity.ts` — Activity（独立，timestamp 为 CreateDateColumn）

### 4 个模块
- `backend/src/lesson-plan/` — 12 端点（CRUD + blocks + fork + publish + export + save-as-template + link-requirement + exercises）
- `backend/src/template/` — 8 端点（CRUD + promote + promotions list + review）
- `backend/src/dashboard/` — 2 端点（pending + ai-briefing）
- `backend/src/activity/` — 3 端点（daily timeline + weekly-summary + week-dots）

### Seed 数据
- `backend/src/seed-typeorm.ts` — 3 教案 + 2 模板 + 20 Activity + 1 Promotion
  - 教案: published(8 blocks), draft(4 blocks), in_use(5 blocks)
  - 模板: district/新授课标准模板(12 blocks), teacher/几何证明课模板(10 blocks)
  - Activity: 20 条，覆盖 6 天（day-4 无记录），今天 5 条，含 7 种 entity_type
  - Dashboard pending: 2 mock + 1 real promotion = 3 条

### 模块注册
- `backend/src/app.module.ts` — 注册 TypeOrmConfigModule + 4 新模块

## 自检结果
- npm run build: **PASS** (0 errors)
- 现有端点回归: **PASS** (curriculum/subjects 返回数据)
- 新端点可用: **25/25**
- Fork 逻辑: **PASS** (template→教案 blocks 正确复制)
- Publish 逻辑: **PASS** (无 requirement 返回 warning)
- 404 处理: **PASS** (不存在的 ID 返回 404)
- Soft delete: **PASS** (is_deleted=true, 列表不显示)
- Activity 自动记录: **PASS** (CRUD 操作后 Activity 表有新记录)

## 业务逻辑实现
- Fork 模板→教案: 复制 TemplateBlock → ContentBlock，source='template'
- 推优: promote 创建 TemplatePromotion, review approve 创建新模板(scope=target_scope)
- 学业要求快照: link-requirement 保存 requirement_snapshot
- Activity 自动记录: LessonPlanService 和 TemplateService 在所有 CRUD 操作后调用 ActivityService.record()

## 本轮跳过
- 无（v1 全部基础功能已实现���
