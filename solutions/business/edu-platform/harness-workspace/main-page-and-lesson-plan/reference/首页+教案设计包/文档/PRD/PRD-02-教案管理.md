# PRD-02 教案管理

> 版本: 2.0
> 更新日期: 2025-03-23
> 前置文档: `总体架构.md`、`PRD-01 教学资源`（课标/题库）
> 参考原型: `原型/教案管理/教案管理.html`、`原型/教案管理/模板管理.html`

---

## 1. 概述

### 1.1 系统定位

教案管理覆盖教师"备课"阶段的全部工作。核心设计理念：

**每份教案都是在回应一个具体的学业要求，不是凭空写的。**

学业要求（课标中的具体条目）是教案的锚点。教师先选定"这节课要达成什么学业要求"，再围绕这个目标设计教学内容。这不是一个可选的关联字段——它是教案存在的理由。

### 1.2 上下游关系

```
上游                          教案管理                      下游
─────────────────────    ──────────────────────    ─────────────────────
学业要求（PRD-01）        教案                      课堂执行（PRD-03）
  提供教学目标锚点          ├ 学业要求锚点              教案 → 课堂流
  区级解读指导设计          ├ 内容块列表               教案内容生成 slide
                          ├ 教学过程时间线
模板                      ├ 关联练习               作业管理（PRD-03）
  提供结构框架              └ 附件                    教案关联的练习 → 作业发布
  三级作用域流转
                                                  课堂记录（PRD-03）
题库（PRD-01）                                      教学后反思关联教案
  课堂练习选题
  AI 推荐题目
```

### 1.3 包含模块

| 编号 | 模块 | 说明 |
|------|------|------|
| A | 教案编辑 | 学业要求锚点 + 内容块编辑器 |
| B | 模板管理 | 三级作用域的教案结构模板 |
| C | 练习关联 | 在教案中关联已有练习 |
| D | 附件管理 | 教案关联文件 |

### 1.4 用户角色

| 角色 | 教案 | 模板 |
|------|------|------|
| 区管理员 | 查看全区教案 | 管理区级标准模板，审核推优申请 |
| 校管理员 | 查看本校教案 | 管理校本模板，审核推优申请 |
| 教师 | 管理个人教案 | 创建个人模板，使用所有可见模板，提交推优 |

### 1.5 Phase 范围

| 功能 | Phase 1 | Phase 2 |
|------|---------|---------|
| 学业要求锚点 | 手动选择关联 | AI 建议匹配的学业要求 |
| 内容块编辑器 | 手动编辑 | AI 辅助生成内容 |
| 模板管理 | 三级作用域 + 推优 | AI 分析使用数据推荐模板优化 |
| 练习关联 | 手动选择已有练习 | AI 推荐题目 |
| 附件管理 | 上传/管理文件 | Skill 输出自动写入附件 |

---

## 2. 模块 A：教案编辑

### 2.1 教案数据结构

```typescript
interface LessonPlan {
  id: string;
  title: string;
  display_name: string;

  // ── 学业要求锚点（核心字段）──
  requirement_id: string | null;       // 关联的学业要求条目 ID
  requirement_snapshot: {              // 创建时快照，防止课标更新导致语义漂移
    code: string;                      // 如 "7.3.2"
    text: string;                      // 如 "能运用 SSS、SAS 判定三角形全等"
    version: string;                   // 如 "v2.1"
  } | null;

  // ── 基本信息 ──
  subject_id: string;
  class_id: string;
  lesson_type: 'new' | 'review' | 'practice' | 'lab' | 'other';
  duration_minutes: number;

  // ── 内容 ──
  blocks: ContentBlock[];              // 内容块列表
  knowledge_point_ids: string[];       // 关联知识点

  // ── 模板来源 ──
  source_template_id: string | null;
  source_template_version: number | null;
  source: 'manual' | 'template' | 'ai';

  // ── 练习关联 ──
  exercise_ids: string[];              // 关联的练习实体 ID

  // ── 状态 ──
  status: 'draft' | 'published' | 'in_use' | 'archived';

  // ── 元数据 ──
  scope: 'teacher';                    // 教案始终是教师个人所有
  attachment_folder: string;
  dynamic_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
}
```

### 2.2 学业要求锚点

