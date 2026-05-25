# 目录

* [即见Agentic 是什么](README.md)

## 平台介绍 <a href="#platform" id="platform"></a>

* [平台概述](platform/README.md)
* [核心概念](platform/concepts.md)
* [核心价值：Skills + MCP](platform/value.md)
* [平台架构](platform/architecture.md)
* [Runtime 架构（sandbox + workspace + materializer）](platform/runtime-architecture.md)
* [核心能力](platform/capabilities.md)
* [Solution 案例展示](platform/solutions.md)
* [定价](platform/pricing.md)

## 快速开始 <a href="#getting-started" id="getting-started"></a>

* [概述](getting-started/README.md)
* [安装与启动](getting-started/installation.md)
* [5 分钟快速体验](getting-started/quickstart.md)
* [本地自托管（stage-1 sandbox）](getting-started/local-self-host.md)

## Solution 构建教程 <a href="#tutorial" id="tutorial"></a>

* [教程概述](tutorial/README.md)
* [1. 理解 Solution 架构](tutorial/01-architecture.md)
* [2. 设计领域模型](tutorial/02-domain-model.md)
* [3. 用户旅程映射](tutorial/03-user-journeys.md)
* [4. 数据流与状态管理](tutorial/04-data-flow.md)
* [5. 表单与 output\_update 协议](tutorial/05-form-protocol.md)
* [6. 实现演练](tutorial/06-implementation/README.md)
  * [6.1 项目初始化](tutorial/06-implementation/01-setup.md)
  * [6.2 后端实现](tutorial/06-implementation/02-backend.md)
  * [6.3 MCP Server](tutorial/06-implementation/03-mcp-server.md)
  * [6.4 Skills](tutorial/06-implementation/04-skills.md)
  * [6.5 前端实现](tutorial/06-implementation/05-frontend.md)
  * [6.6 测试](tutorial/06-implementation/06-testing.md)
  * [6.7 会话持久化](tutorial/06-implementation/07-conversation-persistence.md)
* [7. 部署上线](tutorial/07-deployment.md)
* [8. 为 Solution 加入沙箱能力（进阶）](tutorial/08-sandbox.md)

## 案例 <a href="#examples" id="examples"></a>

* [Solution 案例库](examples/README.md)
* [智慧农服 Smart Agri Service](examples/smart-agri-service/README.md)
  * [MCP 工具设计：多数据源整合](examples/smart-agri-service/mcp-design.md)
* [麦肯锡顾问 McKinsey CLI](examples/mckinsey-cli/README.md)
  * [纯 Skill 方案：零 MCP 架构](examples/mckinsey-cli/skill-design.md)
* [Article Analyzer UI/UX 重设计](examples/article-analyzer-ui-redesign.md)
* [Context Layer @ Reference Picker](examples/reference-picker.md)
* [demo-sandbox（sandbox 全套能力案例）](examples/demo-sandbox.md)

## 开发指南 <a href="#guide" id="guide"></a>

* [开发指南概述](guide/README.md)
* [核心概念](guide/concepts.md)
* [Solution 开发完整指南](guide/solution-dev.md)
* [Builder Flow 教程](guide/builder-flow.md)
* [Skill 编写指南](guide/skill-writing.md)
* [MCP Server 开发](guide/mcp-server.md)
* [write\_output 最佳实践](guide/write-output.md)
* [Bundle 能力包](guide/bundles.md)
* [前端集成指南](guide/frontend.md)
* [React SDK 聊天集成](guide/chat-integration.md)
* [交互式提示](guide/interactive-prompting.md)
* [布局系统快速入门](guide/solution-layout-quickstart.md)
* [File Explorer 组件](guide/file-explorer.md)
* [会话持久化](guide/conversation-persistence.md)
* [Context Layer](guide/context-layer.md)
* [Harness Engineering](guide/harness-engineering.md)
* [Solution 用 runtime 新能力（扩展点指南）](guide/extending-runtime.md)

## 高级配置 <a href="#advanced" id="advanced"></a>

* [Bundle 高级配置](guide/bundles-advanced.md)
* [管理员 API Key 管理](guide/admin-api-keys.md)
* [会话模板管理](guide/admin-session-templates.md)
* [会话超时配置](guide/admin-session-ttl.md)

## API 参考 <a href="#api" id="api"></a>

* [API 概述](api/README.md)
* [REST API 端点](api/rest.md)
* [SSE Transport（推荐）](api/sse.md)
* [WebSocket 事件（已弃用）](api/websocket.md)
* [错误处理](api/error-handling.md)
* [@kedge-agentic/common 类型](api/shared-types.md)
* [Context Layer API](api/context-layer.md)

## 参考资料 <a href="#reference" id="reference"></a>

* [solution.json 配置参考 (v3.0)](reference/solution-json.md)
* [最佳实践汇总](reference/best-practices.md)
* [Runtime REST API（fs + metadata）](reference/runtime-api.md)
* [@kedge-agentic/agentfs-runtime 包参考](reference/agentfs-runtime.md)
