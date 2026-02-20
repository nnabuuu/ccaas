# 讲题助手 (Problem Explainer)

AI 驱动的智能讲题解决方案，帮助学生理解题目、掌握解题思路、举一反三。

## 功能特点

- **题目输入**: 支持文本输入和图片上传
- **智能识别**: Claude 视觉能力自动识别图片中的题目
- **分步讲解**: 逐步分析解题思路，每步有理有据
- **知识关联**: 关联相关知识点，建立知识网络
- **变式练习**: 提供同类型题目，促进知识迁移
- **全学科支持**: 覆盖语文、数学、英语、物理、化学等主要学科
- **生成PPT**: 一键生成讲题PPT课件

## 快速开始

### 前置条件

- Node.js 18+
- CCAAS Backend 运行在 localhost:3001

### 启动服务

```bash
# 一键启动所有服务
./setup.sh

# 或分别启动
cd mcp-server && npm run start   # port 3004 (MCP REST Server)
cd backend && npm run start:dev  # port 3003
cd frontend && npm run dev       # port 5281
```

### 访问应用

打开浏览器访问 http://localhost:5281

## 使用方式

1. **输入题目**
   - 直接输入题目文本
   - 或拖拽/粘贴题目图片

2. **选择学科**
   - 选择题目所属学科
   - 可选择年级以获得更精准的讲解

3. **开始讲解**
   - 点击"开始讲解"或直接发送消息
   - AI 将分析题目并逐步讲解

4. **互动追问**
   - 不明白可以追问
   - 请求更详细的解释
   - 要求举一反三

5. **生成PPT**
   - 点击"生成PPT"按钮
   - 使用 NotebookLM 生成讲题课件

## 项目结构

```
problem-explainer/
├── backend/          # NestJS 后端服务 (port 3003)
├── frontend/         # React 前端应用 (port 5281)
├── mcp-server/       # MCP REST API 服务器 (port 3004)
├── data/             # 学科和知识点数据
└── skills/           # SKILL.md 技能定义
```

## 技术栈

- **Backend**: NestJS, TypeORM, SQLite
- **Frontend**: React, Vite, Tailwind CSS
- **MCP Server**: Express.js REST API
- **AI**: Claude Code + 视觉能力

## 端口分配

| 服务 | 端口 | 说明 |
|------|------|------|
| CCAAS Backend | 3001 | 主服务 (前置条件) |
| Problem Explainer Backend | 3003 | 本地后端 |
| MCP REST Server | 3004 | MCP 工具 API |
| Frontend | 5281 | 前端应用 |

## 配置

编辑 `solution.json` 可修改：
- 端口配置
- 触发关键词
- 允许的 MCP 工具

## 开发

```bash
# 安装依赖
cd backend && npm install
cd frontend && npm install
cd mcp-server && npm install

# 运行测试
cd backend && npm test

# 编译 MCP Server
cd mcp-server && npm run build

# 单独启动 MCP Server
./setup.sh --mcp-only

# 单独注入 Skills
./setup.sh --inject-only
```

## MCP REST API

MCP Server 作为 REST API 运行在 port 3004：

```bash
# 健康检查
curl http://localhost:3004/health

# 获取学科列表
curl http://localhost:3004/tools/get_subjects

# 其他工具端点
POST /tools/write_output
POST /tools/get_knowledge_points
POST /tools/calculate_difficulty
POST /tools/generate_script_template
```

## 许可证

MIT
