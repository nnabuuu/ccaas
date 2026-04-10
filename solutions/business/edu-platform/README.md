# Edu Platform（精准教学平台）

## 概述

精准教学平台 Solution，为中小学教师提供 AI 驱动的备课、出题、学情分析、调课一体化服务。基于 CCAAS 平台的 MCP 工具体系，通过 `show_info_card` 展示结构化数据，`suggest_actions` 驱动多 Skill 协同工作流。

## 快速开始

### 环境要求

- Node.js 18+
- CCAAS 平台后端运行中（默认 `http://localhost:3001`）
- SQLite3（MCP Server 使用 SQLite 存储课标知识点数据）

### 安装

```bash
cd solutions/business/edu-platform
npm install

# 构建 MCP Server
cd mcp-server
npm run build
```

### 启动

```bash
# 1. 确保 CCAAS 后端运行中
npm run dev:backend  # 在项目根目录

# 2. MCP Server 由 CCAAS 后端自动通过 stdio 启动，无需手动运行
```

### 首次使用：注册 Skill

通过 CCAAS Admin 后台或 API 注册 4 个 Skill：

```bash
# 注册 lesson-plan-generator
curl -X POST http://localhost:3001/api/v1/skills \
  -H "Content-Type: application/json" \
  -d '{"slug": "lesson-plan-generator", "name": "备课助手"}'

# 注册 quiz-generator
curl -X POST http://localhost:3001/api/v1/skills \
  -H "Content-Type: application/json" \
  -d '{"slug": "quiz-generator", "name": "出题专家"}'

# 注册 student-analysis
curl -X POST http://localhost:3001/api/v1/skills \
  -H "Content-Type: application/json" \
  -d '{"slug": "student-analysis", "name": "学情分析"}'

# 注册 reschedule-class
curl -X POST http://localhost:3001/api/v1/skills \
  -H "Content-Type: application/json" \
  -d '{"slug": "reschedule-class", "name": "调课助手"}'
```

## 四个 Skill

### 1. 备课助手（lesson-plan-generator）

智能感知上下文的备课对话。自动获取教学进度和班级学情，通过 `show_info_card` 展示备课向导（章节大纲 + 学情提示 + 操作按钮），生成完整教案并导出 .docx 文件。

**交互流程**：
1. 教师说"备课" → 自动调用 `teaching_progress` + `student_proficiency`
2. 展示备课向导卡片（outline + bar_list + actions）
3. 教师选择 → 生成教案 → `generate_docx` 导出文件
4. `suggest_actions` 提供后续操作（配套练习题、调整教案、生成课件）

### 2. 出题专家（quiz-generator）

根据知识点和难度生成随堂测试题。自动获取知识点树和学情数据，智能匹配出题难度和侧重点。

**交互流程**：
1. 教师说"出题" → 自动调用 `curriculum_tree` + `teaching_progress` + `student_proficiency`
2. 展示出题向导卡片（知识点大纲 + 学情掌握率 + 题型选项）
3. 教师选择 → 生成题目 → `write_output` 同步到面板
4. `suggest_actions` 提供后续操作（查看解析、再出一组、生成教案）

### 3. 学情分析（student-analysis）

调用学情数据展示班级知识点掌握情况，识别薄弱环节并给出教学建议。

**交互流程**：
1. 教师说"看学情" → 自动调用 `student_proficiency` + `teaching_progress`
2. 展示学情概览卡片（指标面板 + 知识点掌握率条形图 + 操作按钮）
3. 教师选择 → 深入分析薄弱知识点 → 给出补救方案
4. `suggest_actions` 引导到备课助手或出题专家（跨 Skill 协同）

### 4. 调课助手（reschedule-class）

智能调课对话。支持互换、代课、改时、补课四种调课类型，自动查询课表、检测冲突、推荐代课教师，通过确认门控保障操作安全。

**交互流程**：
1. 教师说"换课" → 自动调用 `timetable_query_schedule` 查询课表
2. 按类型搜索方案（互换/代课/改时/补课）
3. `timetable_check_conflicts` 检测冲突 → `show_info_card` 展示变更方案
4. `suggest_actions` 提供 [确认提交][修改方案][取消] 按钮
5. 教师确认后 → `timetable_submit_request` 提交调课申请

