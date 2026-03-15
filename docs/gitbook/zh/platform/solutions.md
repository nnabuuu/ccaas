# Solution 案例展示

Solution 是基于即见Agentic 平台构建的垂直场景应用。每个 Solution 包含专属的前端界面、业务后端、MCP 工具和 AI Skill，展示了平台在不同领域的应用能力。

## 智慧农服（Smart Agri Service）

### 场景介绍

AI 驱动的农业咨询平台，采用双人设设计。同一套数据通过不同的 Skill 和会话模板，驱动两种完全不同的用户体验——温暖的农户顾问和专业的信贷分析师。

### 核心功能

- **双模式设计** —— 农户顾问（7 个输出字段）和信贷评估师（8 个输出字段）共享同一套数据
- **11 个 MCP 工具** —— 数据查询、计算汇总、政策/产品搜索、输出同步
- **政策引用** —— AI 引用具体政策条款，生成可验证的链接指向原始文档
- **渐进式输出** —— `write_output` + SSE 在分析推进时实时渲染结构化字段
- **50 个演示农户** —— SQLite 数据库包含完整的档案、土地、作物、农机和贷款记录

### 技术亮点

- React 18 前端 + NestJS Solution 后端 + SQLite (WAL 模式)
- MCP Server 使用 stdio 传输，3 类 11 个工具
- 会话持久化支持从 `output_update` 事件即时恢复

---

## 麦肯锡顾问（McKinsey CLI）

### 场景介绍

遵循麦肯锡咨询方法论的结构化商业分析工具。展示了纯 Skill、零 MCP 架构——单个强大的 Skill 通过内置能力（网络搜索、文件生成）替代所有 MCP 工具。

### 核心功能

- **零 MCP** —— 不需要工具服务器；内置 WebSearch + Write + Read 工具已足够
- **9 步工作流** —— 问题定义、MECE Issue Tree、页面设计、逐页 PPTX 生成
- **渐进式披露** —— 300 行核心 SKILL.md + 7 个按需参考文件，分阶段加载和释放
- **增量生成** —— 一次一页，带自检协议，支持 20-25 页 PPT
- **双客户端** —— Vue 3 Web 前端和 Node.js CLI 客户端共享同一套会话 API

### 技术亮点

- 单个 Skill 共 1400 行指令，拆分为导航核心 + 参考文件
- 页面依赖管理（独立、前向、后向）控制生成顺序
- 7 种麦肯锡页面布局模板，配合严格的设计系统

---

## Demo 示例集

平台包含 **12 个渐进式 Demo 示例**，每个演示一项平台功能。它们可作为学习资源和新 Solution 的起点。

| Demo | 功能 |
|------|-----|
| 01-pure-chat | 基础 AI 聊天 |
| 02-multi-template | 多会话模板 |
| 03-sse-events | SSE 事件流 |
| 04-write-output | 结构化输出同步 |
| 05-skill-frontmatter | Skill 元数据 |
| 06-skill-routing | 多 Skill 路由 |
| 07-workflow-skill | 工作流 Skill |
| 08-output-operations | 输出操作 |
| 09-skill-prompt-mode | Prompt 模式配置 |
| 10-append-prompt | 系统提示词追加 |
| 11-tool-event-triggers | 工具事件钩子 |
| 12-sync-fields | 实时字段同步 |

源码：[kedge-agentic/examples](https://github.com/kedge-agentic/examples)

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
