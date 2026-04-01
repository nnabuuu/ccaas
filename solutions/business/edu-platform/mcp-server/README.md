# Edu Platform MCP Server

## Overview

基于 MCP（Model Context Protocol）的 stdio 服务器，为 Edu Platform 的 3 个 Skill 提供 7 个工具。由 CCAAS 后端通过 stdio 自动启动，无需手动运行。

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
