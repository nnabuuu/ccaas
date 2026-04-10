# Edu Platform MCP Server

## Overview

基于 MCP（Model Context Protocol）的 stdio 服务器，为 Edu Platform 的 4 个 Skill 提供 15 个工具。由 CCAAS 后端通过 stdio 自动启动，无需手动运行。

**Transport**: stdio MCP（非 HTTP）
**数据存储**: SQLite（课标知识点）+ Mock 数据（学情、教学进度）

## Tool Catalog

### Group 1: 数据查询工具

#### curriculum_tree

查询课标知识点树。返回嵌套树结构，可用于 show_info_card 的 outline section。

**输入 schema**:
```json
{
  "subject": "math",          // 必填，学科英文名
  "grade": "8",               // 可选，年级
  "parent_id": "ch12"         // 可选，父节点ID（获取子树）
}
```

**输出格式**:
```json
{
  "data": {
    "subject": "math",
    "grade": "8",
    "total_nodes": 15,
    "tree": [
      {
        "id": "ch12",
        "name": "第12章 全等三角形",
        "level": 1,
        "children": [
          { "id": "ch12-1", "name": "12.1 全等三角形", "level": 2, "children": [] }
        ]
      }
    ]
  },
  "status": "success"
}
```

#### student_proficiency

查询班级学情数据。返回班级整体指标和各知识点掌握率（含趋势）。

**输入 schema**:
```json
{
  "class_id": "c-8-2-math",   // 必填，班级ID
  "subject": "math",           // 可选，学科
  "grade": "8"                 // 可选，年级
}
```

**输出格式**:
```json
{
  "data": {
    "className": "八(2)班",
    "subject": "数学",
    "grade": "8",
    "overallAvg": 78.5,
    "totalStudents": 45,
    "passRate": 0.89,
    "excellentRate": 0.31,
    "topics": [
      { "name": "一次函数", "mastery": 0.82, "trend": "up" },
      { "name": "分式", "mastery": 0.65, "trend": "down" }
    ]
  },
  "status": "success"
}
```

#### teaching_progress

查询班级教学进度。返回当前章节、当前小节、下一小节和章节大纲。

**输入 schema**:
```json
{
  "class_id": "c-8-2-math",   // 必填，班级ID
  "subject": "math"            // 可选，学科
}
```

**输出格式**:
```json
{
  "data": {
    "current_chapter": { "id": "ch12", "name": "第12章 全等三角形" },
    "current_section": { "id": "ch12-1", "name": "12.1 全等三角形" },
    "next_section": { "id": "ch12-2", "name": "12.2 三角形全等的判定" },
    "chapter_outline": [
      {
        "id": "ch12", "label": "第12章 全等三角形",
        "children": [
          { "id": "ch12-1", "label": "12.1 全等三角形" },
          { "id": "ch12-2", "label": "12.2 三角形全等的判定" }
        ]
      }
    ],
    "progress_pct": 33
  },
  "status": "success"
}
```

### Group 2: 内容生成工具

#### generate_docx

将教案内容生成 .docx 文件并注册到文件服务。

**输入 schema**:
```json
{
  "title": "12.2 三角形全等的判定 — 教案",  // 必填，文档标题
  "content_markdown": "# 教案\n...",          // 必填，Markdown 格式内容
  "session_id": "xxx",                         // 可选，会话ID
  "tenant_id": "xxx"                           // 可选，租户ID
}
```

**输出格式**:
```json
{
  "data": {
    "fileName": "12_2_三角形全等的判定_教案.docx",
    "fileType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "downloadUrl": "/api/v1/files/12_2_三角形全等的判定_教案.docx",
    "description": "12.2 三角形全等的判定 — 教案 — 教案文档"
  },
  "status": "success"
}
```

#### write_output

将内容同步到前端显示面板。支持的字段由 `SYNC_FIELDS` 常量定义。