**支持场景**：互换（swap）、代课（substitute）、改时（reschedule）、补课（makeup）、模糊描述、状态查询

## MCP 工具

### 基础工具（7 个）

| # | 工具名 | 用途 | 使用场景 |
|---|--------|------|---------|
| 1 | `curriculum_tree` | 查询课标知识点树 | 出题选择知识点范围 |
| 2 | `student_proficiency` | 查询班级学情数据 | 备课、出题、学情分析 |
| 3 | `teaching_progress` | 查询教学进度 | 确定当前教学内容 |
| 4 | `generate_docx` | 生成 .docx 文件 | 导出教案、试卷 |
| 5 | `write_output` | 同步内容到前端面板 | 逐步展示生成内容 |
| 6 | `show_info_card` | 展示结构化信息卡片 | 向导、数据可视化 |
| 7 | `suggest_actions` | 后续操作按钮 | 引导下一步操作 |

### 交互增强工具（2 个）

| # | 工具名 | 用途 | 使用场景 |
|---|--------|------|---------|
| 8 | `show_step_wizard` | 多步向导交互 | 备课向导流程 |
| 9 | `show_review_panel` | 审阅面板展示 | 内容审阅确认 |

### 调课工具（6 个）

| # | 工具名 | 用途 | 使用场景 |
|---|--------|------|---------|
| 10 | `timetable_query_schedule` | 按教师/班级/周次查询课表 | 调课前确认课时 |
| 11 | `timetable_find_available_slots` | 查找空闲时段 | 改时/补课搜索可用时段 |
| 12 | `timetable_check_conflicts` | 5 层冲突检测 | 提交前安全验证 |
| 13 | `timetable_submit_request` | 提交调课申请 | 用户确认后提交 |
| 14 | `timetable_list_my_requests` | 查询历史调课申请 | 查看申请状态 |
| 15 | `timetable_find_substitute_teachers` | 推荐代课教师 | 按 matchScore 排序 |

### show_info_card Section Types

| Type | 用途 | 典型场景 |
|------|------|---------|
| `outline` | 大纲树（含 selected_id） | 章节选择、知识点浏览 |
| `bar_list` | 进度条列表（含 color_thresholds） | 知识点掌握率 |
| `metrics` | 指标面板（label/value/suffix） | 班级整体数据 |
| `actions` | 操作按钮（label/prompt/primary） | 用户交互选项 |
| `text` | 纯文本段落 | 说明文字 |

## 配置

核心配置在 `solution.json`：

```json
{
  "mcpServers": {
    "edu-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "type": "stdio"
    }
  },
  "sessionTemplates": {
    "lesson-planning": {
      "enabledSkills": ["lesson-plan-generator", "quiz-generator", "student-analysis", "reschedule-class"]
    }
  }
}
```

关键环境变量：
- `CCAAS_URL`：CCAAS 后端地址（默认 `http://localhost:3001`）
- `AGENT_SESSION_ID`：会话 ID（由平台自动注入）
- `AGENT_CLIENT_ID`：租户 ID（由平台自动注入）

## 常见问题

**Q: show_info_card 卡片不显示？**
A: 确认 CCAAS 后端版本支持 show_info_card 工具渲染。检查前端 chat-interface 是否包含 InfoCard 组件。

**Q: 如何添加新的 section type？**
A: 在 `mcp-server/src/index.ts` 的 show_info_card enum 中添加新类型，同时更新前端 InfoCard 渲染组件。

**Q: 如何扩展知识点数据？**
A: 编辑 `mcp-server/data/` 下的 SQLite 数据库，向 `curriculum_nodes` 表插入新的知识点记录。

**Q: 多个 Skill 如何协同？**
A: 通过 `suggest_actions` 的 `skill_hint` 字段引导教师跳转到其他 Skill。例如学情分析后推荐使用出题专家出针对性练习。
