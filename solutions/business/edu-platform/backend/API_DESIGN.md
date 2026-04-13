# Edu-Platform API Design

## 四层架构总览

### Layer 1: Solution-Native CRUD

教案和模板的基本增删改查，完全由 solution backend 管理。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/lesson-plans` | GET | 分页列表（含筛选） |
| `/api/lesson-plans/:id` | GET | 详情 + blocks |
| `/api/lesson-plans` | POST | 创建（可 fork 模板） |
| `/api/lesson-plans/:id` | PUT | 更新元数据 |
| `/api/lesson-plans/:id` | DELETE | 软删除 |
| `/api/lesson-plans/:id/blocks` | POST | 替换 blocks |
| `/api/lesson-plans/:id/publish` | POST | 发布 |
| `/api/lesson-plans/:id/link-requirement` | POST | 关联学业要求 |
| `/api/lesson-plans/:id/exercises` | POST | 关联习题 |
| `/api/lesson-plans/:id/save-as-template` | POST | 转为模板 |
| `/api/templates` | GET | 分页列表 |
| `/api/templates/:id` | GET | 详情 + blocks |
| `/api/templates` | POST | 创建 |
| `/api/templates/:id` | PUT | 更新 |
| `/api/templates/:id` | DELETE | 软删除 |
| `/api/templates/:id/promote` | POST | 提交推优 |
| `/api/templates/promotions` | GET | 推优队列 |
| `/api/templates/promotions/:id/review` | POST | 审批推优 |
| `/api/curriculum/*` | GET | 课标树（静态数据）|

### Layer 2: CCAAS-AI Proxy

需要 AI 能力的端点。当前 **mock 实现**（标记为 `// CCAAS-AI: mock`），未来通过用户的 `ccaasApiKey` 调用 CCAAS Core。

| 端点 | 方法 | 当前状态 | 未来方向 |
|------|------|----------|----------|
| `/api/dashboard/ai-briefing` | GET | 硬编码 mock | 调用 CCAAS Session API |
| `/api/lesson-plans/:id/export` | POST | 返回假 URL | 调用 MCP `generate_docx` |
| `/api/lesson-plans/:id/requirement-status` | GET | 空壳 | 调用 curriculum AI |

### Layer 3: CCAAS Component Integration

| 端点 | 方法 | 集成方式 |
|------|------|----------|
| `/api/auth/register` | POST | 本地创建用户 + CCAAS Core 获取 API key |
| `/api/auth/login` | POST | 本地 JWT + 解密 ccaasApiKey |
| `/api/auth/me` | GET | 本地 JWT guard |

Activity 系统保持 solution 独立（CCAAS events 追踪 AI 会话，Edu Activity 追踪教学操作）。

### Layer 4: BFF 聚合层

| 端点 | 方法 | 服务的页面 | 聚合内容 |
|------|------|-----------|----------|
| `/api/dashboard/pending` | GET | HomePage FocusCard | mock 批改 + 真实 TemplatePromotion |
| `/api/context/activity` | GET | HomePage Timeline | Activity（detail 序列化为 string） |
| `/api/context/activity/weekly-summary` | GET | HomePage HeroSection | 7天编辑数 + 批改数 |
| `/api/context/activity/week-dots` | GET | HomePage WeekStrip | 日历活动点 |

---

## 端点契约

### GET /api/lesson-plans

**Query Parameters:**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `page_size` | number | 20 | 每页条数（兼容 `limit`） |
| `subject_id` | string | - | 学科 ID 筛选 |
| `status` | string | - | 状态筛选 |
| `class_id` | string | - | 班级 ID 筛选 |
| `has_requirement` | string | - | `'true'`/`'false'` |
| `q` | string | - | 标题搜索 |

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "12.2 三角形全等的判定 — SSS/SAS",
      "class_name": "八(2)班",
      "subject": "数学",
      "lesson_type": "new",
      "duration": 40,
      "status": "published",
      "requirement": {
        "id": "kp:math.triangle.cong.conditions",
        "code": "7.3.2",
        "text": "掌握 SSS、SAS 判定全等三角形的方法",
        "version": "v2.0"
      },
      "updated_at": "2026-04-13T10:15:00.000Z"
    }
  ],
  "total": 3,
  "page": 1,
  "page_size": 20
}
```

### GET /api/lesson-plans/:id

**Response:**
```json
{
  "id": "uuid",
  "title": "12.2 三角形全等的判定 — SSS/SAS",
  "class_name": "八(2)班",
  "subject": "数学",
  "lesson_type": "new",
  "duration": 40,
  "status": "published",
  "blocks": [
    { "id": "uuid", "type": "section", "content": { "text": "教学目标" }, "sort_order": 0 }
  ],
  "source_template_id": "uuid",
  "requirement": {
    "id": "kp:...",
    "code": "7.3.2",
    "text": "...",
    "version": "v2.0"
  },
  "created_at": "2026-04-12T14:00:00.000Z",
  "updated_at": "2026-04-13T10:15:00.000Z"
}
```

### POST /api/lesson-plans

**Request Body:**
```json
{
  "title": "新教案",
  "subject": "数学",
  "class_name": "八(2)班",
  "lesson_type": "new",
  "duration": 45,
  "source_template_id": "uuid (optional)"
}
```

DTO 同时接受 `subject_id`/`subject` 和 `class_id`/`class_name`，service 做反向查找。

### GET /api/templates

**Query Parameters:**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `page_size` | number | 20 | 每页条数 |
| `scope` | string | - | `teacher`/`school`/`district` |
| `subject_id` | string | - | 学科 ID |
| `lesson_type` | string | - | 课型 |
| `q` | string | - | 名称搜索 |

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "新授课标准模板",
      "description": "区级标准新授课模板...",
      "lesson_type": "new",
      "subject": "数学",
      "scope": "district",
      "version": "v1.0",
      "usage_count": 12,
      "promotion_status": "(omitted when 'none')",
      "block_summary": ["教学目标", "教学重难点", "教学过程", "课堂练习", "板书设计", "课后反思"]
    }
  ],
  "total": 2,
  "page": 1,
  "page_size": 20
}
```

### GET /api/templates/:id

**Response:**
```json
{
  "id": "uuid",
  "name": "新授课标准模板",
  "description": "...",
  "lesson_type": "new",
  "subject": "数学",
  "scope": "district",
  "version": "v1.0",
  "blocks": [
    { "id": "uuid", "type": "section", "content": { "text": "教学目标" }, "sort_order": 0, "placeholder": "教学目标", "is_required": true }
  ],
  "usage_count": 12,
  "created_at": "...",
  "updated_at": "..."
}
```

### POST /api/templates

**Request Body:**
```json
{
  "name": "新模板",
  "description": "描述",
  "lesson_type": "new",
  "subject": "数学",
  "scope": "teacher",
  "blocks": [
    { "type": "section", "placeholder": "教学目标", "content": {}, "is_required": true, "sort_order": 0 }
  ]
}
```

### GET /api/context/activity

**Query:** `date=YYYY-MM-DD` (default: today), `user_id`, `limit`

**Response:**
```json
{
  "items": [
    {
      "entity_type": "lesson_plan",
      "entity_id": "uuid",
      "entity_display_name": "12.2 三角形全等的判定",
      "action": "published",
      "detail": "",
      "timestamp": "2026-04-13T10:15:00.000Z"
    },
    {
      "entity_type": "lesson_plan",
      "entity_id": "uuid",
      "entity_display_name": "12.2 三角形全等的判定",
      "action": "updated",
      "detail": "更新了内容块 'SAS 判定条件'",
      "timestamp": "2026-04-13T09:30:00.000Z"
    }
  ],
  "total": 5
}
```

**`detail` 字段**：JSON → 可读字符串转换规则见 `shared/lookup-maps.ts#formatActivityDetail()`。

### GET /api/context/activity/weekly-summary

**Response:** `{ "lesson_plan_edits": 8, "submissions_graded": 2 }`

### GET /api/context/activity/week-dots

**Query:** `week_start=YYYY-MM-DD`, `user_id`

**Response:** `{ "days": { "2026-04-13": ["lesson_plan", "homework"] } }`

### GET /api/dashboard/pending

**Response:** `{ "items": [...PendingItem], "total": 3 }`

### GET /api/dashboard/ai-briefing (CCAAS-AI: mock)

**Response:** `{ "insights": [...AIInsight], "common_actions": [...SuggestedAction] }`

---

## 响应转换规则

### DB Entity → API Response 映射

| DB 字段 | API 字段 | 转换 |
|---------|----------|------|
| `subject_id: 'math'` | `subject: '数学'` | `resolveSubjectName()` |
| `class_id: 'class_802'` | `class_name: '八(2)班'` | `resolveClassName()` |
| `duration_minutes: 40` | `duration: 40` | 重命名 |
| `requirement_id` + `requirement_snapshot` | `requirement: { id, code, text, version }` | 组合 |
| Template `subject_ids: ['math']` | `subject: '数学'` | join + resolve |
| Template `version: 1` | `version: 'v1.0'` | `formatVersion()` |
| Template `promotion_status: 'none'` | `promotion_status: undefined` | 过滤 |
| Template blocks (section) | `block_summary: string[]` | 提取 section 标题 |
| Activity `detail: { ... }` (JSON) | `detail: string` | `formatActivityDetail()` |
| 分页 `{ data, total, page, limit }` | `{ items, total, page, page_size }` | 重命名 |

### 输入 DTO 反向查找

| 前端发送 | DTO 字段 | 转换为 | 函数 |
|----------|----------|--------|------|
| `subject: '数学'` | `subject` | `subject_id: 'math'` | `resolveSubjectId()` |
| `class_name: '八(2)班'` | `class_name` | `class_id: 'class_802'` | `resolveClassId()` |
| `duration: 45` | `duration` | `duration_minutes: 45` | 直接赋值 |

DTO 同时接受 ID 和显示名。优先使用 ID（`subject_id`），fallback 到显示名（`subject`）。

---

## CCAAS 集成边界

### 当前 Mock

- `DashboardService.getAiBriefing()` — 硬编码 insights + actions
- `DashboardService.getPending()` — mock 批改任务 + 真实 TemplatePromotion
- `LessonPlanService.exportDocx()` — 返回假 URL
- `LessonPlanService.getRequirementStatus()` — 返回固定 "当前版本是最新"

### 未来演进

1. **ai-briefing** → 调用 CCAAS Session API，查询最近 Skill 运行结果
2. **export** → 调用 MCP 工具 `generate_docx` 生成真实 DOCX
3. **requirement-status** → 调用 curriculum AI 检查版本差异
4. **pending** → 整合真实作业批改模块数据

### 不集成 CCAAS 的决策

**Activity 系统保持 solution 独立**，原因：
- CCAAS events 追踪 AI 会话交互（SSE、tool_activity）
- Edu Activity 追踪教学领域操作（教案编辑、模板推优）
- 两者互补，不重叠

---

## 设计决策记录

### 1. 后端适配前端类型

前端 types/*.ts 已定义完整接口，后端做 response transformation 而非修改前端。

### 2. ID → 显示名的静态查找表

使用 `shared/lookup-maps.ts` 而非数据库查询，因为学科和班级是有限枚举，不需要动态查询。

### 3. DTO 兼容性

同时接受 `subject_id`/`subject` 和 `class_id`/`class_name`，向后兼容原有调用方。

### 4. 分页参数兼容

接受 `page_size` 和 `limit`，`page_size` 优先。

### 5. Seed Data 用户 ID

支持 `--user-id` 参数，方便用真实注册用户 ID 创建 seed 数据。