**输入 schema**:
```json
{
  "field": "quiz_content",     // 必填，字段名（来自 SYNC_FIELDS）
  "value": "题目内容...",       // 必填，字段值（字符串或 JSON）
  "preview": "5道选择题"        // 必填，简短预览文本
}
```

### Group 3: 交互展示工具

#### show_info_card

展示结构化信息卡片。这是 Edu Platform 最核心的交互工具。

**输入 schema**:
```json
{
  "title": "卡片标题",          // 必填
  "badge": "交互组件",          // 可选，标签文本
  "sections": [                  // 必填，区块列表
    { "type": "outline", "..." : "..." },
    { "type": "bar_list", "..." : "..." },
    { "type": "metrics", "..." : "..." },
    { "type": "actions", "..." : "..." },
    { "type": "text", "..." : "..." }
  ]
}
```

#### suggest_actions

后续操作按钮。在信息展示完毕后调用，引导用户下一步操作。

**输入 schema**:
```json
{
  "actions": [
    { "label": "按钮文字", "prompt": "点击后发送的消息" },
    { "label": "跨Skill操作", "prompt": "...", "skill_hint": "quiz-generator" }
  ]
}
```

## show_info_card Section Types

### outline — 大纲树

```json
{
  "type": "outline",
  "items": [
    {
      "id": "ch12",
      "label": "第12章 全等三角形",
      "children": [
        { "id": "ch12-1", "label": "12.1 全等三角形" },
        { "id": "ch12-2", "label": "12.2 三角形全等的判定" }
      ]
    }
  ],
  "selected_id": "ch12-2"
}
```

### bar_list — 进度条列表

```json
{
  "type": "bar_list",
  "label": "知识点掌握率",
  "compact": true,
  "items": [
    { "id": "topic1", "label": "一次函数", "value": 82 },
    { "id": "topic2", "label": "分式", "value": 65 }
  ],
  "color_thresholds": { "danger": 60, "warning": 75 }
}
```

### metrics — 指标面板

```json
{
  "type": "metrics",
  "items": [
    { "label": "班级平均分", "value": 78.5, "suffix": "分" },
    { "label": "及格率", "value": 89, "suffix": "%" },
    { "label": "优秀率", "value": 31, "suffix": "%" },
    { "label": "总人数", "value": 45, "suffix": "人" }
  ]
}
```

### actions — 操作按钮

```json
{
  "type": "actions",
  "actions": [
    { "label": "生成教案", "prompt": "为12.2生成教案", "primary": true },
    { "label": "调整范围", "prompt": "我想调整范围" }
  ]
}
```

### text — 纯文本段落

```json
{
  "type": "text",
  "content": "请选择出题参数，我将根据您的选择生成测试题。"
}
```

## Data

### SQLite 数据库

MCP Server 使用 SQLite 存储课标知识点数据。

**表结构 — curriculum_nodes**:

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PRIMARY KEY | 节点 ID |
| parent_id | TEXT | 父节点 ID |
| name | TEXT | 节点名称 |
| level | INTEGER | 层级深度 |
| subject | TEXT | 学科 |
| grade_range | TEXT | 年级范围 |
| sort_order | INTEGER | 排序权重 |
| cognitive | TEXT | 认知层次 |
| difficulty_min | REAL | 最低难度 |
| difficulty_max | REAL | 最高难度 |
| question_types | TEXT | 适用题型（JSON 数组） |
| exam_weight | REAL | 考试权重 |

### Mock 数据

`student_proficiency` 和 `teaching_progress` 当前使用内置 Mock 数据。支持的班级 ID：
- `c-8-2-math` — 八(2)班数学
- `c-8-1-math` — 八(1)班数学

## 开发

### 构建

```bash
cd mcp-server
npm install
npm run build      # tsc 编译
npx tsc --noEmit   # 类型检查（不输出文件）
```

### 添加新工具

1. 定义 `Tool` 对象（name、description、inputSchema）
2. 在 `CallToolRequestSchema` handler 中添加 `if (name === 'new_tool')` 分支
3. 在 `ListToolsRequestSchema` 的 tools 数组中注册
4. 更新本文档的 Tool Catalog 章节

