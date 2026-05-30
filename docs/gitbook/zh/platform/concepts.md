# 核心概念

本页定义即见Agentic 的核心术语。理解这些概念，有助于你正确阅读文档并设计 Agentic 服务。

---

## Workspace（工作空间）

**1 个 Workspace = 1 个终端用户账号。**

每个 Workspace 代表你的 Agentic 服务中的一位终端用户。当你在即见Agentic 上构建并部署服务后，每位用户拥有独立的 Workspace。Workspace 之间完全隔离——终端用户只能访问属于自己的会话、文件和对话历史。

```
你的 Agentic 服务
├── Workspace A  ←  终端用户 Alice
│   ├── 会话 1
│   ├── 会话 2
│   └── files/
├── Workspace B  ←  终端用户 Bob
│   ├── 会话 1
│   └── files/
└── Workspace C  ←  终端用户 Carol
    └── ...
```

**Workspace 配额的实际含义：**

| 方案 | Workspace 配额 | 含义 |
|------|----------------|------|
| Free | 20 | 最多 20 位终端用户 |
| Starter | 500 | 最多 500 位终端用户 |
| Business | 5,000 | 最多 5,000 位终端用户 |
| Enterprise | 定制 | 合约约定 |

Workspace 配额是你的服务能承载的终端用户账号上限，**不是**每次会话或每次请求的限制。

---

## 终端用户（End User）

**终端用户**是使用你所构建的 Agentic 服务的人。他们发送消息、上传文件、查看 Agent 输出、将结果应用到实际工作中。终端用户不配置 Skills 或 MCP Server——那是 Solution 开发者的工作。

**终端用户 vs. Solution 开发者：**

| | Solution 开发者 | 终端用户 |
|---|---|---|
| **做什么** | 构建 Agentic 服务（Skills、MCP、后端） | 使用运行中的服务 |
| **交互对象** | 平台管理界面、`solution.json`、代码 | 你的自定义前端 UI |
| **平台可见性** | 完整 | 无（他们只看到你的产品） |
| **即见Agentic 账号** | 有 | 无——以 Workspace 形式存在 |

终端用户从不直接接触即见Agentic。他们与你的产品交互，你的产品再用 Workspace 级别的 API Key 代表他们调用即见Agentic API。

---

## Session（会话）

**Session** 是终端用户与 Agent 之间的一次对话。在同一个 Workspace 内，终端用户可以发起多次会话——例如每个项目一个会话，或每天一个会话。

每个 Session 包含：
- 完整的对话历史（消息、Agent 回复、工具调用记录）
- 当前激活的 Skill 上下文
- 本次会话中生成或上传的文件引用

Session 会持久化保存，断线后可以恢复继续。

---

## Skill

**Skill** 定义 Agent 在特定场景下的行为——角色设定、执行指令、可用工具和路由触发条件。当终端用户发送消息时，Skill Router 将其匹配到合适的 Skill，Agent 在该 Skill 的上下文中执行。

详见 [Skill 编写指南](../guide/skill-writing.md)。

---

## MCP Server

**MCP Server** 向 Agent 暴露可调用的工具——数据库查询、API 调用、文件操作、计算逻辑等。MCP Server 在 `solution.json` 中注册，对该 Solution 下的所有 Skill 可用。

详见 [MCP Server 开发](../guide/mcp-server.md)。

---

## 概念关系图

```
平台（你的即见Agentic 账号）
└── Solution（你的 Agentic 服务，由 solution.json 定义）
    ├── Skills（Agent 行为定义）
    ├── MCP Servers（Agent 可调用的工具）
    └── Workspaces（每位终端用户一个）
        └── Sessions（每次对话一个）
            └── 消息、文件、工具调用记录
```

Solution 定义智能（Skills + MCP）。Workspace 是单个终端用户数据的容器。Session 是该容器内的一次对话。

---

## 进阶：Ontology + Workflow

对于需要 **类型化领域模型**、**声明式工作流**、**结构化观测** 的 Solution，平台还提供独立的 Ontology + Workflow 层：

- **ObjectType** — 领域实体（Lesson / Student / ...）
- **ActionDef** — Agent 和 WorkflowEngine 都能调用的动作
- **ManifestDef** — session 内绑定的 ObjectType + 事件流 + 状态
- **TriggerDef** — 声明式触发规则（event / state-change / object-set-change）
- **Observation** — 平台 `observations` 表 + projector

这一层是可选的，不是所有 Solution 都需要。详见 [Ontology & Workflow](../ontology/README.md) 章节。