**为什么是锚点而不是普通的关联字段：**

- 学业要求决定了教学目标——教案的所有内容都应围绕这个目标展开
- 区级解读（`requirement.interpretation`）为教师提供具体的教学建议，直接指导教案设计
- 课标更新时，教案需要重新审视是否对齐——这是通过版本比对 `requirement_snapshot.version` vs 当前版本实现的

**创建教案时的学业要求选择流程：**

1. 教师点击"新建教案"
2. 第一步：选择学业要求（从课标树中选择或搜索）
3. 选中后显示该条目的区级解读（如果有）
4. 第二步：选择模板（模板列表按所选学业要求的学科/课型过滤）
5. 进入编辑器

也可以跳过学业要求直接创建，但列表视图会标注"未关联学业要求"的 amber 警告。

**课标版本更新提示：**

当学业要求条目更新了新版本（如区级解读从 v2.0 → v2.1）：
- 教案列表中该教案显示"课标已更新"小标签
- 编辑器中学业要求锚点区域显示横幅："关联的学业要求有新版解读，点击查看变更"
- 教师确认后更新 `requirement_snapshot`

### 2.3 内容块编辑器

Block 流式编辑器（类 Notion），详见原型。

| 类型 | 说明 |
|------|------|
| section | 章节标题 |
| text | 段落（支持 LaTeX） |
| list | 有序/无序列表 |
| table | 表格 |
| timeline | 教学环节时间线（每步有时长、内容） |
| callout | 提示框（学情备注、注意事项） |
| image | 图片（引用附件） |

编辑交互：Block 间 hover 触发"+"按钮 → 弹出类型选择器 → 插入。支持拖拽排序。每个 Block 有 handle + 删除按钮（hover 时显示）。

### 2.4 页面

**教案列表页：**

- 顶部工具栏：搜索 + 学科筛选 + 状态筛选 + "AI 备课"（次要） + "+ 新建教案"（主要）
- 列表为单栏全宽，每项显示：
  - 标题 + 状态 badge
  - 学业要求条目（teal 色带 checkmark 图标）——是列表项最显眼的信息之一
  - 未关联学业要求的教案显示 amber 警告
  - 班级 · 学科 · 课型 · 时间

**教案编辑器页：**

- 顶部：返回链接 → 标题（可编辑） → meta 选择器（班级/学科/课型/时长）
- 学业要求锚点区块（紧跟 meta 下方，在所有 Block 之前）：
  - teal 底色，显示课标编号 + 条目文本 + 区级解读摘要
  - 未关联时显示 amber 虚线框引导关联
- 内容块编辑区
- 关联练习区
- 侧边栏（200px）：关联资源链接 + 模板列表 + 文件管理

### 2.5 API

```
# 教案 CRUD
GET    /api/v1/lesson-plans?subject_id=&status=&has_requirement=&q=&page=&limit=
GET    /api/v1/lesson-plans/{id}
POST   /api/v1/lesson-plans
POST   /api/v1/lesson-plans/{id}
POST   /api/v1/lesson-plans/{id}/delete

# 学业要求关联
POST   /api/v1/lesson-plans/{id}/link-requirement
       { requirement_id }
       → 自动创建 requirement_snapshot

# 课标版本检查
GET    /api/v1/lesson-plans/{id}/requirement-status
       → { current_version, snapshot_version, has_update, diff_summary }

# 内容块操作
GET    /api/v1/lesson-plans/{id}/blocks
POST   /api/v1/lesson-plans/{id}/blocks
POST   /api/v1/lesson-plans/{id}/blocks/{block_id}
POST   /api/v1/lesson-plans/{id}/blocks/reorder  { block_ids: string[] }
POST   /api/v1/lesson-plans/{id}/blocks/{block_id}/delete

# 导出
GET    /api/v1/lesson-plans/{id}/export?format=docx|pdf

# 筛选参数
has_requirement=true|false    # 按是否关联学业要求过滤
```

### 2.6 业务规则

1. 教案的学业要求关联时创建快照（`requirement_snapshot`），后续课标更新不自动改变教案内容
2. 学业要求不是必填字段（Phase 1），但未关联的教案在列表中显示 amber 警告
3. 教案状态变为"已发布"时，如果未关联学业要求，弹出确认："此教案未关联学业要求，确定发布？"
4. 教案关联练习时不直接管理题目——练习实体由练习设计模块创建
5. 自动保存：编辑器每 30 秒或失焦时自动保存