### Group 3b: 交互增强工具

#### show_step_wizard

展示多步向导交互界面。用于备课等需要多步收集参数的场景。

**输入 schema**:
```json
{
  "steps": [],           // 必填，向导步骤定义
  "title": "向导标题"     // 可选
}
```

#### show_review_panel

展示审阅面板。用于内容审阅和确认场景。

**输入 schema**:
```json
{
  "content": "...",      // 必填，待审阅内容
  "title": "审阅标题"    // 可选
}
```

### Group 4: 调课工具（timetable）

调课助手（reschedule-class）专用的 6 个工具，基于共享的 SCHEDULE/TEACHERS 数据模型动态推算。

#### timetable_query_schedule

按教师/班级/周次查询课表。从共享 SCHEDULE 数据中过滤，按 day/period 排序。

**输入 schema**:
```json
{
  "teacherId": "teacher-wang",   // 可选，教师 ID
  "classId": "class-701",       // 可选，班级 ID
  "week": 1                      // 可选，周次（默认 1）
}
```

**输出**: `{ data: { schedule: [...], totalEntries: N }, status: "success" }`

#### timetable_find_available_slots

查找指定周次的空闲时段。遍历 day×period 排除已占用时段，含周末过滤、考试周检测。

**输入 schema**:
```json
{
  "week": 1,                          // 必填，周次
  "excludeTeacherId": "teacher-wang", // 可选，排除该教师已有课时
  "classIds": ["class-701"],          // 可选，排除这些班级已有课时
  "preferredDays": [1, 2, 3]          // 可选，偏好的星期
}
```

**输出**: `{ data: { slots: [...], totalSlots: N }, status: "success" }`

#### timetable_check_conflicts

5 层冲突检测：教师忙、班级忙、教室事件、同科超载、批内冲突。支持 vacatedKeys 互换配对识别。

**输入 schema**:
```json
{
  "changes": [
    {
      "teacherId": "teacher-wang",
      "classId": "class-701",
      "fromSlot": { "day": 1, "period": 1 },
      "toSlot": { "day": 1, "period": 3 }
    }
  ]
}
```

**输出**: `{ data: { conflicts: [...], severity: "none|soft|hard" }, status: "success" }`

#### timetable_submit_request

提交调课申请。写入 SUBMITTED_REQUESTS 并返回 requestId。含批内冲突安全网。

**输入 schema**:
```json
{
  "type": "swap|substitute|reschedule|makeup",
  "changes": [...],
  "reason": "调课原因"
}
```

**输出**: `{ data: { requestId: "#2025-...", status: "pending" }, status: "success" }`

#### timetable_list_my_requests

按教师 ID 查询历史调课申请（含 pending/approved/rejected 状态）。

**输入 schema**:
```json
{
  "teacherId": "teacher-wang"   // 必填，教师 ID（从 sessionContext 获取）
}
```

**输出**: `{ data: { requests: [...], total: N }, status: "success" }`

#### timetable_find_substitute_teachers

推荐代课教师。matchScore = 学科匹配(40) + 教过该班(30) + 空闲率(20) + 历史代课(10)。

**输入 schema**:
```json
{
  "subject": "数学",
  "slot": { "day": 1, "periods": [1, 2] },
  "excludeTeacherId": "teacher-wang",
  "classId": "class-701"
}
```

**输出**: `{ data: { candidates: [...], totalCandidates: N }, status: "success" }`

### 共享数据模型

调课工具基于以下共享数据：

| 数据 | 说明 |
|------|------|
| `TEACHERS` | 8 位教师信息（ID、姓名、学科、班级列表） |
| `SCHEDULE` | ~80 条周课表（teacherId、classId、day、period、subject、room） |
| `ROOM_EVENTS` | 教室占用事件（考试、活动等） |
| `SUBMITTED_REQUESTS` | 历史调课申请记录 |
