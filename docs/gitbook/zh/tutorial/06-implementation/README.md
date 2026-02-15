# 6. 实现演练

在第 1-5 章中，你设计了 Task Manager Solution：领域模型、用户旅程、数据流和表单协议。现在是构建它的时候了。

## 你将构建什么

本章将引导你逐步实现完整的 Task Manager Solution。每个小节都会产出一个可运行、可测试的检查点，让你在继续前进之前始终确信代码是正确的。

```
┌──────────────────────────────────────────────────────────┐
│                    实现路线图                              │
│                                                          │
│  6.1 初始化 ──► 6.2 后端 ──► 6.3 MCP ──► 6.4 Skills      │
│                                                          │
│  6.5 前端 ──► 6.6 测试 ──► 6.7 持久化                      │
│                                                          │
│  每一步都产出可运行、可测试的检查点。                        │
└──────────────────────────────────────────────────────────┘
```

## 技术栈

| 组件 | 技术 | 用途 |
|------|------|------|
| 后端 | NestJS + better-sqlite3 | REST API、数据持久化 |
| 前端 | React 18 + Vite + Tailwind CSS | 用户界面 |
| MCP Server | Node.js + @modelcontextprotocol/sdk | AI 工具服务 |
| Skills | Markdown (SKILL.md) | AI 行为定义 |
| 聊天集成 | @ccaas/react-sdk + Socket.io | 实时 AI 通信 |

## 章节概览

| 小节 | 构建内容 | 检查点 |
|------|---------|-------|
| [6.1 项目初始化](01-setup.md) | 目录结构、solution.json、setup.sh | `setup.sh` 运行成功，所有服务启动 |
| [6.2 后端实现](02-backend.md) | NestJS REST API（任务和项目） | `curl POST /api/tasks` 返回 201 |
| [6.3 MCP Server](03-mcp-server.md) | write\_output 工具和自定义工具 | MCP Server 启动并响应工具调用 |
| [6.4 Skills](04-skills.md) | Task Creator 和 Bulk Import SKILL.md 文件 | Skills 在正确的关键词上触发 |
| [6.5 前端实现](05-frontend.md) | 包含聊天面板和表单同步的 React UI | 表单从 AI output\_update 事件更新 |
| [6.6 测试](06-testing.md) | 单元测试和集成测试 | 所有测试通过 |
| [6.7 会话持久化](07-conversation-persistence.md) | 跨页面刷新的持久化对话 | 消息在页面刷新后保留 |

## 前提条件

开始之前，确保你已经：

- 完成第 1-5 章（至少阅读了第 1 章了解架构背景）
- LoopAI 平台在本地运行（`npm run dev:backend` 在端口 3001）
- 安装了 Node.js 18+ 和 npm
- 有支持 TypeScript 的代码编辑器

## 如何跟随教程

1. **增量构建。**每个小节都建立在前一个的基础上。
2. **运行检查点**，在进入下一小节前完成每个小节末尾的验证。
3. **对比参考实现**，如果遇到困难可以查看 `solutions/task-manager-tutorial/`。

让我们从 [6.1 项目初始化](01-setup.md) 开始。
