# Solution 案例库

本章节展示基于即见Agentic 平台构建的真实 Solution，演示不同的架构模式和设计方法。

## 精选 Solution

| Solution | 架构模式 | 核心亮点 |
|----------|---------|---------|
| [智慧农服 Smart Agri Service](smart-agri-service/README.md) | MCP + 双模板 | 11 个 MCP 工具、多数据源整合、双人设设计 |
| [麦肯锡顾问 McKinsey CLI](mckinsey-cli/README.md) | 纯 Skill、零 MCP | 单个 Skill 替代所有工具、渐进式上下文加载 |

## Demo 示例集

平台还包含 **12 个渐进式 Demo 示例**，覆盖各项独立功能：

| Demo | 演示功能 |
|------|---------|
| 01-pure-chat | 基础 AI 聊天（无工具） |
| 02-multi-template | 多会话模板 |
| 03-sse-events | SSE 实时事件流 |
| 04-write-output | 结构化输出同步到前端 |
| 05-skill-frontmatter | Skill 元数据与触发器 |
| 06-skill-routing | 多 Skill 路由逻辑 |
| 07-workflow-skill | 多步骤工作流 Skill |
| 08-output-operations | 输出字段操作 |
| 09-skill-prompt-mode | Skill prompt 模式配置 |
| 10-append-prompt | 系统提示词追加 |
| 11-tool-event-triggers | 工具事件触发钩子 |
| 12-sync-fields | SYNC_FIELDS 实时同步 |

Demo 源码可在公开仓库 [kedge-agentic/examples](https://github.com/kedge-agentic/examples) 的 `demo/` 目录下获取。每个 Demo 都是纯后端定义（Skills + 可选 MCP），无前端代码。使用 `setup.sh` 将任意 Demo 导入 `https://ccaas.zhushou.one`（可通过 `.env` 配置），然后通过 REST API 交互。

## 如何阅读案例

每个 Solution 案例遵循统一的结构：

1. **架构概览** —— 系统图展示组件关系
2. **关键设计决策** —— 为什么这样设计架构
3. **可迁移模式** —— 你可以在自己的 Solution 中复用的模式
4. **深度子页面** —— 特定设计方面的详细分析

重点关注**架构模式**而非实现细节——相同的模式可以跨领域应用。