---

## 3. 模块 B：模板管理

### 3.1 概念

教案模板是一组预定义的内容块结构，帮助教师快速创建符合规范的教案。

模板的核心价值：
- **结构规范化**：区级模板定义"一份好教案应该有什么结构"
- **效率提升**：教师不需要每次从空白开始
- **方法论沉淀**：优秀教师的教案结构可以通过推优机制分享给全校/全区

### 3.2 模板数据结构

```typescript
interface LessonPlanTemplate {
  id: string;
  name: string;                         // 如 "新授课标准模板"
  description: string;                  // 简短说明
  lesson_type: string;                  // 适用课型
  subject_ids: string[];                // 适用学科（空 = 通用）

  // ── 结构定义 ──
  blocks: TemplateBlock[];              // 模板内容块（content 为提示文字）
  block_summary: string;                // 结构摘要，如 "教学目标 → 重难点 → 教学过程 → ..."

  // ── 三级作用域 ──
  scope: 'district' | 'school' | 'teacher';
  scope_id: string;                     // 对应的 district_id / school_id / teacher_id
  visibility: 'public' | 'private';     // 个人模板可设为私有

  // ── 版本 ──
  version: number;
  changelog: string;                    // 本版变更说明

  // ── 统计 ──
  usage_count: number;                  // 被用来创建教案的次数
  last_used_at: string;

  // ── 推优 ──
  source_template_id: string | null;    // Fork 来源
  promotion_status: 'none' | 'pending' | 'approved' | 'rejected';
}

interface TemplateBlock {
  type: string;                         // section / text / timeline / table / callout
  placeholder: string;                  // 提示文字，如 "在此填写教学目标"
  is_required: boolean;                 // 是否为必要区块（仅建议，不强制）
}
```

### 3.3 三级作用域

遵循总体架构的模式 A（继承 + 扩展）：

| 级别 | 示例 | 管理者 | 可见范围 |
|------|------|--------|---------|
| 区级 | "新授课标准模板" | 区管理员 | 全区所有教师 |
| 校本 | "项目式学习模板" | 校管理员 | 本校教师 |
| 个人 | 教师自己常用的结构 | 教师 | 仅自己（可推优） |

教师新建教案时，模板选择列表**合并显示三级模板**，按作用域分组，标注来源和使用次数。

### 3.4 模板与教案的关系（Fork 模型）

从模板创建教案时：

1. **完整复制**：模板的内容块结构复制到新教案，`source_template_id` 记录来源
2. **独立编辑**：教师自由修改，不影响源模板
3. **版本更新提示**：源模板发布新版本时，编辑器顶部一次性横幅提示。教师可查看对比、应用更新或忽略
4. **保存为模板**：教师可将现有教案的结构保存为个人模板

### 3.5 推优机制

教师的个人模板可以逐级推优：

```
个人模板 →[教师提交]→ 校级审核 →[校管理员批准]→ 校本模板
校本模板 →[校管理员提交]→ 区级审核 →[区管理员批准]→ 区级模板
```

推优提交时需要填写：模板名称、适用课型、结构说明、推荐理由。

审核者可以：批准（原样或修改后发布）、驳回（附理由）、建议修改（退回给提交者）。

### 3.6 页面

**模板管理页（独立页面）：**

- 三个 tab：区级模板 / 校本模板 / 我的模板
- 每个模板卡片显示：名称、适用课型、结构摘要（block 名称序列）、使用次数、来源/状态
- 操作：编辑（进入模板编辑器）、删除（仅自己的）、推优提交
- 区/校管理员额外看到：审核中的推优申请

**模板编辑器：**

- 和教案编辑器共用同一个 Block 编辑器组件
- 但不显示学业要求锚点和练习关联（模板只定义结构）
- Block 的 content 为 placeholder 提示文字
- 每个 Block 可标记为 "建议保留"（is_required），在教师使用模板时显示为灰色标识

**在教案编辑器中使用模板：**

- 新建教案时第二步选择模板（第一步是选学业要求）
- 编辑器侧边栏"模板"区域列出可用模板，点击可替换当前结构（需确认）
- 侧边栏显示当前教案的来源模板和版本

