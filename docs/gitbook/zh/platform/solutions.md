# Solution 案例展示

Solution 是基于即见Agentic 平台构建的垂直场景应用。每个 Solution 包含专属的前端界面、业务后端、MCP 工具和 AI Skill，展示了平台在不同领域的应用能力。

## 教案设计助手（Lesson Plan Designer）

### 场景介绍

AI 辅助教师设计教案，教师审核修改后由 AI 继续优化。典型的 Human-in-the-Loop 协作场景。

### 核心功能

- **60/40 分屏布局** —— 左侧教案编辑器，右侧 AI 对话
- **同步按钮** —— AI 生成的内容通过同步按钮应用到表单，教师可选择接受或修改
- **AI 修改追踪** —— 高亮显示 AI 修改的字段，方便教师审核
- **教材版本级联选择** —— 学科 → 年级 → 出版社 → 上/下册 → 章节
- **9 个 MCP 工具** —— 包括 write\_output、课标搜索、教材搜索、教学资源搜索等

### 技术亮点

- React 18 + NestJS 后端 + Socket.io 实时通信
- SQLite 数据持久化，支持教案 CRUD
- 结构化输出同步（14 个字段：目标、标准、材料、活动、评估、分层教学等）

---

## 题目讲解助手（Problem Explainer）

### 场景介绍

AI 驱动的智能题目讲解，支持文字/图片输入，自动生成讲解脚本、音频和 PPT。

### 核心功能

- **五阶段工作流** —— 分析题目 → 生成脚本 → 生成音频 → 生成 PPT → 输出文件
- **文字/图片输入** —— 支持文字描述或拍照上传题目
- **智能识别** —— 自动识别题目类型和知识点
- **逐步讲解** —— 生成分步骤的详细讲解
- **知识关联** —— 自动关联相关知识点和变式练习
- **多格式输出** —— Markdown 脚本、MP3 音频、PPTX 演示文稿

### 技术亮点

- REST API 形式的 MCP Server（6 个工具端点）
- 8 个同步字段（题目分析、关键知识、解题步骤、答案、常见错误等）
- 自动难度评估公式

---

## CCAAS Demo

### 场景介绍

平台基础能力演示应用，展示 Skill 管理、聊天交互、文件下载等核心功能。

### 核心功能

- **Skill 管理** —— 技能的启用/禁用切换
- **聊天界面** —— 完整的 AI 对话体验
- **文件下载** —— AI 生成文件的下载管理
- **会话重启** —— 一键重启会话

### 内置示例 Skill

- **hello-world** —— 基础问候 Skill
- **report-generator** —— 报告生成 Skill
- **file-creator** —— 文件创建 Skill

---

## 构建你自己的 Solution

即见Agentic 平台提供完整的 Solution 开发框架，开发者可以快速构建面向特定场景的应用。

详情请参考 [Solution 开发完整指南](../guide/solution-dev.md)。

### Solution 标准结构

```
my-solution/
├── frontend/        # 前端应用
├── backend/         # 业务后端（可选）
├── mcp-server/      # MCP 工具服务
├── skills/          # AI Skill 定义
├── solution.json    # 解决方案配置
├── setup.sh         # 一键启动脚本
└── inject-skills.sh # Skill 注入脚本
```

### 关键配置 —— solution.json

```json
{
  "name": "My Solution",
  "slug": "my-solution",
  "version": "1.0.0",
  "description": "解决方案描述",
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "自定义工具服务"
    }
  },
  "skills": [
    {
      "name": "My Skill",
      "slug": "my-skill",
      "description": "技能描述",
      "triggers": [{ "type": "keyword", "value": "关键词" }],
      "allowedTools": ["write_output", "my_tool"],
      "skillFile": "skills/my-skill/SKILL.md"
    }
  ]
}
```
