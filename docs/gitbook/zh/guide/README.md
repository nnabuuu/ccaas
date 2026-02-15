# 开发指南概述

本章节面向开发者，提供在即见Agentic 平台上构建应用的完整技术指南。

## 章节导航

| 章节 | 内容 | 阅读顺序 |
|------|------|----------|
| [Solution 开发完整指南](solution-dev.md) | Solution 的完整开发流程 | 第一步 |
| [Skill 编写指南](skill-writing.md) | 如何编写 AI Skill | 第二步 |
| [MCP Server 开发](mcp-server.md) | 如何开发 MCP 工具服务 | 第三步 |
| [write\_output 最佳实践](write-output.md) | 结构化输出的正确用法 | 配合 MCP 阅读 |
| [前端集成指南](frontend.md) | 如何集成前端 SDK | 第四步 |

## 开发流程概览

构建一个即见Agentic Solution 的典型流程：

```
1. 规划 Solution 结构
   └── 确定目标场景、所需工具、前端交互方式

2. 编写 solution.json
   └── 配置 MCP Server、Skill、端口

3. 开发 MCP Server
   └── 实现 write_output 和自定义工具

4. 编写 Skill
   └── 定义 AI Agent 的角色、知识、工作流

5. 开发前端
   └── 集成 Socket.io、处理事件流、构建 UI

6. 联调测试
   └── 端到端验证完整数据流
```

## 核心概念速览

### Solution

面向垂直场景的完整应用，包含前后端、MCP 工具和 AI Skill。

### Skill

定义 AI Agent 在特定场景下的行为，包括角色设定、知识范围、工具权限和输出格式。

### MCP Server

为 AI Agent 提供可调用的外部工具，通过标准化的 MCP 协议通信。

### write\_output

MCP 工具之一，用于将 AI 生成的结构化数据同步到前端表单。

### 事件流

AI Agent 执行过程中产生的实时事件（文本、状态、工具活动、输出更新等），通过 WebSocket 推送到前端。