### 3.7 API

```
# 模板 CRUD
GET    /api/v1/templates?scope=&subject_id=&lesson_type=&q=&page=&limit=
GET    /api/v1/templates/{id}
POST   /api/v1/templates
POST   /api/v1/templates/{id}
POST   /api/v1/templates/{id}/delete

# 从教案保存为模板
POST   /api/v1/lesson-plans/{id}/save-as-template
       { name, description }
       → 提取 blocks 结构，content 保留为参考

# 推优
POST   /api/v1/templates/{id}/promote
       { target_scope, reason }
GET    /api/v1/templates/promotions?status=pending
       -- 管理员查看待审核列表
POST   /api/v1/templates/promotions/{id}/review
       { action: 'approve' | 'reject' | 'revise', comment }

# Fork（从上级模板复制到个人）
POST   /api/v1/templates/{id}/fork
```

### 3.8 业务规则

1. 模板复制到教案时完整复制 blocks，后续修改互不影响
2. 模板的 blocks 不包含作业配置和学业要求（这些是教案实例的属性）
3. "保存为模板"提取 blocks 结构，保留 content 为参考（教师可修改为提示文字）
4. 推优审核通过后，原个人模板保留，新的校/区级模板是独立实体
5. 区/校级模板更新版本号时，自动触发基于该模板创建的教案的版本提醒

---

## 4. 模块 C：练习关联

### 4.1 概念

教案可以关联一个或多个练习实体。练习由练习设计模块创建和管理（PRD-03），教案只做关联引用。

### 4.2 交互

- 编辑器底部"关联练习"区域，列出已关联的练习
- "选择练习"按钮打开练习选择器（弹窗），显示当前教师的练习列表，按学业要求和知识点过滤
- 关联后练习在教案编辑器中可见，但编辑跳转到练习设计模块

### 4.3 API

```
POST   /api/v1/lesson-plans/{id}/link-exercise    { exercise_id }
POST   /api/v1/lesson-plans/{id}/unlink-exercise   { exercise_id }
GET    /api/v1/lesson-plans/{id}/exercises
```

---

## 5. 模块 D：附件管理

每个教案通过 `/{id}/attachments` 接口管理关联资源。

| 类型 | 示例 |
|------|------|
| file | 课件.pptx、板书设计.png |
| entity_ref | 关联的课程要求、知识点 |
| ai_output | Skill 输出的分析结果 |

附件存储在教案的专属目录下。编辑器侧边栏"文件"区域展示文件列表，支持上传和下载。

---

## 6. 活动追踪

教案模块需要发出以下 Activity 事件（供首页动态、推荐排序使用）：

| 事件 | 触发时机 |
|------|---------|
| lesson_plan.created | 教案创建 |
| lesson_plan.updated | 教案内容修改（含具体变更摘要，如"更新了内容块 SAS 判定条件"） |
| lesson_plan.published | 教案状态变为已发布 |
| lesson_plan.requirement_linked | 关联学业要求 |
| lesson_plan.exercise_linked | 关联练习 |
| template.created | 模板创建 |
| template.promoted | 模板提交推优 |
| template.promotion_approved | 推优审核通过 |

---

## 7. 验收标准

### 教案编辑

- [ ] 新建教案时可以选择学业要求，选中后编辑器顶部显示锚点区块
- [ ] 未关联学业要求的教案在列表中显示 amber 警告
- [ ] 课标版本更新时，关联教案显示更新提示
- [ ] 内容块编辑器支持 7 种 block 类型的增删改排序
- [ ] 自动保存
- [ ] 导出 Word / PDF

### 模板管理

- [ ] 三级模板列表合并展示，标注来源和使用次数
- [ ] 从模板创建教案时完整复制 blocks 结构
- [ ] 教师可将教案保存为个人模板
- [ ] 推优流程：提交 → 审核 → 批准/驳回
- [ ] 模板版本更新时，基于该模板创建的教案收到提示

### 练习关联

- [ ] 教案编辑器中可关联/取消关联练习
- [ ] 练习选择器按学业要求和知识点过滤

### 通用

- [ ] 所有操作发出对应的 Activity 事件
- [ ] 教案列表支持按学科、状态、是否关联学业要求筛选
